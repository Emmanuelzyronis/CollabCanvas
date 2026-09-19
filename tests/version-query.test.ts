import { once } from 'node:events'
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { newDb } from 'pg-mem'
import { createApiServer } from '../server/api/http'
import { CanvasGraphApplicationService } from '../server/application/canvas-graph-service'
import { DesignService } from '../server/application/design-service'
import { VersioningApplicationService } from '../server/application/version-service'
import { createInvoiceFlowGraph } from '../server/domain/fixtures/invoiceflow'
import { MemoryDesignGraphRepository } from '../server/persistence/memory-graph'
import { MemoryDesignRepository } from '../server/persistence/memory'
import { MemoryVersionRepository } from '../server/persistence/memory-versions'
import { PostgresDesignRepository, PostgresVersionRepository } from '../server/persistence/postgres'
import { fetchVersionComparison, resolveVersionComparisonTarget } from '../src/workspace/WorkspaceContext'

async function memoryVersions() {
  const graph = createInvoiceFlowGraph()
  const resources = new MemoryDesignRepository()
  await resources.createProject(graph.project)
  await resources.createDocument(graph.document)
  await resources.createPage(graph.page)
  const graphs = new MemoryDesignGraphRepository([graph])
  const versions = new MemoryVersionRepository()
  let sequence = 0
  const versioning = new VersioningApplicationService(resources, graphs, versions, { id: () => `version-${++sequence}`, now: () => '2026-09-08T00:00:00.000Z' })
  const initialDraft = await versioning.createDraft(graph.document.id, 'designer')
  const initial = await versioning.approveVersion(initialDraft.id, 'reviewer')
  await versioning.createDraft(graph.document.id, 'designer')
  const canvas = new CanvasGraphApplicationService(resources, graphs, versioning)
  await canvas.moveNode(graph.document.id, 'node_dashboard_title', null)
  const changedDraft = (await versioning.listVersions(graph.document.id)).find((version) => version.status === 'draft')!
  const changed = await versioning.approveVersion(changedDraft.id, 'reviewer')
  return { graph, resources, graphs, versioning, initial, changed }
}

describe('version query boundary', () => {
  it('exposes list and semantic comparison through the scoped API contract', async () => {
    const { graph, resources, versioning, initial, changed } = await memoryVersions()
    const server = createApiServer(new DesignService(resources), undefined, undefined, undefined, versioning).listen(0)
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Test server did not expose a port.')
    const base = `http://127.0.0.1:${address.port}`

    const listResponse = await fetch(`${base}/api/v1/documents/${encodeURIComponent(graph.document.id)}/versions`)
    expect(listResponse.status).toBe(200)
    const listBody = await listResponse.json() as { data: Array<{ id: string; status: string }> }
    expect(listBody.data.map((version) => version.id)).toEqual([initial.id, changed.id])

    const compareResponse = await fetch(`${base}/api/v1/versions/${encodeURIComponent(initial.id)}/compare/${encodeURIComponent(changed.id)}`)
    expect(compareResponse.status).toBe(200)
    const compareBody = await compareResponse.json() as { data: { fromVersionId: string; toVersionId: string; fieldChanges: Array<{ path: string }> } }
    expect(compareBody.data.fromVersionId).toBe(initial.id)
    expect(compareBody.data.toVersionId).toBe(changed.id)
    expect(compareBody.data.fieldChanges).toContainEqual(expect.objectContaining({ path: 'parentId' }))
    server.close()
  })

  it('reports an unconfigured version service without a fallback result', async () => {
    const service = new DesignService(new MemoryDesignRepository())
    const server = createApiServer(service).listen(0)
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Test server did not expose a port.')
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/versions/v1/compare/v2`)
    expect(response.status).toBe(503)
    expect((await response.json() as { error: { code: string } }).error.code).toBe('GRAPH_UNAVAILABLE')
    server.close()
  })

  it('persists versions and proposals with the PostgreSQL adapter', async () => {
    const database = newDb({ autoCreateForeignKeyIndices: true })
    database.public.none(readFileSync(new URL('../db/migrations/001_initial.sql', import.meta.url), 'utf8'))
    const versionMigration = readFileSync(new URL('../db/migrations/002_versioning.sql', import.meta.url), 'utf8').replace(/CREATE OR REPLACE FUNCTION[\s\S]*$/, '')
    for (const statement of versionMigration.split(';')) {
      if (statement.trim()) database.public.none(statement)
    }
    database.public.none(readFileSync(new URL('../db/migrations/003_design_graphs.sql', import.meta.url), 'utf8'))
    const { Pool } = database.adapters.createPg()
    const pool = new Pool()
    const repository = new PostgresDesignRepository(pool)
    const versions = new PostgresVersionRepository(pool)
    const graph = createInvoiceFlowGraph()
    await repository.createProject(graph.project)
    await repository.createDocument(graph.document)
    await repository.createPage(graph.page)
    await repository.saveDesignGraph(graph)
    let sequence = 0
    const versioning = new VersioningApplicationService(repository, repository, versions, { id: () => `pg-version-${++sequence}`, now: () => '2026-09-08T00:00:00.000Z' })
    const draft = await versioning.createDraft(graph.document.id, 'designer')
    const approved = await versioning.approveVersion(draft.id, 'reviewer')
    const proposal = await versioning.createProposal({
      projectId: graph.project.id,
      documentId: graph.document.id,
      baseVersionId: approved.id,
      operations: [{ type: 'moveNode', nodeId: 'node_dashboard_title', parentId: null }],
      rationale: 'Promote the title.',
      author: 'copilot',
    })
    await versioning.approveProposal(proposal.id, 'reviewer')

    const persistedVersions = await versions.listVersions(graph.document.id)
    expect(persistedVersions.map((version) => version.status)).toEqual(['approved', 'draft'])
    expect((await versions.getProposal(proposal.id))?.status).toBe('approved')
    await pool.end()
  })

  it('resolves comparison targets and maps client query failures explicitly', async () => {
    expect(resolveVersionComparisonTarget({ search: '?fromVersion=v1&toVersion=v2' })).toEqual({ fromVersionId: 'v1', toVersionId: 'v2' })
    expect(resolveVersionComparisonTarget({ search: '?fromVersion=v1' })).toBeNull()

    vi.stubGlobal('window', { __COLLABCANVAS_API_BASE__: 'http://api.test' })
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { code: 'VERSION_CONFLICT', message: 'The selected versions cannot be compared.' } }), { status: 409, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchVersionComparison({ fromVersionId: 'v1', toVersionId: 'v2' })).rejects.toMatchObject({ code: 'VERSION_CONFLICT', status: 409 })
    expect(fetchMock).toHaveBeenCalledWith('http://api.test/api/v1/versions/v1/compare/v2', { signal: undefined })
    vi.unstubAllGlobals()
  })

  it('exposes scoped draft creation and approval commands without weakening stale-version rules', async () => {
    const graph = createInvoiceFlowGraph()
    const resources = new MemoryDesignRepository()
    await resources.createProject(graph.project)
    await resources.createDocument(graph.document)
    await resources.createPage(graph.page)
    const graphs = new MemoryDesignGraphRepository([graph])
    const versions = new MemoryVersionRepository()
    const versioning = new VersioningApplicationService(resources, graphs, versions, { id: (() => { let n = 0; return () => `route-${++n}` })(), now: () => '2026-09-08T00:00:00.000Z' })
    const server = createApiServer(new DesignService(resources), undefined, undefined, undefined, versioning).listen(0)
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Test server did not expose a port.')
    const base = `http://127.0.0.1:${address.port}`
    const scoped = `/api/v1/projects/${graph.project.id}/documents/${graph.document.id}`
    const draftResponse = await fetch(`${base}${scoped}/versions/draft`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ createdBy: 'designer' }) })
    expect(draftResponse.status).toBe(201)
    const draft = (await draftResponse.json() as { data: { id: string; status: string } }).data
    expect(draft.status).toBe('draft')
    const approvedResponse = await fetch(`${base}${scoped}/versions/${draft.id}/approve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ approvedBy: 'reviewer' }) })
    expect(approvedResponse.status).toBe(201)
    expect((await approvedResponse.json() as { data: { status: string } }).data.status).toBe('approved')
    const wrongScope = await fetch(`${base}/api/v1/projects/other-project/documents/${graph.document.id}/versions/draft`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ createdBy: 'designer' }) })
    expect(wrongScope.status).toBe(404)
    server.close()
  })

  it('exposes scoped proposal review and returns VERSION_CONFLICT for a stale approval', async () => {
    const graph = createInvoiceFlowGraph()
    const resources = new MemoryDesignRepository()
    await resources.createProject(graph.project); await resources.createDocument(graph.document); await resources.createPage(graph.page)
    const graphs = new MemoryDesignGraphRepository([graph])
    const versions = new MemoryVersionRepository()
    const versioning = new VersioningApplicationService(resources, graphs, versions, { id: (() => { let n = 0; return () => `proposal-route-${++n}` })(), now: () => '2026-09-08T00:00:00.000Z' })
    const approved = await versioning.approveVersion((await versioning.createDraft(graph.document.id, 'designer')).id, 'reviewer')
    const stale = await versioning.createProposal({ projectId: graph.project.id, documentId: graph.document.id, baseVersionId: approved.id, operations: [{ type: 'deleteNode', nodeId: 'node_status_badge' }], rationale: 'Remove badge.', author: 'agent-one' })
    const current = await versioning.createProposal({ projectId: graph.project.id, documentId: graph.document.id, baseVersionId: approved.id, operations: [{ type: 'moveNode', nodeId: 'node_dashboard_title', parentId: null }], rationale: 'Promote title.', author: 'agent-two' })
    const server = createApiServer(new DesignService(resources), undefined, undefined, undefined, versioning).listen(0)
    await once(server, 'listening')
    const address = server.address(); if (!address || typeof address === 'string') throw new Error('Test server did not expose a port.')
    const root = `http://127.0.0.1:${address.port}/api/v1/projects/${graph.project.id}/documents/${graph.document.id}/proposals`
    expect((await fetch(`${root}/${stale.id}`)).status).toBe(200)
    const accepted = await fetch(`${root}/${current.id}/approve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reviewedBy: 'reviewer' }) })
    expect(accepted.status).toBe(201)
    const newDraft = (await accepted.json() as { data: { version: { id: string } } }).data.version
    await versioning.approveVersion(newDraft.id, 'reviewer')
    const conflict = await fetch(`${root}/${stale.id}/approve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reviewedBy: 'reviewer' }) })
    expect(conflict.status).toBe(409)
    expect((await conflict.json() as { error: { code: string } }).error.code).toBe('VERSION_CONFLICT')
    const wrongScope = await fetch(`http://127.0.0.1:${address.port}/api/v1/projects/other-project/documents/${graph.document.id}/proposals/${stale.id}`)
    expect(wrongScope.status).toBe(404)
    server.close()
  })
})
