import { once } from 'node:events'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createApiServer } from '../server/api/http'
import { CanvasGraphApplicationService } from '../server/application/canvas-graph-service'
import { DesignService } from '../server/application/design-service'
import { createInvoiceFlowGraph } from '../server/domain/fixtures/invoiceflow'
import { MemoryDesignGraphRepository } from '../server/persistence/memory-graph'
import { MemoryDesignRepository } from '../server/persistence/memory'
import { PostgresDesignRepository } from '../server/persistence/postgres'
import { newDb } from 'pg-mem'
import { fetchWorkspaceGraph, resolveWorkspaceIdentifiers } from '../src/workspace/WorkspaceContext'

describe('B7 workspace context and canonical graph hydration', () => {
  it('resolves durable project/document/page identity from query or route state', () => {
    expect(resolveWorkspaceIdentifiers({ search: '?projectId=p&documentId=d&pageId=pg', pathname: '/' })).toEqual({ projectId: 'p', documentId: 'd', pageId: 'pg' })
    expect(resolveWorkspaceIdentifiers({ search: '', pathname: '/projects/p/documents/d/pages/pg' })).toEqual({ projectId: 'p', documentId: 'd', pageId: 'pg' })
    expect(resolveWorkspaceIdentifiers({ search: '', pathname: '/' })).toBeNull()
  })

  it('hydrates the complete graph through the scoped application/API path', async () => {
    const graph = createInvoiceFlowGraph()
    const resources = new MemoryDesignRepository()
    await resources.createProject(graph.project)
    await resources.createDocument(graph.document)
    await resources.createPage(graph.page)
    const graphs = new MemoryDesignGraphRepository([graph])
    const application = new CanvasGraphApplicationService(resources, graphs)
    const server = createApiServer(new DesignService(resources), undefined, undefined, application).listen(0)
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Test server did not expose a port.')
    const base = `http://127.0.0.1:${address.port}`
    const response = await fetch(`${base}/api/v1/projects/${graph.project.id}/documents/${graph.document.id}/pages/${graph.page.id}/graph`)
    expect(response.status).toBe(200)
    const body = await response.json() as { data: { graph: typeof graph; availability: string } }
    expect(body.data.availability).toBe('GRAPH_AVAILABLE')
    expect(body.data.graph.project.id).toBe(graph.project.id)
    expect(body.data.graph.componentDefinitions.length).toBeGreaterThan(0)
    server.close()
  })

  it('rejects cross-scope graph ownership and reports unavailable graphs without fallback', async () => {
    const graph = createInvoiceFlowGraph()
    const resources = new MemoryDesignRepository()
    await resources.createProject(graph.project)
    await resources.createDocument(graph.document)
    await resources.createPage(graph.page)
    const mismatched = { ...graph, document: { ...graph.document, projectId: 'other-project' } }
    const application = new CanvasGraphApplicationService(resources, new MemoryDesignGraphRepository([mismatched]))
    await expect(application.getWorkspaceGraph(graph.project.id, graph.document.id, graph.page.id)).rejects.toMatchObject({ code: 'GRAPH_UNAVAILABLE' })
    const unavailable = new CanvasGraphApplicationService(resources, new MemoryDesignGraphRepository())
    await expect(unavailable.getWorkspaceGraph(graph.project.id, graph.document.id, graph.page.id)).rejects.toMatchObject({ code: 'GRAPH_UNAVAILABLE' })
  })

  it('persists and reads the complete graph with the PostgreSQL adapter', async () => {
    const database = newDb({ autoCreateForeignKeyIndices: true })
    database.public.none(readFileSync(new URL('../db/migrations/001_initial.sql', import.meta.url), 'utf8'))
    database.public.none(readFileSync(new URL('../db/migrations/003_design_graphs.sql', import.meta.url), 'utf8'))
    const { Pool } = database.adapters.createPg()
    const pool = new Pool()
    const repository = new PostgresDesignRepository(pool)
    const graph = createInvoiceFlowGraph()
    await repository.createProject(graph.project)
    await repository.createDocument(graph.document)
    await repository.createPage(graph.page)
    await repository.saveDesignGraph(graph)
    const hydrated = await repository.getDesignGraph(graph.document.id)
    expect(hydrated).toEqual(graph)
    await pool.end()
  })

  it('hydrates the complete graph through PostgreSQL, application, and HTTP boundaries', async () => {
    const database = newDb({ autoCreateForeignKeyIndices: true })
    database.public.none(readFileSync(new URL('../db/migrations/001_initial.sql', import.meta.url), 'utf8'))
    database.public.none(readFileSync(new URL('../db/migrations/003_design_graphs.sql', import.meta.url), 'utf8'))
    const { Pool } = database.adapters.createPg()
    const pool = new Pool()
    const repository = new PostgresDesignRepository(pool)
    const graph = createInvoiceFlowGraph()
    await repository.createProject(graph.project)
    await repository.createDocument(graph.document)
    await repository.createPage(graph.page)
    await repository.saveDesignGraph(graph)

    const application = new CanvasGraphApplicationService(repository, repository)
    const server = createApiServer(new DesignService(repository), undefined, undefined, application).listen(0)
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Test server did not expose a port.')
    const base = `http://127.0.0.1:${address.port}`

    const response = await fetch(`${base}/api/v1/projects/${graph.project.id}/documents/${graph.document.id}/pages/${graph.page.id}/graph`)
    expect(response.status).toBe(200)
    const body = await response.json() as { data: { project: typeof graph.project; document: typeof graph.document; page: typeof graph.page; graph: typeof graph; availability: string } }
    expect(body.data.availability).toBe('GRAPH_AVAILABLE')
    expect(body.data.project.id).toBe(graph.project.id)
    expect(body.data.document.id).toBe(graph.document.id)
    expect(body.data.page.id).toBe(graph.page.id)
    expect(body.data.graph.nodes.map((node) => node.id)).toEqual(graph.nodes.map((node) => node.id))
    expect(body.data.graph.componentDefinitions.map((component) => component.id)).toEqual(graph.componentDefinitions.map((component) => component.id))
    expect(body.data.graph.nodes.find((node) => node.id === 'node_primary_button')?.componentInstanceId).toBe('instance_primary_button')

    const previousWindow = (globalThis as typeof globalThis & { window?: unknown }).window
    Object.defineProperty(globalThis, 'window', { value: { __COLLABCANVAS_API_BASE__: base }, configurable: true })
    await expect(fetchWorkspaceGraph({ projectId: graph.project.id, documentId: graph.document.id, pageId: graph.page.id })).resolves.toMatchObject({
      project: { id: graph.project.id },
      document: { id: graph.document.id },
      page: { id: graph.page.id },
      graph: { nodes: expect.arrayContaining([expect.objectContaining({ id: 'node_primary_button' })]) },
      availability: 'GRAPH_AVAILABLE',
    })
    if (previousWindow === undefined) Reflect.deleteProperty(globalThis, 'window')
    else Object.defineProperty(globalThis, 'window', { value: previousWindow, configurable: true })

    const wrongProject = await fetch(`${base}/api/v1/projects/not-the-project/documents/${graph.document.id}/pages/${graph.page.id}/graph`)
    expect(wrongProject.status).toBe(404)
    const wrongPage = await fetch(`${base}/api/v1/projects/${graph.project.id}/documents/${graph.document.id}/pages/not-the-page/graph`)
    expect(wrongPage.status).toBe(404)

    server.close()
    await pool.end()
  })

  it('returns INVALID_GRAPH from the PostgreSQL/API path instead of fabricating a fallback', async () => {
    const database = newDb({ autoCreateForeignKeyIndices: true })
    database.public.none(readFileSync(new URL('../db/migrations/001_initial.sql', import.meta.url), 'utf8'))
    database.public.none(readFileSync(new URL('../db/migrations/003_design_graphs.sql', import.meta.url), 'utf8'))
    const { Pool } = database.adapters.createPg()
    const pool = new Pool()
    const repository = new PostgresDesignRepository(pool)
    const graph = createInvoiceFlowGraph()
    await repository.createProject(graph.project)
    await repository.createDocument(graph.document)
    await repository.createPage(graph.page)
    const invalidGraph = { ...graph, nodes: [{ ...graph.nodes[0], parentId: 'missing-parent' }] }
    await pool.query(
      'INSERT INTO design_graphs (document_id, project_id, page_id, graph, updated_at) VALUES ($1, $2, $3, $4::jsonb, $5)',
      [graph.document.id, graph.project.id, graph.page.id, JSON.stringify(invalidGraph), graph.document.updatedAt],
    )

    const application = new CanvasGraphApplicationService(repository, repository)
    const server = createApiServer(new DesignService(repository), undefined, undefined, application).listen(0)
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Test server did not expose a port.')
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/projects/${graph.project.id}/documents/${graph.document.id}/pages/${graph.page.id}/graph`)
    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'INVALID_GRAPH' } })
    server.close()
    await pool.end()
  })

  it('maps the client fetch contract to explicit failure categories', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: 'INVALID_GRAPH', message: 'Graph validation failed.' } }), { status: 422, headers: { 'content-type': 'application/json' } })
    await expect(fetchWorkspaceGraph({ projectId: 'p', documentId: 'd', pageId: 'pg' })).rejects.toMatchObject({ code: 'INVALID_GRAPH', status: 422 })
    globalThis.fetch = originalFetch
  })

  it('wires the canonical graph through B8 into the existing B9/B11/B12 surfaces', async () => {
    const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
    expect(appSource).toContain('projectDesignGraph(context.graph, selection)')
    expect(appSource).toContain('loadGraphIntoCanvas(context.graph')
    expect(appSource).toContain('layersProjection={projection?.layers}')
    expect(appSource).toContain('inspectorProjection={projection?.inspector}')
    expect(appSource).toContain('<EditorWorkspace />')
    expect(appSource).not.toContain('seedWelcomeBoard')
    const editorSource = readFileSync(new URL('../src/features/editor/EditorWorkspace.tsx', import.meta.url), 'utf8')
    expect(editorSource).toContain('<CanvasShell')
    const topBarSource = readFileSync(new URL('../src/ui/shell/TopBar.tsx', import.meta.url), 'utf8')
    expect(topBarSource).not.toContain('Welcome canvas')
    expect(topBarSource).not.toContain('Canvas workspace · Draft')
  })
})
