import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createInvoiceFlowGraph } from '../server/domain/fixtures/invoiceflow'
import { projectInspector, projectLayers } from '../src/graph/graphProjection'
import LayerTree from '../src/ui/layers/LayerTree'
import InspectorPanel from '../src/ui/inspector/InspectorPanel'
import LeftPanel from '../src/ui/shell/LeftPanel'
import RightInspector from '../src/ui/shell/RightInspector'
import StatusBar from '../src/ui/shell/StatusBar'
import AppShell from '../src/ui/shell/AppShell'
import { CapabilityOverview } from '../src/features/overview'
import { WorkspaceProvider } from '../src/workspace'
import StartSurface from '../src/features/editor/StartSurface'

const graph = createInvoiceFlowGraph()

/** Vocabulary that describes how the product is built, never what the human is designing. */
const ARCHITECTURE_TERMS = /design graph|graph node|canonical graph|graph-backed|webmcp|agent gateway|agent center|manifest|projection|command bus|node id|composition-instance/gi
/** Internal identity must never be printed where a person can read it. */
const RAW_IDENTIFIERS = /\bnode_[a-z0-9_]+|\bpage_[a-z0-9_]+|\bgraph_[a-z0-9_]+/g

/** Only what a person can actually read counts as exposed. */
function visibleText(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ')
}

function assertHumanFacing(html: string, surface: string): void {
  const text = visibleText(html)
  expect(text.match(ARCHITECTURE_TERMS), `${surface} leaks architecture vocabulary`).toBeNull()
  expect(text.match(RAW_IDENTIFIERS), `${surface} leaks an internal identifier`).toBeNull()
}

describe('the human editor never exposes the architecture', () => {
  it('opens an empty design with a description box rather than a dead end', () => {
    const html = renderToStaticMarkup(createElement(WorkspaceProvider, null, createElement(StartSurface, { onInsertAt: () => {} })))
    expect(html).toContain('What do you want to build?')
    expect(html).toContain('Or start from scratch')
    assertHumanFacing(html, 'StartSurface')
  })

  it('renders a layer tree in designer language only', () => {
    const html = renderToStaticMarkup(createElement(LayerTree, { projection: projectLayers(graph) }))
    expect(html).toContain('Create invoice')
    assertHumanFacing(html, 'LayerTree')
    // The internal node taxonomy is not a designer-facing word.
    expect(visibleText(html)).not.toMatch(/\b(SECTION|CONTAINER|COMPONENT-INSTANCE|HEADING|TEXT|BUTTON|CARD)\b/)
  })

  it('renders the layers panel in designer language with and without a selection', () => {
    const empty = renderToStaticMarkup(createElement(LeftPanel))
    expect(empty).toContain('Layers appear here as you add elements')
    assertHumanFacing(empty, 'LeftPanel (no layers)')

    const filled = renderToStaticMarkup(createElement(LeftPanel, { layersProjection: projectLayers(graph) }))
    assertHumanFacing(filled, 'LeftPanel (layers)')
  })

  it('renders every inspector state in designer language', () => {
    assertHumanFacing(renderToStaticMarkup(createElement(RightInspector)), 'inspector (unavailable)')
    assertHumanFacing(renderToStaticMarkup(createElement(InspectorPanel, { projection: projectInspector(graph) })), 'inspector (empty)')
    assertHumanFacing(renderToStaticMarkup(createElement(InspectorPanel, { projection: projectInspector(graph, ['node_primary_button']) })), 'inspector (single)')

    const multiple = renderToStaticMarkup(createElement(InspectorPanel, { projection: projectInspector(graph, ['node_primary_button', 'node_metric_card']) }))
    expect(multiple).toContain('2 elements selected')
    expect(multiple).not.toContain('nodes selected')
    assertHumanFacing(multiple, 'inspector (multiple)')
  })

  it('keeps the assembled shell free of architecture language', () => {
    const html = renderToStaticMarkup(createElement(AppShell, {
      children: createElement('div', null, 'canvas'),
      layersProjection: projectLayers(graph),
      inspectorProjection: projectInspector(graph, ['node_dashboard_title']),
    }))
    expect(html).toContain('Create invoice')
    assertHumanFacing(html, 'AppShell')
  })

  it('describes backend capabilities on the overview surface in design language', () => {
    const html = renderToStaticMarkup(createElement(WorkspaceProvider, {
      initialIdentifiers: { projectId: 'p', documentId: 'd', pageId: 'pg' },
      children: createElement(CapabilityOverview),
    }))
    for (const promise of ['Draw and arrange elements', 'Hand the design to a coding agent', 'Ask the design assistant']) {
      expect(html).toContain(promise)
    }
    assertHumanFacing(html, 'CapabilityOverview')
  })

  it('keeps the status bar free of architecture language', () => {
    assertHumanFacing(renderToStaticMarkup(createElement(StatusBar, { workspaceStatus: 'GRAPH_AVAILABLE' })), 'StatusBar')
  })
})
