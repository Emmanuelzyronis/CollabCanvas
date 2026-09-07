import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import type { DesignGraph } from '../server/domain/contracts'
import { createInvoiceFlowGraph } from '../server/domain/fixtures/invoiceflow'
import { serializeDesignGraph } from '../server/domain/serialization'
import { graphToCanvasProjection } from '../src/graph/canvasProjection'
import {
  GraphProjectionError,
  projectDesignGraph,
  projectInspector,
  projectLayers,
  projectSelection,
} from '../src/graph/graphProjection'

function emptyGraph(): DesignGraph {
  const stamp = '2026-09-07T00:00:00.000Z'
  const project = { id: 'project-empty', name: 'Empty', slug: 'empty', createdAt: stamp, updatedAt: stamp }
  const document = { id: 'document-empty', projectId: project.id, name: 'Empty document', createdAt: stamp, updatedAt: stamp }
  return {
    project,
    document,
    page: { id: 'page-empty', documentId: document.id, name: 'Empty page', routeHint: null, createdAt: stamp, updatedAt: stamp },
    nodes: [],
    componentDefinitions: [],
    componentInstances: [],
    tokens: [],
    typography: [],
    assets: [],
    intents: [],
  }
}

describe('Layer 03 graph projection', () => {
  it('projects canonical identity, hierarchy, ordering, and node metadata', () => {
    const graph = createInvoiceFlowGraph()
    const projection = projectDesignGraph(graph)

    expect(projection.identity).toEqual({
      projectId: graph.project.id,
      documentId: graph.document.id,
      pageId: graph.page.id,
    })
    expect(projection.layers.roots.map((node) => node.id)).toEqual(['node_dashboard_shell'])
    expect(projection.layers.roots[0]?.children.map((node) => node.id)).toEqual([
      'node_dashboard_header',
      'node_metric_grid',
      'node_invoice_table',
    ])
    expect(projection.nodes.node_dashboard_title).toMatchObject({
      id: 'node_dashboard_title',
      parentId: 'node_dashboard_header',
      type: 'heading',
      semanticRole: 'heading',
      accessibleName: 'Outstanding invoices',
    })
    expect(projection.nodes.node_primary_button.component).toMatchObject({
      instanceId: 'instance_primary_button',
      definitionId: 'component_primary_button',
      definitionName: 'PrimaryButton',
    })
  })

  it('preserves hierarchy and sibling order independently of graph array order', () => {
    const graph = createInvoiceFlowGraph()
    const shuffled = { ...graph, nodes: [...graph.nodes].reverse() }

    expect(projectDesignGraph(shuffled).nodeOrder).toEqual(projectDesignGraph(graph).nodeOrder)
    expect(projectLayers(shuffled)).toEqual(projectLayers(graph))
  })

  it('resolves selection by canonical node identity and reports missing references', () => {
    const graph = createInvoiceFlowGraph()
    const selection = projectSelection(graph, [
      'node_status_badge',
      'missing-node',
      'node_dashboard_header',
      'node_status_badge',
    ])

    expect(selection.requestedIds).toEqual(['node_status_badge', 'missing-node', 'node_dashboard_header'])
    expect(selection.selectedIds).toEqual(['node_status_badge', 'node_dashboard_header'])
    expect(selection.primaryNodeId).toBe('node_status_badge')
    expect(selection.missingNodeIds).toEqual(['missing-node'])
    expect(selection.nodes.map((node) => node.id)).toEqual(selection.selectedIds)

    const layers = projectLayers(graph, selection.requestedIds)
    expect(findLayer(layers.roots, 'node_status_badge')).toMatchObject({ selected: true, selectionIndex: 0 })
    expect(findLayer(layers.roots, 'node_dashboard_header')).toMatchObject({ selected: true, selectionIndex: 1 })
  })

  it('provides an Inspector-readable projection without adding editing behavior', () => {
    const inspector = projectInspector(createInvoiceFlowGraph(), ['node_primary_button'])
    const node = inspector.nodes[0]

    expect(inspector).toMatchObject({ mode: 'single', count: 1, primaryNodeId: 'node_primary_button' })
    expect(node?.ancestry.map((ancestor) => ancestor.id)).toEqual(['node_dashboard_shell', 'node_dashboard_header'])
    expect(node?.semantic).toMatchObject({ role: 'button', accessibleName: 'Create invoice' })
    expect(node?.componentDefinition?.name).toBe('PrimaryButton')
    expect(node?.interactions).toEqual([{ type: 'click', intent: 'Create a new invoice' }])
    expect(node?.accessibility).toMatchObject({ role: 'button', keyboard: 'button', focusable: true })
    expect(node?.intents.map((intent) => intent.id)).toEqual(['intent_primary_action'])

    expect(projectInspector(createInvoiceFlowGraph(), []).mode).toBe('none')
    expect(projectInspector(createInvoiceFlowGraph(), ['node_dashboard_title', 'node_primary_button']).mode).toBe('multiple')
  })

  it('handles an empty graph without fabricating nodes or selection', () => {
    const projection = projectDesignGraph(emptyGraph(), ['missing-node'])
    expect(projection.nodeOrder).toEqual([])
    expect(projection.nodes).toEqual({})
    expect(projection.layers.roots).toEqual([])
    expect(projection.selection).toMatchObject({ selectedIds: [], missingNodeIds: ['missing-node'], primaryNodeId: null })
    expect(projection.inspector).toMatchObject({ mode: 'none', count: 0, nodes: [] })
  })

  it('rejects invalid graph references and ownership explicitly', () => {
    const graph = createInvoiceFlowGraph()
    const dangling = {
      ...graph,
      nodes: graph.nodes.map((node) => node.id === 'node_dashboard_title' ? { ...node, parentId: 'missing-parent' } : node),
    }
    expect(() => projectDesignGraph(dangling)).toThrowError(GraphProjectionError)
    try {
      projectDesignGraph(dangling)
    } catch (error) {
      expect(error).toBeInstanceOf(GraphProjectionError)
      expect((error as GraphProjectionError).issues.map((issue) => issue.code)).toContain('DANGLING_PARENT')
    }

    const wrongOwner = { ...graph, page: { ...graph.page, documentId: 'other-document' } }
    expect(() => projectDesignGraph(wrongOwner)).toThrowError(/Page does not belong to the projected document/)

    expect(() => projectDesignGraph(undefined as unknown as DesignGraph)).toThrowError(/Project, document, and page identities are required/)
    expect(() => projectDesignGraph({ ...graph, nodes: undefined } as unknown as DesignGraph)).toThrowError(/Graph collections must be present as arrays/)
  })

  it('is deterministic, detached, frozen, and does not mutate canonical graph state', () => {
    const graph = createInvoiceFlowGraph()
    const before = serializeDesignGraph(graph)
    const first = projectDesignGraph(graph, ['node_primary_button'])
    const second = projectDesignGraph(structuredClone(graph), ['node_primary_button'])

    expect(second).toEqual(first)
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.inspector.nodes[0]?.layout)).toBe(true)
    expect(() => {
      ;(first.inspector.nodes[0]!.layout as { width?: number | string }).width = 999
    }).toThrow()
    expect(serializeDesignGraph(graph)).toBe(before)
  })

  it('keeps the existing canvas runtime on the shared canonical node order', () => {
    const graph = createInvoiceFlowGraph()
    expect(graphToCanvasProjection(graph).order).toEqual(projectDesignGraph(graph).nodeOrder)
  })

  it('does not import persistent frontend state into the projection boundary', async () => {
    const source = await readFile(new URL('../src/graph/graphProjection.ts', import.meta.url), 'utf8')
    expect(source).not.toMatch(/zustand|useCanvasStore|localStorage|sessionStorage|indexedDB/)
  })
})

function findLayer(nodes: readonly { id: string; children: readonly unknown[] }[], id: string): Record<string, unknown> | null {
  for (const node of nodes) {
    if (node.id === id) return node as unknown as Record<string, unknown>
    const found = findLayer(node.children as readonly { id: string; children: readonly unknown[] }[], id)
    if (found) return found
  }
  return null
}
