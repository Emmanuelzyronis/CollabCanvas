import { describe, expect, it } from 'vitest'
import { createInvoiceFlowGraph } from '../server/domain/fixtures/invoiceflow'
import { buildIntelligenceContext, canUseIntelligence } from '../src/features/intelligence'
import { runCommand } from '../src/agent/runner'

const graph = createInvoiceFlowGraph()
const scope = { projectId: graph.project.id, documentId: graph.document.id, pageId: graph.page.id }

describe('Layer 18 frontend trust and intelligence boundary', () => {
  it('consumes only a validated hydrated graph and preserves identity and relationships', () => {
    const context = buildIntelligenceContext({ availability: 'GRAPH_AVAILABLE', identifiers: scope, graph, selectedNodeIds: ['node_primary_button'] })
    expect(canUseIntelligence(context)).toBe(true)
    expect(context.scope).toEqual(scope)
    expect(context.selectedNodeIds).toEqual(['node_primary_button'])
    expect(context.nodeRelationships.node_primary_button).toEqual({ parentId: 'node_dashboard_header', childIds: [] })
    expect(context.projection?.identity).toEqual(scope)
    expect(context.graph?.nodes.map((node) => node.id)).toEqual(graph.nodes.map((node) => node.id))
  })

  it.each([
    ['GRAPH_LOADING', null],
    ['GRAPH_UNAVAILABLE', null],
    ['GRAPH_INVALID', null],
  ] as const)('does not fabricate intelligence context for %s', (availability, inputGraph) => {
    const context = buildIntelligenceContext({ availability, identifiers: scope, graph: inputGraph })
    expect(canUseIntelligence(context)).toBe(false)
    expect(context.graph).toBeNull()
    expect(context.projection).toBeNull()
    expect(context.selectedNodeIds).toEqual([])
    expect(context.nodeRelationships).toEqual({})
  })

  it('rejects invalid graph data at the intelligence boundary', () => {
    const invalid = { ...graph, nodes: [{ ...graph.nodes[0], parentId: 'missing-parent' }] }
    const context = buildIntelligenceContext({ availability: 'GRAPH_AVAILABLE', identifiers: scope, graph: invalid })
    expect(context.state).toBe('GRAPH_INVALID')
    expect(canUseIntelligence(context)).toBe(false)
  })

  it('rejects a hydrated graph outside the requested project/page scope', () => {
    const context = buildIntelligenceContext({ availability: 'GRAPH_AVAILABLE', identifiers: { ...scope, projectId: 'other-project' }, graph })
    expect(context.state).toBe('GRAPH_INVALID')
    expect(context.graph).toBeNull()
  })

  it('does not use runtime selection or canvas state as canonical graph data', async () => {
    const source = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../src/features/intelligence/trustBoundary.ts', import.meta.url), 'utf8'))
    expect(source).not.toMatch(/zustand|useCanvasStore|CanvasElement|localStorage|sessionStorage/)
    expect(source).toContain('projectDesignGraph')
  })

  it('blocks agent-facing intelligence when the canonical graph is unavailable', async () => {
    const context = buildIntelligenceContext({ availability: 'GRAPH_UNAVAILABLE', identifiers: scope, graph: null })
    await expect(runCommand('What is on the board?', undefined, context)).resolves.toMatchObject({ ok: false })
  })
})
