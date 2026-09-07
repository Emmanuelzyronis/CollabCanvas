import { describe, expect, it } from 'vitest'
import { createInvoiceFlowGraph } from '../server/domain/fixtures/invoiceflow'
import { GraphValidationError } from '../server/domain/graph-validation'
import { compileDesignManifest, ManifestCompilationError } from '../server/domain/manifest-compiler'
import { serializeDesignManifest } from '../server/domain/manifest-serialization'
import { graphToCanvasProjection } from '../src/graph/canvasProjection'

describe('Design Manifest compiler', () => {
  it('compiles the InvoiceFlow graph into a coherent agent-facing contract', () => {
    const manifest = compileDesignManifest(createInvoiceFlowGraph())

    expect(manifest.manifestVersion).toBe('1')
    expect(manifest.project).toMatchObject({ id: 'project_invoiceflow', name: 'InvoiceFlow' })
    expect(manifest.document).toMatchObject({ id: 'doc_invoiceflow', projectId: 'project_invoiceflow' })
    expect(manifest.pages[0].rootNodeIds).toEqual(['node_dashboard_shell'])
    expect(manifest.nodes.find((node) => node.id === 'node_dashboard_header')?.parentId).toBe('node_dashboard_shell')
    expect(manifest.nodes.find((node) => node.id === 'node_dashboard_shell')?.children).toEqual([
      'node_dashboard_header',
      'node_metric_grid',
      'node_invoice_table',
    ])
    expect(manifest.componentDefinitions.map((item) => item.name)).toContain('PrimaryButton')
    expect(manifest.componentInstances.find((item) => item.id === 'instance_primary_button')?.definitionId).toBe('component_primary_button')
    expect(manifest.tokens.some((token) => token.category === 'spacing')).toBe(true)
    expect(manifest.typography.find((item) => item.id === 'type_heading_1')?.fontFamily).toBe('Inter')
    expect(manifest.nodes.find((node) => node.id === 'node_metric_grid')?.responsive).toHaveLength(3)
    expect(manifest.nodes.find((node) => node.id === 'node_primary_button')?.accessibility?.focusable).toBe(true)
    expect(manifest.intents.find((intent) => intent.id === 'intent_primary_action')?.statement).toContain('visual emphasis')
  })

  it('validates the graph before compilation and reports missing context clearly', () => {
    const graph = createInvoiceFlowGraph()
    const invalid = { ...graph, tokens: [] }
    expect(() => compileDesignManifest(invalid)).toThrow(GraphValidationError)

    const withoutContext = { ...graph, project: undefined }
    expect(() => compileDesignManifest(withoutContext as unknown as typeof graph)).toThrowError(ManifestCompilationError)
    expect(() => compileDesignManifest(withoutContext as unknown as typeof graph)).toThrow(/project and document identities/)

    const mismatched = { ...graph, document: { ...graph.document, projectId: 'other-project' } }
    expect(() => compileDesignManifest(mismatched)).toThrowError(ManifestCompilationError)
    expect(() => compileDesignManifest(mismatched)).toThrow(/identities do not agree/)
  })

  it('produces identical manifest objects and bytes for repeated compilation', () => {
    const graph = createInvoiceFlowGraph()
    const first = compileDesignManifest(graph)
    const second = compileDesignManifest(graph)
    expect(second).toEqual(first)
    expect(serializeDesignManifest(first)).toBe(serializeDesignManifest(second))
  })

  it('normalizes collection and hierarchy ordering independently of input order', () => {
    const graph = createInvoiceFlowGraph()
    const shuffled = {
      ...graph,
      nodes: [...graph.nodes].reverse(),
      componentDefinitions: [...graph.componentDefinitions].reverse(),
      componentInstances: [...graph.componentInstances].reverse(),
      tokens: [...graph.tokens].reverse(),
      typography: [...graph.typography].reverse(),
      assets: [...graph.assets].reverse(),
      intents: [...graph.intents].reverse(),
    }

    const manifest = compileDesignManifest(graph)
    const shuffledManifest = compileDesignManifest(shuffled)
    expect(serializeDesignManifest(shuffledManifest)).toBe(serializeDesignManifest(manifest))
    expect(shuffledManifest.nodes.map((node) => node.id)).toEqual(manifest.nodes.map((node) => node.id))
  })

  it('preserves layout constraints separately from optional editor geometry', () => {
    const manifest = compileDesignManifest(createInvoiceFlowGraph())
    const shell = manifest.nodes.find((node) => node.id === 'node_dashboard_shell')
    expect(shell?.geometry).toEqual({ x: 0, y: 0 })
    expect(shell?.layout).toMatchObject({ display: 'flex', direction: 'column', width: 'fill' })
    expect(shell?.layout).not.toHaveProperty('x')
    expect(shell?.layout).not.toHaveProperty('y')
  })

  it('does not depend on the canvas projection or Zustand runtime state', () => {
    const graph = createInvoiceFlowGraph()
    const baseline = serializeDesignManifest(compileDesignManifest(graph))
    const projection = graphToCanvasProjection(graph)
    projection.elements[0].x = 9999
    projection.elements[0].fill = '#ff00ff'
    projection.order.reverse()
    expect(serializeDesignManifest(compileDesignManifest(graph))).toBe(baseline)
  })

  it('does not expose graph timestamps or obvious secret-shaped properties', () => {
    const graph = createInvoiceFlowGraph()
    graph.nodes[0].properties = { ...graph.nodes[0].properties, apiKey: 'do-not-export', visible: 'keep' }
    const manifest = compileDesignManifest(graph)
    const serialized = serializeDesignManifest(manifest)
    expect(serialized).not.toContain('do-not-export')
    expect(serialized).not.toContain('createdAt')
    expect(serialized).toContain('visible')
  })
})
