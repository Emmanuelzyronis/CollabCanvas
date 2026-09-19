import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { createInvoiceFlowGraph } from '../server/domain/fixtures/invoiceflow'
import { projectInspector } from '../src/graph/graphProjection'
import InspectorPanel from '../src/ui/inspector/InspectorPanel'
import AppShell from '../src/ui/shell/AppShell'
import RightInspector from '../src/ui/shell/RightInspector'

const graph = createInvoiceFlowGraph()

describe('B12 projection-driven Inspector', () => {
  it('renders an explicit empty state for no selection', () => {
    const html = renderToStaticMarkup(createElement(InspectorPanel, { projection: projectInspector(graph) }))
    expect(html).toContain('data-inspector-state="empty"')
    expect(html).toContain('Select an element on the canvas')
    expect(html).not.toContain('button')
  })

  it('renders human-facing design controls before graph metadata', () => {
    const projection = projectInspector(graph, ['node_primary_button'])
    const html = renderToStaticMarkup(createElement(InspectorPanel, { projection }))
    expect(html).toContain('data-inspector-state="single"')
    expect(html).toContain('Create invoice')
    expect(html).toContain('button')
    expect(html).toContain('Create a new invoice')
    expect(html).toContain('focus')
    expect(html).toContain('Primary actions should have strong visual emphasis')
    // Design controls first, then semantic and implementation metadata in the
    // documented priority order (AGENTS.md 12).
    const buttonOrder = [
      'name',
      'appearance',
      'layout',
      'role',
      'content',
      'tokens',
      'responsive',
      'accessibility',
      'interactions',
      'design-intent',
    ]
    const buttonIndexes = buttonOrder.map((section) => html.indexOf(`inspector-section-${section}`))
    buttonIndexes.forEach((index, position) => expect(index, `${buttonOrder[position]} section renders`).toBeGreaterThan(-1))
    for (let position = 1; position < buttonIndexes.length; position += 1) {
      expect(buttonIndexes[position - 1], `${buttonOrder[position - 1]} precedes ${buttonOrder[position]}`).toBeLessThan(buttonIndexes[position]!)
    }

    const headingHtml = renderToStaticMarkup(createElement(InspectorPanel, { projection: projectInspector(graph, ['node_dashboard_title']) }))
    const headingOrder = ['name', 'text', 'typography', 'layout', 'role']
    const headingIndexes = headingOrder.map((section) => headingHtml.indexOf(`inspector-section-${section}`))
    headingIndexes.forEach((index, position) => expect(index, `${headingOrder[position]} section renders`).toBeGreaterThan(-1))
    for (let position = 1; position < headingIndexes.length; position += 1) {
      expect(headingIndexes[position - 1], `${headingOrder[position - 1]} precedes ${headingOrder[position]}`).toBeLessThan(headingIndexes[position]!)
    }
  })

  it('renders canonical component, token, responsive, and intent metadata', () => {
    const html = renderToStaticMarkup(createElement(InspectorPanel, { projection: projectInspector(graph, ['node_metric_card']) }))
    expect(html).toContain('MetricCard')
    expect(html).toContain('color.surface')
    expect(html).toContain('radius.card')
    expect(html).toContain('responsive')
    expect(html).toContain('Metrics should be scannable before the user reads detail.')
  })

  it('summarizes multiple selected elements without exposing editing controls', () => {
    const html = renderToStaticMarkup(createElement(InspectorPanel, { projection: projectInspector(graph, ['node_primary_button', 'node_metric_card']) }))
    expect(html).toContain('data-inspector-state="multiple"')
    expect(html).toContain('2 elements selected')
    expect(html).toContain('Create invoice')
    expect(html).toContain('Revenue metric')
    expect(html).not.toContain('<input')
    expect(html).not.toContain('<select')
    expect(html).not.toContain('<button')
  })

  it('keeps the unavailable state explicit without architecture language', () => {
    const html = renderToStaticMarkup(createElement(RightInspector))
    expect(html).toContain('data-inspector-state="unavailable"')
    expect(html).toContain('Select an element on the canvas')
  })

  it('passes the projection through the accepted shell boundary', () => {
    const html = renderToStaticMarkup(createElement(AppShell, { children: createElement('div', null, 'canvas'), inspectorProjection: projectInspector(graph, ['node_primary_button']) }))
    expect(html).toContain('data-inspector-state="single"')
    expect(html).toContain('Create invoice')
  })

  it('does not traverse or persist graph state in the presentation component', async () => {
    const source = await readFile(new URL('../src/ui/inspector/InspectorPanel.tsx', import.meta.url), 'utf8')
    expect(source).not.toMatch(/DesignGraph|projectInspector\(|localStorage|sessionStorage|indexedDB|fetch\(/)
    expect(source).toContain('onUpdateNode')
    expect(source).toContain('InspectorProjection')
  })
})
