import { describe, expect, it, vi } from 'vitest'
import { AzureOpenAiCopilotPlanner, ResilientCopilotPlanner, assistantDescriptor, azureOpenAiCopilotConfig, createCopilotPlanner, parseCopilotPlan } from '../server/application/azure-copilot-planner'
import { DeterministicCopilotPlanner } from '../server/application/copilot-planner'
import type { CopilotContext } from '../server/domain/copilot-types'
import { createInvoiceFlowGraph } from '../server/domain/fixtures/invoiceflow'

const graph = createInvoiceFlowGraph()

function context(): CopilotContext {
  return {
    project: graph.project,
    document: graph.document,
    page: graph.page,
    baseVersionId: 'version-1',
    nodes: graph.nodes,
    componentDefinitions: graph.componentDefinitions,
    componentInstances: graph.componentInstances,
    tokens: graph.tokens,
    typography: graph.typography,
    intents: graph.intents,
    selectedNodeIds: ['node_primary_button'],
  }
}

const config = { endpoint: 'https://example.openai.azure.com', apiKey: 'secret-key', deployment: 'gpt-4o', apiVersion: '2024-10-21', transport: 'azure-deployment' as const }
const v1Config = { endpoint: 'https://example.services.ai.azure.com/openai/v1', apiKey: 'secret-key', deployment: 'gpt-5-mini', apiVersion: '2024-10-21', transport: 'openai-v1' as const }

function chatResponse(plan: unknown, init: { status?: number } = {}) {
  return {
    ok: (init.status ?? 200) < 400,
    status: init.status ?? 200,
    json: async () => ({ choices: [{ message: { content: typeof plan === 'string' ? plan : JSON.stringify(plan) } }] }),
  } as unknown as Response
}

describe('Azure OpenAI assistant configuration', () => {
  it('is inert until the endpoint, key, and deployment are all present', () => {
    expect(azureOpenAiCopilotConfig({} as NodeJS.ProcessEnv)).toBeNull()
    expect(azureOpenAiCopilotConfig({ AZURE_OPENAI_ENDPOINT: 'https://x.openai.azure.com/', AZURE_OPENAI_API_KEY: 'k' } as unknown as NodeJS.ProcessEnv)).toBeNull()
    expect(azureOpenAiCopilotConfig({ AZURE_OPENAI_ENDPOINT: 'https://x.openai.azure.com/', AZURE_OPENAI_API_KEY: 'k', AZURE_OPENAI_DEPLOYMENT: 'gpt-4o' } as unknown as NodeJS.ProcessEnv)).toMatchObject({ endpoint: 'https://x.openai.azure.com', deployment: 'gpt-4o', apiVersion: '2024-10-21' })
  })

  it('keeps the deterministic planner when Azure is not configured', () => {
    expect(createCopilotPlanner({} as NodeJS.ProcessEnv)).toBeInstanceOf(DeterministicCopilotPlanner)
    const azure = createCopilotPlanner({ AZURE_OPENAI_ENDPOINT: 'https://x.openai.azure.com/', AZURE_OPENAI_API_KEY: 'k', AZURE_OPENAI_DEPLOYMENT: 'gpt-4o' } as unknown as NodeJS.ProcessEnv)
    expect(azure).toBeInstanceOf(ResilientCopilotPlanner)
    expect(azure.provider).toBe('azure-openai')
  })

  it('describes the active assistant without leaking endpoint, deployment, or key', () => {
    const env = { AZURE_OPENAI_ENDPOINT: 'https://secret-resource.openai.azure.com', AZURE_OPENAI_API_KEY: 'super-secret-key', AZURE_OPENAI_DEPLOYMENT: 'gpt-4o-prod' } as unknown as NodeJS.ProcessEnv
    expect(assistantDescriptor(env)).toEqual({ provider: 'azure-openai', connected: true, supports: ['create', 'rearrange', 'remove', 'refine'] })
    expect(assistantDescriptor({} as NodeJS.ProcessEnv)).toMatchObject({ provider: 'builtin', connected: true })
    expect(JSON.stringify(assistantDescriptor(env))).not.toMatch(/secret|openai\.azure|gpt-4o|super-secret/i)
  })
})

describe('Azure OpenAI assistant planning', () => {
  it('calls the deployment endpoint with the key in a server-only header and a grounded layer list', async () => {
    const request = vi.fn(async () => chatResponse({ operations: [{ type: 'moveNode', nodeId: 'node_status_badge', parentId: 'node_dashboard_shell', orderIndex: 0 }], rationale: 'Group the badge with the dashboard shell.' }))
    const planner = new AzureOpenAiCopilotPlanner(config, request as unknown as typeof fetch)
    const plan = await planner.plan(context(), 'Move the paid badge into the dashboard shell')

    expect(plan.operations).toEqual([{ type: 'moveNode', nodeId: 'node_status_badge', parentId: 'node_dashboard_shell', orderIndex: 0 }])
    const [url, init] = request.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('/openai/deployments/gpt-4o/chat/completions')
    expect(url).toContain('api-version=2024-10-21')
    expect((init.headers as Record<string, string>)['api-key']).toBe('secret-key')
    const body = JSON.parse(String(init.body))
    expect(body.temperature).toBe(0)
    expect(body.response_format).toEqual({ type: 'json_object' })
    // Grounding: the model sees the trusted canonical layers, not client data.
    expect(String(body.messages[1].content)).toContain('Create invoice')
  })

  it('detects the Azure AI Foundry v1 surface and uses bearer auth with model in the body', async () => {
    expect(azureOpenAiCopilotConfig({ AZURE_OPENAI_ENDPOINT: 'https://x.services.ai.azure.com/openai/v1', AZURE_OPENAI_API_KEY: 'k', AZURE_OPENAI_DEPLOYMENT: 'gpt-5-mini' } as unknown as NodeJS.ProcessEnv)).toMatchObject({ transport: 'openai-v1' })
    expect(azureOpenAiCopilotConfig({ AZURE_OPENAI_ENDPOINT: 'https://x.openai.azure.com', AZURE_OPENAI_API_KEY: 'k', AZURE_OPENAI_DEPLOYMENT: 'gpt-4o' } as unknown as NodeJS.ProcessEnv)).toMatchObject({ transport: 'azure-deployment' })

    const request = vi.fn(async () => chatResponse({ operations: [{ type: 'deleteNode', nodeId: 'node_status_badge' }], rationale: 'Remove the status badge.' }))
    const planner = new AzureOpenAiCopilotPlanner(v1Config, request as unknown as typeof fetch)
    expect((await planner.plan(context(), 'Remove the paid badge')).operations).toEqual([{ type: 'deleteNode', nodeId: 'node_status_badge' }])

    const [url, init] = request.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://example.services.ai.azure.com/openai/v1/chat/completions')
    const headers = init.headers as Record<string, string>
    expect(headers.authorization).toBe('Bearer secret-key')
    expect(headers['api-key']).toBeUndefined()
    const body = JSON.parse(String(init.body))
    expect(body.model).toBe('gpt-5-mini')
    expect(body.max_completion_tokens).toBe(4000)
    // gpt-5 rejects a non-default temperature, so the v1 surface must omit it.
    expect(body.temperature).toBeUndefined()
    expect(body.max_tokens).toBeUndefined()
  })

  it('accepts a delete operation for a known layer', async () => {
    const planner = new AzureOpenAiCopilotPlanner(config, (async () => chatResponse({ operations: [{ type: 'deleteNode', nodeId: 'node_status_badge' }], rationale: 'Remove the status badge.' })) as unknown as typeof fetch)
    const plan = await planner.plan(context(), 'Remove the paid badge')
    expect(plan.operations).toEqual([{ type: 'deleteNode', nodeId: 'node_status_badge' }])
  })

  it('drops a hallucinated layer id instead of proposing an unsafe change', async () => {
    const planner = new AzureOpenAiCopilotPlanner(config, (async () => chatResponse({ operations: [{ type: 'deleteNode', nodeId: 'node_does_not_exist' }], rationale: 'Remove it.' })) as unknown as typeof fetch)
    const plan = await planner.plan(context(), 'Remove that thing')
    expect(plan.operations).toEqual([])
    expect(plan.rationale).toMatch(/not available yet/i)
  })

  it('refuses an operation the proposal contract cannot execute', async () => {
    const planner = new AzureOpenAiCopilotPlanner(config, (async () => chatResponse({ operations: [{ type: 'createNode', nodeId: 'node_status_badge' }], rationale: 'Add a card.' })) as unknown as typeof fetch)
    expect((await planner.plan(context(), 'Add a card')).operations).toEqual([])
  })

  it('degrades to a clarification, never an executable change, when the model is unavailable', async () => {
    const failing = new AzureOpenAiCopilotPlanner(config, (async () => chatResponse({}, { status: 503 })) as unknown as typeof fetch)
    const offline = new AzureOpenAiCopilotPlanner(config, (async () => { throw new Error('network down') }) as unknown as typeof fetch)
    const garbage = new AzureOpenAiCopilotPlanner(config, (async () => chatResponse('not json at all')) as unknown as typeof fetch)

    for (const planner of [failing, offline, garbage]) {
      const plan = await planner.plan(context(), 'Move the badge')
      expect(plan.operations).toEqual([])
      expect(plan.rationale.length).toBeGreaterThan(0)
    }
    expect((await failing.plan(context(), 'Move the badge')).rationale).toContain('503')
    // Never leak the credential into anything the client could see.
    expect(JSON.stringify(await failing.plan(context(), 'Move the badge'))).not.toContain('secret-key')
  })
})

describe('plan parsing', () => {
  it('rejects structurally invalid plans', () => {
    expect(parseCopilotPlan(null, context())).toBeNull()
    expect(parseCopilotPlan({ operations: 'nope' }, context())).toBeNull()
    expect(parseCopilotPlan({ operations: [{ type: 'moveNode', nodeId: 'node_status_badge', parentId: 'node_status_badge' }] }, context())).toBeNull()
    expect(parseCopilotPlan({ operations: [{ type: 'moveNode', nodeId: 'node_status_badge', orderIndex: -1 }] }, context())).toBeNull()
  })

  it('accepts an empty operations list as a clarification', () => {
    expect(parseCopilotPlan({ operations: [], rationale: 'Which layer did you mean?' }, context())).toEqual({ operations: [], rationale: 'Which layer did you mean?' })
  })
})
