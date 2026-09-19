import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { createInvoiceFlowGraph } from '../server/domain/fixtures/invoiceflow'
import CanvasShell from '../src/canvas/CanvasShell'
import { createCanvasShellModel } from '../src/graph/canvasShell'
import { graphToCanvasProjection } from '../src/graph/canvasProjection'
import { projectDesignGraph } from '../src/graph/graphProjection'
import { loadGraphIntoCanvas } from '../src/graph/canvasStoreAdapter'
import { useCanvasStore } from '../src/store/store'

describe('B9 canvas shell projection boundary', () => {
  it('joins B8 metadata to the existing renderer by canonical identity and order', () => {
    const graph = createInvoiceFlowGraph()
    const projection = projectDesignGraph(graph)
    const renderer = graphToCanvasProjection(graph)
    const shell = createCanvasShellModel(projection, renderer)

    expect(shell.identity.documentId).toBe(graph.document.id)
    expect(shell.nodeOrder).toEqual(projection.nodeOrder)
    expect(shell.nodes.map((node) => node.id)).toEqual(projection.nodeOrder)
    expect(shell.nodes.find((node) => node.id === 'node_dashboard_title')).toMatchObject({
      id: 'node_dashboard_title',
      type: 'heading',
      renderIndex: projection.nodeOrder.indexOf('node_dashboard_title'),
      parentId: 'node_dashboard_header',
      metadata: { type: 'heading', semanticRole: 'heading' },
      geometry: { x: renderer.elements.find((element) => element.id === 'node_dashboard_title')?.x, y: renderer.elements.find((element) => element.id === 'node_dashboard_title')?.y },
      rendererElement: { id: 'node_dashboard_title', type: 'text' },
    })
  })

  it('rejects a renderer projection that changes canonical ordering or identity', () => {
    const graph = createInvoiceFlowGraph()
    const projection = projectDesignGraph(graph)
    const renderer = graphToCanvasProjection(graph)
    expect(() => createCanvasShellModel(projection, { ...renderer, order: [...renderer.order].reverse() })).toThrow(/canonical graph order/)
    expect(() => createCanvasShellModel(projection, { ...renderer, elements: renderer.elements.slice(1) })).toThrow(/canonical graph order/)
  })

  it('does not mutate B8 output or create persistent document state', async () => {
    const graph = createInvoiceFlowGraph()
    const projection = projectDesignGraph(graph)
    const renderer = graphToCanvasProjection(graph)
    const shell = createCanvasShellModel(projection, renderer)
    expect(Object.isFrozen(shell)).toBe(true)
    expect(Object.isFrozen(shell.nodes)).toBe(true)
    expect(Object.isFrozen(shell.nodes[0]?.rendererElement)).toBe(true)
    expect(shell.nodes[0]?.id).toBe(projection.nodeOrder[0])

    const source = await readFile(new URL('../src/graph/canvasShell.ts', import.meta.url), 'utf8')
    expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB|zustand|useCanvasStore/)
  })

  it('mounts the existing SVG renderer inside a contained canvas workspace boundary', () => {
    const html = renderToStaticMarkup(createElement(CanvasShell))
    expect(html).toContain('aria-label="Design canvas"')
    expect(html).toContain('<svg')
    expect(html).toContain('overflow-hidden')
  })

  it('keeps camera, viewport, zoom, pan, and gesture concerns out of the shell model', async () => {
    const modelSource = await readFile(new URL('../src/graph/canvasShell.ts', import.meta.url), 'utf8')
    const componentSource = await readFile(new URL('../src/canvas/CanvasShell.tsx', import.meta.url), 'utf8')
    expect(modelSource).not.toMatch(/camera|viewport|zoom|pan|gesture/i)
    expect(componentSource).not.toMatch(/useCanvasStore|camera|viewport|zoom|pan|gesture/i)
  })

  it('loads renderer data without replacing transient camera or viewport state', () => {
    const store = useCanvasStore.getState()
    store.setCamera({ x: 17, y: 29, zoom: 1.25 })
    store.setViewport(768, 1024)

    loadGraphIntoCanvas(createInvoiceFlowGraph(), store.loadSnapshot)
    expect(useCanvasStore.getState().camera).toEqual({ x: 17, y: 29, zoom: 1.25 })
    expect(useCanvasStore.getState().viewport).toEqual({ width: 768, height: 1024 })

    useCanvasStore.getState().panBy(10, -5)
    useCanvasStore.getState().zoomTo(1.5)
    expect(useCanvasStore.getState().camera.zoom).toBe(1.5)
  })
})
