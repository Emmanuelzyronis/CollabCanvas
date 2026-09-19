import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CanvasGraphApplicationService } from '../server/application/canvas-graph-service'
import { createInvoiceFlowGraph } from '../server/domain/fixtures/invoiceflow'
import { MemoryDesignGraphRepository } from '../server/persistence/memory-graph'
import { MemoryDesignRepository } from '../server/persistence/memory'
import { projectInspector } from '../src/graph/graphProjection'
import InspectorPanel from '../src/ui/inspector/InspectorPanel'

describe('Layer 16 token-reference editing', () => {
  it('projects a complete deterministic token catalog for token slots', () => {
    const projection = projectInspector(createInvoiceFlowGraph(), ['node_metric_card'])
    const node = projection.nodes[0]
    expect(node.availableTokens.map((token) => token.name)).toEqual([
      'border.subtle', 'color.action.primary', 'color.surface', 'color.text.onAction',
      'color.text.primary', 'radius.button', 'radius.card', 'radius.pill', 'shadow.card',
      'space.4', 'space.page', 'type.body',
    ])
    expect(node.tokenReferences.map((reference) => reference.slot)).toEqual(['fill', 'radius', 'shadow'])
  })

  it('renders token selectors only as disabled controls without a mutation boundary', () => {
    const projection = projectInspector(createInvoiceFlowGraph(), ['node_metric_card'])
    const readOnly = renderToStaticMarkup(createElement(InspectorPanel, { projection }))
    const editable = renderToStaticMarkup(createElement(InspectorPanel, { projection, onUpdateNode: async () => undefined }))
    expect(readOnly).toContain('aria-label="Token fill"')
    expect(readOnly).toContain('disabled=""')
    expect(editable).toContain('aria-label="Token fill"')
    expect(editable).not.toContain('disabled=""')
    expect(editable).toContain('color.action.primary')
  })

  it('persists a token-reference replacement through the application service', async () => {
    const graph = createInvoiceFlowGraph()
    const resources = new MemoryDesignRepository()
    await resources.createProject(graph.project)
    await resources.createDocument(graph.document)
    const graphs = new MemoryDesignGraphRepository([graph])
    const application = new CanvasGraphApplicationService(resources, graphs)
    const updated = await application.updateNode(graph.document.id, 'node_metric_card', {
      tokenRefs: { ...graph.nodes.find((node) => node.id === 'node_metric_card')!.tokenRefs, fill: 'token_color_action_primary' },
    })
    expect(updated.nodes.find((node) => node.id === 'node_metric_card')?.tokenRefs?.fill).toBe('token_color_action_primary')
    expect((await graphs.getDesignGraph(graph.document.id))?.nodes.find((node) => node.id === 'node_metric_card')?.tokenRefs?.fill).toBe('token_color_action_primary')
  })
})
