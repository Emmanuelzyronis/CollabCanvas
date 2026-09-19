import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFile } from 'node:fs/promises'
import { afterEach, describe, expect, it } from 'vitest'
import { createInvoiceFlowGraph } from '../server/domain/fixtures/invoiceflow'
import Canvas from '../src/canvas/Canvas'
import { describeSelection, reduceSelection } from '../src/canvas/selection/selectionModel'
import { graphToCanvasShell } from '../src/graph/canvasShell'
import { loadGraphIntoCanvas } from '../src/graph/canvasStoreAdapter'
import { projectSelection } from '../src/graph/graphProjection'
import { useCanvasStore } from '../src/store/store'

afterEach(() => {
  useCanvasStore.getState().clearBoard()
})

describe('B10 graph-identity selection', () => {
  it('reduces replacement, toggle, clear, and select-all deterministically', () => {
    const available = ['node-a', 'node-b', 'node-c']
    const selected = reduceSelection([], { type: 'replace', nodeIds: ['node-b', 'missing', 'node-b', 'node-a'] }, available)
    expect(selected).toEqual(['node-b', 'node-a'])
    expect(reduceSelection(selected, { type: 'toggle', nodeId: 'node-c' }, available)).toEqual(['node-b', 'node-a', 'node-c'])
    expect(reduceSelection(selected, { type: 'toggle', nodeId: 'node-b' }, available)).toEqual(['node-a'])
    expect(reduceSelection(selected, { type: 'toggle', nodeId: 'missing' }, available)).toEqual(selected)
    expect(reduceSelection(selected, { type: 'clear' }, available)).toEqual([])
    expect(reduceSelection([], { type: 'select-all' }, available)).toEqual(available)
  })

  it('describes none, single, and multiple selection with a stable primary identity', () => {
    expect(describeSelection([], null, 'idle')).toMatchObject({ mode: 'none', primaryNodeId: null })
    expect(describeSelection(['node-a'], 'node-b', 'selecting')).toMatchObject({ mode: 'single', primaryNodeId: 'node-a', hoveredNodeId: 'node-b', interaction: 'selecting' })
    expect(describeSelection(['node-b', 'node-a'], null, 'dragging')).toMatchObject({ mode: 'multiple', primaryNodeId: 'node-b', interaction: 'dragging' })
  })

  it('preserves the same canonical IDs through B8, B9, and runtime selection', () => {
    const graph = createInvoiceFlowGraph()
    const selectedNodeIds = ['node_primary_button', 'node_dashboard_title']
    const projected = projectSelection(graph, selectedNodeIds)
    const shell = graphToCanvasShell(graph, selectedNodeIds)

    expect(shell.selection).toEqual(projected)
    expect(shell.selection.selectedIds).toEqual(selectedNodeIds)
    expect(shell.nodes.filter((node) => selectedNodeIds.includes(node.id)).map((node) => node.id)).toEqual(['node_dashboard_title', 'node_primary_button'])

    loadGraphIntoCanvas(graph, useCanvasStore.getState().loadSnapshot)
    useCanvasStore.getState().setSelection([...selectedNodeIds, 'missing-node'])
    expect(useCanvasStore.getState().selection).toEqual(selectedNodeIds)
  })

  it('keeps selection and interaction state transient and outside board snapshots', () => {
    const graph = createInvoiceFlowGraph()
    loadGraphIntoCanvas(graph, useCanvasStore.getState().loadSnapshot)
    const store = useCanvasStore.getState()
    store.setSelection(['node_dashboard_title'])
    store.setHoveredNode('node_primary_button')
    store.setSelectionInteraction('editing')

    expect(useCanvasStore.getState()).toMatchObject({
      selection: ['node_dashboard_title'],
      hoveredNodeId: 'node_primary_button',
      selectionInteraction: 'editing',
    })
    expect(useCanvasStore.getState().getSnapshot()).not.toHaveProperty('selection')
    expect(useCanvasStore.getState().getSnapshot()).not.toHaveProperty('hoveredNodeId')
    expect(useCanvasStore.getState().getSnapshot()).not.toHaveProperty('selectionInteraction')
  })

  it('exposes selection identity and state at the existing SVG runtime boundary', async () => {
    const html = renderToStaticMarkup(createElement(Canvas))
    const source = await readFile(new URL('../src/canvas/Canvas.tsx', import.meta.url), 'utf8')

    expect(html).toContain('data-selection-mode="none"')
    expect(source).toContain('data-primary-node-id={selectionState.primaryNodeId ?? undefined}')
    expect(source).toContain('data-canvas-node-id={id}')
    expect(source).toContain("data-selected={selectedNodeIds.has(id) ? 'true' : undefined}")
    expect(source).toContain("data-hovered={hoveredNodeId === id ? 'true' : undefined}")
    expect(source).toContain('data-selection-overlay="true"')
    expect(source).toContain('aria-label="Canvas interaction surface"')
  })

  it('has no persistence or canonical graph ownership dependency', async () => {
    const source = await readFile(new URL('../src/canvas/selection/selectionModel.ts', import.meta.url), 'utf8')
    expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB|zustand|DesignGraph|persistence/)
  })
})
