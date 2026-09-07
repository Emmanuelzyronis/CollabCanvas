import { afterEach, describe, expect, it } from 'vitest'
import { CanvasGraphApplicationService } from '../server/application/canvas-graph-service'
import { createInvoiceFlowGraph } from '../server/domain/fixtures/invoiceflow'
import { MemoryDesignGraphRepository } from '../server/persistence/memory-graph'
import { MemoryDesignRepository } from '../server/persistence/memory'
import { graphToCanvasProjection } from '../src/graph/canvasProjection'
import { CanvasGraphController } from '../src/graph/canvasGraphController'
import { useCanvasStore } from '../src/store/store'

const graph = createInvoiceFlowGraph()

async function makeApplication() {
  const resources = new MemoryDesignRepository()
  const graphs = new MemoryDesignGraphRepository([graph])
  await resources.createProject(graph.project)
  await resources.createDocument(graph.document)
  return { application: new CanvasGraphApplicationService(resources, graphs), graphs }
}

afterEach(() => {
  useCanvasStore.getState().clearBoard()
})

describe('graph-backed canvas vertical slice', () => {
  it('loads a canonical graph and persists move/delete domain operations', async () => {
    const { application, graphs } = await makeApplication()
    const initial = await application.getDocumentGraph(graph.document.id)
    expect(initial.nodes).toHaveLength(graph.nodes.length)

    const moved = await application.moveNode(graph.document.id, 'node_dashboard_title', null)
    expect(moved.nodes.find((node) => node.id === 'node_dashboard_title')?.parentId).toBeNull()
    expect((await graphs.getDesignGraph(graph.document.id))?.nodes.find((node) => node.id === 'node_dashboard_title')?.parentId).toBeNull()

    const deleted = await application.deleteNode(graph.document.id, 'node_invoice_table')
    expect(deleted.nodes.some((node) => node.id === 'node_invoice_table')).toBe(false)
    expect(deleted.nodes.some((node) => node.id === 'node_status_badge')).toBe(false)
    expect((await graphs.getDesignGraph(graph.document.id))?.nodes.some((node) => node.id === 'node_invoice_table')).toBe(false)
  })

  it('projects load, move, and delete results into the existing Zustand canvas state', async () => {
    const { application } = await makeApplication()
    const controller = new CanvasGraphController(application, useCanvasStore.getState().loadSnapshot)

    const loaded = await controller.load(graph.document.id)
    const loadedState = useCanvasStore.getState()
    expect(loadedState.order).toEqual(graphToCanvasProjection(loaded).order)
    expect(loadedState.elements['node_dashboard_title']?.groupId).toBe('node_dashboard_header')

    const moved = await controller.moveNode(graph.document.id, 'node_dashboard_title', null)
    expect(moved.nodes.find((node) => node.id === 'node_dashboard_title')?.parentId).toBeNull()
    expect(useCanvasStore.getState().elements['node_dashboard_title']?.groupId).toBeNull()

    await controller.deleteNode(graph.document.id, 'node_invoice_table')
    const finalState = useCanvasStore.getState()
    expect(finalState.elements['node_invoice_table']).toBeUndefined()
    expect(finalState.elements['node_status_badge']).toBeUndefined()
    expect(controller.currentGraph?.nodes.some((node) => node.id === 'node_invoice_table')).toBe(false)
  })

  it('re-projects the same graph deterministically and keeps canvas state non-canonical', async () => {
    const { application } = await makeApplication()
    const controller = new CanvasGraphController(application, useCanvasStore.getState().loadSnapshot)

    await controller.load(graph.document.id)
    const first = JSON.stringify(useCanvasStore.getState().getSnapshot())
    useCanvasStore.getState().elements['node_dashboard_shell'].x = 999
    await controller.load(graph.document.id)
    const second = JSON.stringify(useCanvasStore.getState().getSnapshot())

    expect(second).toBe(first)
    expect(controller.currentGraph?.nodes.find((node) => node.id === 'node_dashboard_shell')?.layout.x).toBe(0)
  })

  it('keeps the production hydration limitation explicit', async () => {
    const resources = new MemoryDesignRepository()
    await resources.createProject(graph.project)
    await resources.createDocument(graph.document)
    const unavailable = new CanvasGraphApplicationService(resources, new MemoryDesignGraphRepository())
    await expect(unavailable.getDocumentGraph(graph.document.id)).rejects.toMatchObject({ code: 'GRAPH_UNAVAILABLE' })
  })
})
