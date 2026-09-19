import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createBlankWorkspace } from '../src/application/commands'
import { createNodePayload, positionLayoutPatch, topLevelSelectedIds } from '../src/features/editor/editorCommands'
import { createInvoiceFlowGraph } from '../server/domain/fixtures/invoiceflow'
import NewDesignScreen from '../src/features/home/NewDesignScreen'

describe('EMM-95 human editor slice helpers', () => {
  it('keeps only top-level nodes when deleting or duplicating a selection', () => {
    const graph = createInvoiceFlowGraph()
    const ids = ['node_dashboard_shell', 'node_dashboard_header', 'node_dashboard_title']
    const topLevel = topLevelSelectedIds(graph, ids)
    expect(topLevel).toEqual(['node_dashboard_shell'])
    expect(topLevelSelectedIds(graph, ['node_dashboard_title'])).toEqual(['node_dashboard_title'])
  })

  it('builds a full layout update patch for a committed move', () => {
    const graph = createInvoiceFlowGraph()
    const node = graph.nodes.find((candidate) => candidate.id === 'node_dashboard_title')!
    const patch = positionLayoutPatch(graph, 'node_dashboard_title', 120, 80)
    // Placing by hand is explicit: the node becomes absolutely positioned so a
    // structural parent's flow cannot quietly move it back.
    expect(patch).toEqual({ nodeId: 'node_dashboard_title', patch: { layout: { ...node.layout, position: 'absolute', x: 120, y: 80 } } })
    expect(positionLayoutPatch(graph, 'missing', 0, 0)).toBeNull()
  })

  it('maps insert tools to canonical create payloads', () => {
    const heading = createNodePayload('heading', { x: 10, y: 20, width: 320, height: 56 })
    expect(heading).toMatchObject({ type: 'heading', name: 'Heading', layout: { x: 10, y: 20, width: 320, height: 56 }, semantic: { role: 'heading' } })

    const text = createNodePayload('text', { x: 0, y: 0, width: 220, height: 40 })
    expect(text).toMatchObject({ type: 'text', properties: { text: 'Text' } })

    const box = createNodePayload('box', { x: 0, y: 0, width: 180, height: 120 })
    expect(box).toMatchObject({ type: 'container', layout: { width: 180, height: 120 } })
    expect(box.properties).toBeUndefined()
  })

  it('sends preset creation to the workspace API contract', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toContain('/api/v1/workspaces')
      const body = init?.body === undefined ? undefined : JSON.parse(String(init.body))
      expect(body).toEqual({ preset: 'flyer' })
      return new Response(JSON.stringify({
        data: {
          project: { id: 'p1', name: 'Flyer', slug: 'flyer', createdAt: 't', updatedAt: 't' },
          document: { id: 'd1', projectId: 'p1', name: 'Flyer design', createdAt: 't', updatedAt: 't' },
          page: { id: 'pg1', documentId: 'd1', name: 'Flyer', routeHint: null, createdAt: 't', updatedAt: 't' },
          graph: { page: { id: 'pg1' }, nodes: [] },
          version: { id: 'v1', number: 1, status: 'draft' },
          availability: 'GRAPH_AVAILABLE',
        },
      }), { status: 201, headers: { 'content-type': 'application/json' } })
    }
    await expect(createBlankWorkspace('flyer')).resolves.toMatchObject({ availability: 'GRAPH_AVAILABLE', version: { status: 'draft' } })
    globalThis.fetch = originalFetch
  })

  it('renders a human entry screen with presets instead of graph internals', () => {
    const html = renderToStaticMarkup(createElement(NewDesignScreen))
    expect(html).toContain('Start designing')
    for (const preset of ['blank', 'website', 'flyer', 'logo']) expect(html).toContain(`data-preset="${preset}"`)
    expect(html).toContain('Open the InvoiceFlow demo design')
    expect(html).not.toMatch(/DesignGraph|Design Manifest|WebMCP/)
  })
})
