import { once } from 'node:events'
import { describe, expect, it } from 'vitest'
import { createApiServer } from '../server/api/http'
import { DesignService } from '../server/application/design-service'
import { MemoryDesignRepository } from '../server/persistence/memory'

describe('persistence API contract', () => {
  it('creates and retrieves project, document, page, and graph resources', async () => {
    let sequence = 0
    const service = new DesignService(new MemoryDesignRepository(), {
      id: () => `api-${++sequence}`,
      now: () => '2026-09-05T00:00:00.000Z',
    })
    const server = createApiServer(service).listen(0)
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Test server did not expose a port.')
    const base = `http://127.0.0.1:${address.port}`

    const create = async (path: string, body: unknown) => fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const projectResponse = await create('/api/v1/projects', { name: 'API project' })
    expect(projectResponse.status).toBe(201)
    const projectBody = await projectResponse.json() as { data: { id: string } }
    const projectId = projectBody.data.id

    const documentResponse = await create(`/api/v1/projects/${projectId}/documents`, { name: 'API document' })
    expect(documentResponse.status).toBe(201)
    const documentId = (await documentResponse.json() as { data: { id: string } }).data.id

    const pageResponse = await create(`/api/v1/documents/${documentId}/pages`, { name: 'API page' })
    expect(pageResponse.status).toBe(201)
    const pageId = (await pageResponse.json() as { data: { id: string } }).data.id

    const nodeResponse = await create(`/api/v1/pages/${pageId}/nodes`, { type: 'section', name: 'Root' })
    expect(nodeResponse.status).toBe(201)
    const nodeId = (await nodeResponse.json() as { data: { id: string } }).data.id

    const pageGet = await fetch(`${base}/api/v1/pages/${pageId}`)
    expect(pageGet.status).toBe(200)
    const pageBody = await pageGet.json() as { data: { nodes: Array<{ id: string }>; serialized: string }; meta: { apiVersion: string } }
    expect(pageBody.data.nodes[0].id).toBe(nodeId)
    expect(pageBody.data.serialized).toContain('"nodes"')
    expect(pageBody.meta.apiVersion).toBe('v1')

    const invalidParent = await create(`/api/v1/pages/${pageId}/nodes`, { parentId: 'missing', type: 'text', name: 'Invalid' })
    expect(invalidParent.status).toBe(400)
    expect((await invalidParent.json() as { error: { code: string } }).error.code).toBe('INVALID_REFERENCE')

    const missing = await fetch(`${base}/api/v1/projects/missing`)
    expect(missing.status).toBe(404)
    expect((await missing.json() as { error: { code: string } }).error.code).toBe('NOT_FOUND')

    const malformed = await fetch(`${base}/api/v1/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not-json',
    })
    expect(malformed.status).toBe(400)
    expect((await malformed.json() as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR')
    server.close()
  })
})
