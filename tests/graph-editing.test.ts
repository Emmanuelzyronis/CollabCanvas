import { once } from 'node:events'
import { describe, expect, it } from 'vitest'
import { createApiServer } from '../server/api/http'
import { CanvasGraphApplicationService } from '../server/application/canvas-graph-service'
import { DesignService } from '../server/application/design-service'
import { createInvoiceFlowGraph } from '../server/domain/fixtures/invoiceflow'
import { MemoryDesignGraphRepository } from '../server/persistence/memory-graph'
import { MemoryDesignRepository } from '../server/persistence/memory'
import { CanvasGraphController } from '../src/graph/canvasGraphController'
import { useCanvasStore } from '../src/store/store'

describe('B13 graph-backed node editing boundary', () => {
  it('updates node layout through the application service and reprojects the canvas', async () => {
    const graph = createInvoiceFlowGraph()
    const resources = new MemoryDesignRepository()
    await resources.createProject(graph.project)
    await resources.createDocument(graph.document)
    const graphs = new MemoryDesignGraphRepository([graph])
    const application = new CanvasGraphApplicationService(resources, graphs)
    const controller = new CanvasGraphController(application, useCanvasStore.getState().loadSnapshot)

    await controller.load(graph.document.id)
    const updated = await controller.updateNode(graph.document.id, 'node_dashboard_title', { layout: { ...graph.nodes.find((node) => node.id === 'node_dashboard_title')!.layout, x: 42, y: 24 } })

    expect(updated.nodes.find((node) => node.id === 'node_dashboard_title')?.layout).toMatchObject({ x: 42, y: 24 })
    expect(useCanvasStore.getState().elements.node_dashboard_title).toMatchObject({ x: 42, y: 24 })
    expect((await graphs.getDesignGraph(graph.document.id))?.nodes.find((node) => node.id === 'node_dashboard_title')?.layout).toMatchObject({ x: 42, y: 24 })
  })

  it('exposes the update command through the scoped API route', async () => {
    const graph = createInvoiceFlowGraph()
    const resources = new MemoryDesignRepository()
    await resources.createProject(graph.project)
    await resources.createDocument(graph.document)
    const graphs = new MemoryDesignGraphRepository([graph])
    const application = new CanvasGraphApplicationService(resources, graphs)
    const server = createApiServer(new DesignService(resources), undefined, undefined, application).listen(0)
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Test server did not expose a port.')
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/documents/${graph.document.id}/nodes/node_dashboard_title/update`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ patch: { layout: { ...graph.nodes.find((node) => node.id === 'node_dashboard_title')!.layout, x: 18 } } }),
    })
    expect(response.status).toBe(201)
    const body = await response.json() as { data: { nodes: Array<{ id: string; layout: { x?: number } }> } }
    expect(body.data.nodes.find((node) => node.id === 'node_dashboard_title')?.layout.x).toBe(18)
    server.close()
  })

  it('enforces minimum dimensions for the resize command', async () => {
    const graph = createInvoiceFlowGraph()
    const resources = new MemoryDesignRepository()
    await resources.createProject(graph.project)
    await resources.createDocument(graph.document)
    const application = new CanvasGraphApplicationService(resources, new MemoryDesignGraphRepository([graph]))

    const resized = await application.resizeNode(graph.document.id, 'node_dashboard_title', 240, 48, 12, 16)
    expect(resized.nodes.find((node) => node.id === 'node_dashboard_title')?.layout).toMatchObject({ x: 12, y: 16, width: 240, height: 48 })
    await expect(application.resizeNode(graph.document.id, 'node_dashboard_title', 7, 48)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })
})
