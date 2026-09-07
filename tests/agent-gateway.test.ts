import { once } from 'node:events'
import { describe, expect, it } from 'vitest'
import { createApiServer } from '../server/api/http'
import { ManifestApplicationService } from '../server/application/manifest-service'
import { createInvoiceFlowGraph } from '../server/domain/fixtures/invoiceflow'
import { serializeDesignManifest } from '../server/domain/manifest-serialization'
import { MemoryDesignGraphRepository } from '../server/persistence/memory-graph'
import { MemoryDesignRepository } from '../server/persistence/memory'
import { AgentGateway, GatewayError, type GatewayRequest } from '../server/gateway'
import { DevelopmentGatewayAuthenticator } from '../server/gateway/auth'
import type { DesignManifest } from '../server/domain/manifest-types'

const graph = createInvoiceFlowGraph()

function request(overrides: Partial<GatewayRequest> = {}): GatewayRequest {
  return {
    requestId: 'request-test',
    credential: 'dev-secret',
    projectId: graph.project.id,
    documentId: graph.document.id,
    capability: 'READ_MANIFEST',
    ...overrides,
  }
}

function authenticator(overrides: Partial<Parameters<DevelopmentGatewayAuthenticator['register']>[0]> = {}) {
  const auth = new DevelopmentGatewayAuthenticator()
  auth.register({ id: 'credential-1', agentId: 'agent-codex', projectIds: [graph.project.id], capabilities: ['READ_MANIFEST'], secret: 'dev-secret', ...overrides })
  return auth
}

function manifestStub(): { calls: string[]; app: { getDocumentManifest(documentId: string): Promise<DesignManifest> } } {
  const calls: string[] = []
  return {
    calls,
    app: {
      getDocumentManifest: async (documentId: string) => {
        calls.push(documentId)
        return {
          manifestVersion: '1',
          project: { id: graph.project.id, name: graph.project.name, slug: graph.project.slug },
          document: { id: graph.document.id, projectId: graph.project.id, name: graph.document.name },
          pages: [], nodes: [], componentDefinitions: [], componentInstances: [], tokens: [], typography: [], assets: [], intents: [],
        }
      },
    },
  }
}

describe('AgentGateway', () => {
  it('authenticates, scopes, authorizes, and delegates READ_MANIFEST', async () => {
    const stub = manifestStub()
    const gateway = new AgentGateway(authenticator(), stub.app)
    const result = await gateway.readManifest(request())

    expect(result.data.project.id).toBe(graph.project.id)
    expect(stub.calls).toEqual([graph.document.id])
    expect(result.auditContext).toMatchObject({ agentId: 'agent-codex', projectId: graph.project.id, capability: 'READ_MANIFEST', outcome: 'succeeded' })
    expect(Object.isFrozen(result.auditContext)).toBe(true)
  })

  it.each([
    ['missing credentials', request({ credential: undefined }), 'UNAUTHENTICATED'],
    ['invalid credentials', request({ credential: 'wrong-secret' }), 'INVALID_CREDENTIAL'],
    ['out-of-scope project', request({ projectId: 'other-project' }), 'PROJECT_SCOPE_DENIED'],
  ])('%s is rejected', async (_label, input, code) => {
    const stub = manifestStub()
    const gateway = new AgentGateway(authenticator(), stub.app)
    await expect(gateway.readManifest(input)).rejects.toMatchObject({ code })
    expect(stub.calls).toHaveLength(0)
  })

  it('rejects inactive credentials and credentials without READ_MANIFEST', async () => {
    const inactive = authenticator({ active: false })
    const inactiveGateway = new AgentGateway(inactive, manifestStub().app)
    await expect(inactiveGateway.readManifest(request())).rejects.toMatchObject({ code: 'INVALID_CREDENTIAL' })

    const noCapability = authenticator({ capabilities: [] })
    const noCapabilityGateway = new AgentGateway(noCapability, manifestStub().app)
    await expect(noCapabilityGateway.readManifest(request())).rejects.toMatchObject({ code: 'CAPABILITY_DENIED' })
  })

  it('rejects a document whose trusted manifest identity does not match the requested project', async () => {
    const mismatched: DesignManifest = {
      manifestVersion: '1',
      project: { id: 'other-project', name: 'Other', slug: 'other' },
      document: { id: graph.document.id, projectId: 'other-project', name: graph.document.name },
      pages: [], nodes: [], componentDefinitions: [], componentInstances: [], tokens: [], typography: [], assets: [], intents: [],
    }
    const gateway = new AgentGateway(authenticator(), { getDocumentManifest: async () => mismatched })
    await expect(gateway.readManifest(request())).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' })
  })

  it('maps application failures to safe upstream errors', async () => {
    const gateway = new AgentGateway(authenticator(), {
      getDocumentManifest: async () => { throw new Error('database password=secret') },
    })
    await expect(gateway.readManifest(request())).rejects.toMatchObject({ code: 'UPSTREAM_APPLICATION_ERROR' })
    try {
      await gateway.readManifest(request())
    } catch (error) {
      expect(error).toBeInstanceOf(GatewayError)
      expect((error as GatewayError).message).not.toContain('password')
      expect(JSON.stringify((error as GatewayError).auditContext)).not.toContain('secret')
    }
  })
})

describe('Agent Gateway HTTP contract', () => {
  async function start() {
    const resources = new MemoryDesignRepository()
    await resources.createProject(graph.project)
    await resources.createDocument(graph.document)
    const app = new ManifestApplicationService(resources, new MemoryDesignGraphRepository([graph]))
    const auth = authenticator()
    const gateway = new AgentGateway(auth, app)
    const server = createApiServer({} as never, undefined, gateway).listen(0)
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Test server did not expose a port.')
    return { server, base: `http://127.0.0.1:${address.port}`, app }
  }

  it('requires credentials and returns the application manifest through a distinct namespace', async () => {
    const { server, base, app } = await start()
    const missing = await fetch(`${base}/api/v1/gateway/manifest?projectId=${graph.project.id}&documentId=${graph.document.id}`)
    expect(missing.status).toBe(401)
    expect(await missing.json()).toMatchObject({ error: { code: 'UNAUTHENTICATED' } })

    const response = await fetch(`${base}/api/v1/gateway/manifest?projectId=${graph.project.id}&documentId=${graph.document.id}`, { headers: { authorization: 'Bearer dev-secret' } })
    expect(response.status).toBe(200)
    const body = await response.json() as { data: DesignManifest; meta: { requestId: string } }
    expect(body.data.document.id).toBe(graph.document.id)
    expect(serializeDesignManifest(body.data)).toBe(serializeDesignManifest(await app.getDocumentManifest(graph.document.id)))
    expect(body.meta.requestId).toBeTruthy()
    server.close()
  })

  it('maps scope and capability failures without exposing credentials', async () => {
    const { server, base } = await start()
    const response = await fetch(`${base}/api/v1/gateway/manifest?projectId=other-project&documentId=${graph.document.id}`, { headers: { authorization: 'Bearer dev-secret' } })
    expect(response.status).toBe(403)
    const body = await response.text()
    expect(body).toContain('PROJECT_SCOPE_DENIED')
    expect(body).not.toContain('dev-secret')
    server.close()
  })
})
