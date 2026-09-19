import { describe, expect, it } from 'vitest'
import { CopilotApplicationService } from '../server/application/copilot-service'
import type { CopilotContext, CopilotPlanner } from '../server/domain/copilot-types'
import { createInvoiceFlowGraph } from '../server/domain/fixtures/invoiceflow'
import { serializeDesignGraph } from '../server/domain/serialization'
import { MemoryDesignGraphRepository } from '../server/persistence/memory-graph'
import { MemoryDesignRepository } from '../server/persistence/memory'
import { MemoryVersionRepository } from '../server/persistence/memory-versions'
import { VersioningApplicationService } from '../server/application/version-service'
import { DeterministicCopilotPlanner } from '../server/application/copilot-planner'

const graph = createInvoiceFlowGraph()

async function setup() {
  const resources = new MemoryDesignRepository()
  const graphs = new MemoryDesignGraphRepository([graph])
  const versions = new MemoryVersionRepository()
  await resources.createProject(graph.project)
  await resources.createDocument(graph.document)
  let sequence = 0
  const versioning = new VersioningApplicationService(resources, graphs, versions, {
    id: () => `copilot-${++sequence}`,
    now: () => '2026-09-06T00:00:00.000Z',
  })
  const draft = await versioning.createDraft(graph.document.id, 'designer')
  const approved = await versioning.approveVersion(draft.id, 'reviewer')
  return { resources, graphs, versions, versioning, approved, copilot: new CopilotApplicationService(versioning) }
}

describe('structured Copilot foundation', () => {
  it('assembles deterministic approved-version context with semantic design data', async () => {
    const { copilot, approved } = await setup()
    const first = await copilot.inspect({ projectId: graph.project.id, documentId: graph.document.id, baseVersionId: approved.id, selectedNodeIds: ['node_primary_button', 'node_dashboard_title'] })
    const second = await copilot.inspect({ projectId: graph.project.id, documentId: graph.document.id, baseVersionId: approved.id, selectedNodeIds: ['node_dashboard_title', 'node_primary_button', 'node_dashboard_title'] })

    expect(first).toEqual(second)
    expect(first.baseVersionId).toBe(approved.id)
    expect(first.selectedNodeIds).toEqual(['node_dashboard_title', 'node_primary_button'].sort())
    expect(first.componentDefinitions.map((definition) => definition.id)).toEqual([...first.componentDefinitions].map((definition) => definition.id).sort())
    expect(first.tokens.length).toBeGreaterThan(0)
    expect(first.typography.length).toBeGreaterThan(0)
    expect(first.intents.length).toBeGreaterThan(0)
  })

  it('delegates typed planner operations to the existing proposal boundary without mutating the approved graph', async () => {
    const { copilot, approved, graphs, versioning } = await setup()
    let plannerContext: CopilotContext | undefined
    const planner: CopilotPlanner = {
      async plan(context, instruction) {
        plannerContext = context
        expect(instruction).toBe('Promote the dashboard title.')
        return { operations: [{ type: 'moveNode', nodeId: 'node_dashboard_title', parentId: null }], rationale: 'Promote the title to make hierarchy clearer.' }
      },
    }

    const result = await copilot.propose({ projectId: graph.project.id, documentId: graph.document.id, baseVersionId: approved.id, instruction: 'Promote the dashboard title.', author: 'copilot' }, planner)
    expect(plannerContext?.baseVersionId).toBe(approved.id)
    expect(result.proposal).toMatchObject({ status: 'pending', baseVersionId: approved.id, author: 'copilot' })
    expect(result.proposal.validation).toEqual({ valid: true, issues: [] })
    expect((await versioning.getVersion(approved.id)).graph).toEqual(approved.graph)
    expect((await graphs.getDesignGraph(graph.document.id))?.nodes.find((node) => node.id === 'node_dashboard_title')?.parentId).toBe('node_dashboard_header')
    expect(serializeDesignGraph((await versioning.getVersion(approved.id)).graph)).toBe(serializeDesignGraph(approved.graph))
  })

  it('rejects empty planner output and invalid context references', async () => {
    const { copilot, approved } = await setup()
    const emptyPlanner: CopilotPlanner = { async plan() { return { operations: [], rationale: 'No changes.' } } }
    await expect(copilot.propose({ projectId: graph.project.id, documentId: graph.document.id, baseVersionId: approved.id, instruction: 'Do nothing.', author: 'copilot' }, emptyPlanner)).rejects.toMatchObject({ code: 'PROPOSAL_INVALID' })
    await expect(copilot.inspect({ projectId: graph.project.id, documentId: graph.document.id, baseVersionId: approved.id, selectedNodeIds: ['missing-node'] })).rejects.toMatchObject({ code: 'INVALID_REFERENCE' })
  })

  it('grounds suggestions in the current working version and rejects stale bases', async () => {
    const { copilot, versioning, approved } = await setup()
    const draft = await versioning.createDraft(graph.document.id, 'designer-2')
    // A design being edited is grounded in its working draft, not the last approved snapshot.
    const context = await copilot.inspect({ projectId: graph.project.id, documentId: graph.document.id, baseVersionId: draft.id })
    expect(context.baseVersionId).toBe(draft.id)
    // Once a draft is the working version, the older approved snapshot is no longer the base.
    await expect(copilot.inspect({ projectId: graph.project.id, documentId: graph.document.id, baseVersionId: approved.id })).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
    await expect(copilot.inspect({ projectId: 'other-project', documentId: graph.document.id, baseVersionId: draft.id })).rejects.toMatchObject({ code: 'INVALID_REFERENCE' })
  })

  it('lets the assistant propose against a fresh draft without mutating it', async () => {
    const { copilot, versioning, graphs } = await setup()
    const draft = await versioning.createDraft(graph.document.id, 'designer-2')
    const result = await copilot.generate({ projectId: graph.project.id, documentId: graph.document.id, pageId: graph.page.id, baseVersionId: draft.id, instruction: 'Move the selected layer under dashboard header.', selectedNodeIds: ['node_dashboard_title'], author: 'copilot' }, new DeterministicCopilotPlanner())
    expect(result.status).toBe('ready')
    expect(result.proposal).toMatchObject({ baseVersionId: draft.id, status: 'pending' })
    // Proposal-first: drafting a suggestion never writes to the working draft.
    expect((await versioning.getVersion(draft.id)).graph).toEqual(draft.graph)
    expect((await graphs.getDesignGraph(graph.document.id))?.nodes.find((node) => node.id === 'node_dashboard_title')?.parentId).toBe('node_dashboard_header')
  })

  it('resolves a layer named "... copy" instead of treating it as a duplication request', async () => {
    const planner = new DeterministicCopilotPlanner()
    const context = {
      project: { id: 'p', name: 'P', slug: 'p' },
      document: { id: 'd', projectId: 'p', name: 'D' },
      page: { id: 'pg', documentId: 'd', name: 'Page', routeHint: null },
      baseVersionId: 'v1',
      nodes: [{ id: 'node_feature_copy', name: 'Feature copy' }],
      componentDefinitions: [], componentInstances: [], tokens: [], typography: [], intents: [], selectedNodeIds: [],
    } as unknown as CopilotContext
    const plan = await planner.plan(context, 'Remove the Feature copy')
    expect(plan.operations).toEqual([{ type: 'deleteNode', nodeId: 'node_feature_copy' }])
    expect(plan.rationale).not.toMatch(/duplicate/i)
  })

  it('has no UI, canvas, or model-provider dependency', async () => {
    const source = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../server/application/copilot-service.ts', import.meta.url), 'utf8'))
    expect(source).not.toMatch(/react|zustand|CanvasElement|SVG|openai|anthropic|fetch\(/i)
  })

  it('generates a deterministic, version-bound proposal from supported natural language', async () => {
    const { copilot, approved, graphs } = await setup()
    const result = await copilot.generate({ projectId: graph.project.id, documentId: graph.document.id, pageId: graph.page.id, baseVersionId: approved.id, instruction: 'Move the selected layer under dashboard header.', selectedNodeIds: ['node_dashboard_title'], author: 'copilot' }, new DeterministicCopilotPlanner())
    expect(result.status).toBe('ready')
    expect(result.proposal).toMatchObject({ baseVersionId: approved.id, projectId: graph.project.id, documentId: graph.document.id, status: 'pending' })
    expect(result.pageId).toBe(graph.page.id)
    expect(result.operations).toEqual([{ type: 'moveNode', nodeId: 'node_dashboard_title', parentId: 'node_dashboard_header', orderIndex: expect.any(Number) }])
    expect((await graphs.getDesignGraph(graph.document.id))?.nodes.find((node) => node.id === 'node_dashboard_title')?.parentId).toBe('node_dashboard_header')
  })

  it('returns clarification for unsupported or ambiguous intent without creating a proposal', async () => {
    const { copilot, approved } = await setup()
    const unsupported = await copilot.generate({ projectId: graph.project.id, documentId: graph.document.id, baseVersionId: approved.id, instruction: 'Rename this button to Get Started.', selectedNodeIds: ['node_primary_button'], author: 'copilot' }, new DeterministicCopilotPlanner())
    expect(unsupported.status).toBe('clarification')
    expect(unsupported.proposal).toBeUndefined()
  })
})
