import { once } from 'node:events'
import { describe, expect, it } from 'vitest'
import { createApiServer } from '../server/api/http'
import { DesignService } from '../server/application/design-service'
import { ManifestApplicationService } from '../server/application/manifest-service'
import { createInvoiceFlowGraph } from '../server/domain/fixtures/invoiceflow'
import { compileDesignManifest } from '../server/domain/manifest-compiler'
import { serializeDesignManifest } from '../server/domain/manifest-serialization'
import { MemoryDesignGraphRepository } from '../server/persistence/memory-graph'
import { MemoryDesignRepository } from '../server/persistence/memory'

function makeResources() {
  const resources = new MemoryDesignRepository()
  const graph = createInvoiceFlowGraph()
  return { resources, graph }
}

describe('ManifestApplicationService', () => {
  it('retrieves a deterministic manifest through the application boundary', async () => {
    const { resources, graph } = makeResources()
    await resources.createProject(graph.project)
    await resources.createDocument(graph.document)
    const service = new ManifestApplicationService(resources, new MemoryDesignGraphRepository([graph]))

    const first = await service.getDocumentManifest(graph.document.id)
    const second = await service.getDocumentManifest(graph.document.id)

    expect(first.project.id).toBe(graph.project.id)
    expect(first.document.id).toBe(graph.document.id)
    expect(serializeDesignManifest(first)).toBe(serializeDesignManifest(second))
  })

  it('rejects unknown documents and unavailable graph sources without fabricating output', async () => {
    const resources = new MemoryDesignRepository()
    const service = new ManifestApplicationService(resources, new MemoryDesignGraphRepository())

    await expect(service.getDocumentManifest('missing')).rejects.toMatchObject({ code: 'NOT_FOUND' })

    const graph = createInvoiceFlowGraph()
    await resources.createProject(graph.project)
    await resources.createDocument(graph.document)
    await expect(service.getDocumentManifest(graph.document.id)).rejects.toMatchObject({ code: 'GRAPH_UNAVAILABLE' })
  })

  it('maps invalid canonical graphs to a typed application failure', async () => {
    const { resources, graph } = makeResources()
    await resources.createProject(graph.project)
    await resources.createDocument(graph.document)
    const invalid = { ...graph, tokens: [] }
    const service = new ManifestApplicationService(resources, new MemoryDesignGraphRepository([invalid]))

    await expect(service.getDocumentManifest(graph.document.id)).rejects.toMatchObject({ code: 'INVALID_GRAPH' })
  })

  it('delegates compilation to compileDesignManifest', async () => {
    const { resources, graph } = makeResources()
    await resources.createProject(graph.project)
    await resources.createDocument(graph.document)
    const service = new ManifestApplicationService(resources, new MemoryDesignGraphRepository([graph]))
    // The application result is compared with the canonical compiler output;
    // this guards against a second hand-assembled manifest path.
    const manifest = await service.getDocumentManifest(graph.document.id)
    expect(manifest).toEqual(compileDesignManifest(graph))
  })
})

describe('Manifest API contract', () => {
  async function startApi(manifestGraph = createInvoiceFlowGraph()) {
    const resources = new MemoryDesignRepository()
    await resources.createProject(manifestGraph.project)
    await resources.createDocument(manifestGraph.document)
    const graphRepository = new MemoryDesignGraphRepository([manifestGraph])
    const designService = new DesignService(resources, { id: () => 'unused', now: () => '2026-09-05T00:00:00.000Z' })
    const manifestService = new ManifestApplicationService(resources, graphRepository)
    const server = createApiServer(designService, manifestService).listen(0)
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Test server did not expose a port.')
    return { server, base: `http://127.0.0.1:${address.port}`, graph: manifestGraph }
  }

  it('returns the typed manifest from the canonical document-scoped route', async () => {
    const { server, base, graph } = await startApi()
    const response = await fetch(`${base}/api/v1/documents/${graph.document.id}/manifest`)
    expect(response.status).toBe(200)
    const body = await response.json() as { data: { manifestVersion: string; project: { id: string }; document: { id: string } }; meta: { apiVersion: string; requestId: string } }
    expect(body.data.manifestVersion).toBe('1')
    expect(body.data.project.id).toBe(graph.project.id)
    expect(body.data.document.id).toBe(graph.document.id)
    expect(body.meta.apiVersion).toBe('v1')
    expect(body.meta.requestId).toBeTruthy()
    server.close()
  })

  it('returns deterministic JSON for repeated retrievals', async () => {
    const { server, base, graph } = await startApi()
    const first = await fetch(`${base}/api/v1/documents/${graph.document.id}/manifest`)
    const second = await fetch(`${base}/api/v1/documents/${graph.document.id}/manifest`)
    const firstBody = await first.json() as { data: unknown }
    const secondBody = await second.json() as { data: unknown }
    expect(JSON.stringify(firstBody.data)).toBe(JSON.stringify(secondBody.data))
    server.close()
  })

  it('returns typed not-found, unavailable, and invalid-request errors without internals', async () => {
    const { server, base } = await startApi()
    const missing = await fetch(`${base}/api/v1/documents/missing/manifest`)
    expect(missing.status).toBe(404)
    expect(await missing.json()).toMatchObject({ error: { code: 'NOT_FOUND' } })

    const invalidRequest = await fetch(`${base}/api/v1/documents/%20/manifest`)
    expect(invalidRequest.status).toBe(400)
    const invalidBody = await invalidRequest.json() as { error: { code: string; message: string } }
    expect(invalidBody.error.code).toBe('VALIDATION_ERROR')
    expect(invalidBody.error.message).not.toContain('at ')
    server.close()

    const resources = new MemoryDesignRepository()
    const graph = createInvoiceFlowGraph()
    await resources.createProject(graph.project)
    await resources.createDocument(graph.document)
    const unavailableService = new ManifestApplicationService(resources, new MemoryDesignGraphRepository())
    const designService = new DesignService(resources)
    const unavailableServer = createApiServer(designService, unavailableService).listen(0)
    await once(unavailableServer, 'listening')
    const unavailableAddress = unavailableServer.address()
    if (!unavailableAddress || typeof unavailableAddress === 'string') throw new Error('Test server did not expose a port.')
    const unavailable = await fetch(`http://127.0.0.1:${unavailableAddress.port}/api/v1/documents/${graph.document.id}/manifest`)
    expect(unavailable.status).toBe(503)
    expect(await unavailable.json()).toMatchObject({ error: { code: 'GRAPH_UNAVAILABLE' } })
    unavailableServer.close()
  })

  it('maps invalid graph failures without exposing stack traces', async () => {
    const graph = createInvoiceFlowGraph()
    const resources = new MemoryDesignRepository()
    await resources.createProject(graph.project)
    await resources.createDocument(graph.document)
    const invalid = { ...graph, tokens: [] }
    const service = new DesignService(resources)
    const manifestService = new ManifestApplicationService(resources, new MemoryDesignGraphRepository([invalid]))
    const server = createApiServer(service, manifestService).listen(0)
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Test server did not expose a port.')
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/documents/${graph.document.id}/manifest`)
    expect(response.status).toBe(422)
    const body = await response.json() as { error: { code: string; message: string; details?: { issues?: unknown[] } } }
    expect(body.error.code).toBe('INVALID_GRAPH')
    expect(body.error.details?.issues).toBeInstanceOf(Array)
    expect(JSON.stringify(body)).not.toContain('GraphValidationError')
    server.close()
  })
})
