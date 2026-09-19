import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { createInvoiceFlowGraph } from '../server/domain/fixtures/invoiceflow'
import { projectLayers } from '../src/graph/graphProjection'
import LayerTree from '../src/ui/layers/LayerTree'
import LeftPanel from '../src/ui/shell/LeftPanel'

const projection = projectLayers(createInvoiceFlowGraph())

describe('B11 graph-derived Layers tree', () => {
  it('renders canonical hierarchy, ordering, identity, and metadata', () => {
    const html = renderToStaticMarkup(createElement(LayerTree, { projection }))
    expect(html).toContain('role="tree"')
    expect(html).toContain('aria-label="Layers"')
    expect(html.indexOf('Dashboard shell')).toBeLessThan(html.indexOf('Dashboard header'))
    expect(html).toContain('container')
    expect(html).toContain('aria-label="Select Dashboard shell"')
    expect(html).toContain('data-layer-node-id="node_dashboard_shell"')
    expect(html).toContain('data-node-type="container"')
    expect(html).toContain('MetricCard')
    expect(html).toContain('responsive')
    expect(html).toContain('1 interaction')
  })

  it('preserves tree semantics and expand/collapse relationships', () => {
    const html = renderToStaticMarkup(createElement(LayerTree, { projection }))
    expect(html).toContain('role="treeitem"')
    expect(html).toContain('aria-level="1"')
    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('aria-controls="layer-children-node_dashboard_shell"')
    expect(html).toContain('role="group"')
  })

  it('marks only the projected selection as selected', () => {
    const html = renderToStaticMarkup(createElement(LayerTree, { projection, selectedNodeIds: ['node_primary_button'] }))
    expect(html).toContain('aria-label="Select Create invoice"')
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1)
    expect(html).toContain('Create invoice')
  })

  it('shows designer-facing layer guidance instead of architecture language', () => {
    const html = renderToStaticMarkup(createElement(LeftPanel))
    expect(html).toContain('Layers appear here as you add elements')
    expect(html).not.toContain('role="tree"')
    expect(html).not.toMatch(/canonical graph|Projection|Unavailable|graph-backed/i)
  })

  it('does not traverse or persist graph state in the presentation component', async () => {
    const source = await readFile(new URL('../src/ui/layers/LayerTree.tsx', import.meta.url), 'utf8')
    expect(source).not.toMatch(/DesignGraph|localStorage|sessionStorage|indexedDB|fetch\(|projectDesignGraph\(/)
    expect(source).toContain('LayersProjection')
  })
})
