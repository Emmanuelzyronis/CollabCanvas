import { readdir, readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ManifestApplicationService } from '../server/application/manifest-service'
import { createInvoiceFlowGraph } from '../server/domain/fixtures/invoiceflow'
import { serializeDesignManifest } from '../server/domain/manifest-serialization'
import { AgentGateway } from '../server/gateway'
import { DevelopmentGatewayAuthenticator } from '../server/gateway/auth'
import { createSemanticToolRegistry, getManifestInputSchema } from '../server/mcp'
import { MemoryDesignGraphRepository } from '../server/persistence/memory-graph'
import { MemoryDesignRepository } from '../server/persistence/memory'

const graph = createInvoiceFlowGraph()

function developmentAuthenticator(overrides: Partial<Parameters<DevelopmentGatewayAuthenticator['register']>[0]> = {}) {
  const authenticator = new DevelopmentGatewayAuthenticator()
  authenticator.register({
    id: 'credential-semantic',
    agentId: 'agent-semantic-test',
    projectIds: [graph.project.id],
    capabilities: ['READ_MANIFEST'],
    secret: 'semantic-test-secret',
    ...overrides,
  })
  return authenticator
}

function manifestApplication() {
  const resources = new MemoryDesignRepository()
  const graphRepository = new MemoryDesignGraphRepository([graph])
  return Promise.all([resources.createProject(graph.project), resources.createDocument(graph.document)]).then(
    () => new ManifestApplicationService(resources, graphRepository),
  )
}

function input(overrides: Partial<{ projectId: string; documentId: string; credential: string | undefined; requestId: string }> = {}) {
  return {
    projectId: graph.project.id,
    documentId: graph.document.id,
    credential: 'semantic-test-secret',
    requestId: 'semantic-request-1',
    ...overrides,
  }
}

describe('semantic get_manifest tool', () => {
  it('exposes exactly one typed read-only semantic tool', () => {
    const calls: unknown[] = []
    const registry = createSemanticToolRegistry({
      readManifest: async (request) => {
        calls.push(request)
        return {
          data: {} as never,
          auditContext: {
            requestId: request.requestId,
            agentId: 'agent',
            projectId: request.projectId,
            capability: 'READ_MANIFEST',
            operation: 'READ_MANIFEST',
            outcome: 'succeeded',
          },
        }
      },
    })
    expect(registry.list()).toHaveLength(1)
    expect(registry.list()[0]).toMatchObject({ name: 'get_manifest', capability: 'READ_MANIFEST' })
    expect(getManifestInputSchema.required).toEqual(['projectId', 'documentId', 'requestId'])
    expect(calls).toHaveLength(0)
  })

  it('delegates to AgentGateway and returns the same deterministic manifest as the application service', async () => {
    const application = await manifestApplication()
    const gateway = new AgentGateway(developmentAuthenticator(), application)
    const registry = createSemanticToolRegistry(gateway)

    const result = await registry.call('get_manifest', input())
    expect('data' in result).toBe(true)
    if (!('data' in result)) return
    expect(serializeDesignManifest(result.data)).toBe(serializeDesignManifest(await application.getDocumentManifest(graph.document.id)))
    expect(result.requestId).toBe('semantic-request-1')
  })

  it.each([
    ['missing credential', { credential: undefined }, 'UNAUTHENTICATED'],
    ['invalid credential', { credential: 'wrong-secret' }, 'INVALID_CREDENTIAL'],
    ['inactive credential', { credential: 'semantic-test-secret' }, 'INVALID_CREDENTIAL'],
    ['unauthorized project', { projectId: 'other-project' }, 'PROJECT_SCOPE_DENIED'],
  ] as const)('%s returns a safe gateway error', async (label, overrides, code) => {
    const inactive = label === 'inactive credential'
    const gateway = new AgentGateway(developmentAuthenticator({ active: !inactive }), await manifestApplication())
    const result = await createSemanticToolRegistry(gateway).call('get_manifest', input(overrides))
    expect(result).toMatchObject({ error: { code } })
    expect(JSON.stringify(result)).not.toContain('semantic-test-secret')
  })

  it('denies a credential without READ_MANIFEST', async () => {
    const gateway = new AgentGateway(developmentAuthenticator({ capabilities: [] }), await manifestApplication())
    const result = await createSemanticToolRegistry(gateway).call('get_manifest', input())
    expect(result).toMatchObject({ error: { code: 'CAPABILITY_DENIED' } })
  })

  it('rejects a document/project mismatch through the gateway', async () => {
    const gateway = new AgentGateway(developmentAuthenticator({ projectIds: ['other-project'] }), await manifestApplication())
    const result = await createSemanticToolRegistry(gateway).call('get_manifest', input({ projectId: 'other-project' }))
    expect(result).toMatchObject({ error: { code: 'RESOURCE_NOT_FOUND' } })
  })

  it('maps an unknown document to RESOURCE_NOT_FOUND', async () => {
    const gateway = new AgentGateway(developmentAuthenticator(), await manifestApplication())
    const result = await createSemanticToolRegistry(gateway).call('get_manifest', input({ documentId: 'missing-document' }))
    expect(result).toMatchObject({ error: { code: 'RESOURCE_NOT_FOUND' } })
  })

  it('returns INVALID_REQUEST for an unknown semantic tool', async () => {
    const registry = createSemanticToolRegistry({ readManifest: async () => { throw new Error('not called') } })
    const result = await registry.call('unknown_tool', input())
    expect(result).toMatchObject({ error: { code: 'INVALID_REQUEST' } })
  })

  it('maps upstream application failures without leaking internal errors', async () => {
    const gateway = new AgentGateway(developmentAuthenticator(), {
      getDocumentManifest: async () => { throw new Error('database password=top-secret') },
    })
    const result = await createSemanticToolRegistry(gateway).call('get_manifest', input())
    expect(result).toMatchObject({ error: { code: 'UPSTREAM_APPLICATION_ERROR' } })
    expect(JSON.stringify(result)).not.toContain('top-secret')
  })

  it('produces equivalent deterministic output across repeated calls', async () => {
    const gateway = new AgentGateway(developmentAuthenticator(), await manifestApplication())
    const registry = createSemanticToolRegistry(gateway)
    const first = await registry.call('get_manifest', input({ requestId: 'request-a' }))
    const second = await registry.call('get_manifest', input({ requestId: 'request-b' }))
    expect('data' in first && 'data' in second).toBe(true)
    if (!('data' in first) || !('data' in second)) return
    expect(serializeDesignManifest(first.data)).toBe(serializeDesignManifest(second.data))
  })

  it('has no direct persistence, compiler, canvas, or Zustand dependency', async () => {
    const source = await readFile(new URL('../server/mcp/semantic-tools.ts', import.meta.url), 'utf8')
    expect(source).not.toMatch(/persistence|compileDesignManifest|CanvasElement|zustand|useCanvasStore/)
  })

  it('keeps the existing browser canvas tool suite separate and unchanged at 33 tools', async () => {
    const toolDirectory = new URL('../src/mcp/tools/', import.meta.url)
    const files = (await readdir(toolDirectory)).filter((file) => file.endsWith('.ts') && file !== 'index.ts')
    const source = await Promise.all(files.map((file) => readFile(new URL(file, toolDirectory), 'utf8')))
    const names = source.flatMap((contents) => [...contents.matchAll(/name:\s*'([^']+)'/g)].map((match) => match[1]))
    expect(names).toHaveLength(33)
    expect(names).not.toContain('get_manifest')
  })

  it('does not expose any write capability', () => {
    const registry = createSemanticToolRegistry({ readManifest: async () => { throw new Error('not called') } })
    expect(registry.list().map((tool) => tool.capability)).toEqual(['READ_MANIFEST'])
    expect(registry.get('propose_change')).toBeUndefined()
  })
})

describe('semantic tool dependency direction', () => {
  it('uses the application through AgentGateway without persistence access', async () => {
    const calls: string[] = []
    const gateway = {
      readManifest: async (request: Parameters<AgentGateway['readManifest']>[0]) => {
        calls.push(`gateway:${request.documentId}`)
        return {
          data: { manifestVersion: '1' } as never,
          auditContext: {
            requestId: request.requestId,
            agentId: 'agent',
            projectId: request.projectId,
            capability: 'READ_MANIFEST' as const,
            operation: 'READ_MANIFEST' as const,
            outcome: 'succeeded' as const,
          },
        }
      },
    }
    const result = await createSemanticToolRegistry(gateway).call('get_manifest', input())
    expect(result).toMatchObject({ data: { manifestVersion: '1' } })
    expect(calls).toEqual([`gateway:${graph.document.id}`])
  })
})
