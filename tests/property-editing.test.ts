import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { CanvasGraphApplicationService } from '../server/application/canvas-graph-service'
import { createInvoiceFlowGraph } from '../server/domain/fixtures/invoiceflow'
import { MemoryDesignGraphRepository } from '../server/persistence/memory-graph'
import { MemoryDesignRepository } from '../server/persistence/memory'
import { projectInspector } from '../src/graph/graphProjection'
import InspectorPanel from '../src/ui/inspector/InspectorPanel'

describe('Layer 15 graph-backed property editing', () => {
  it('renders narrowly scoped semantic editors only when an application command is available', () => {
    const projection = projectInspector(createInvoiceFlowGraph(), ['node_primary_button'])
    const readOnly = renderToStaticMarkup(createElement(InspectorPanel, { projection }))
    const editable = renderToStaticMarkup(createElement(InspectorPanel, { projection, onUpdateNode: async () => undefined }))

    expect(readOnly).toContain('aria-label="Node name"')
    expect(readOnly).toContain('disabled=""')
    expect(editable).toContain('aria-label="Accessible name"')
    expect(editable).toContain('aria-label="Semantic label"')
    expect(editable).not.toContain('disabled=""')
  })

  it('persists name and semantic properties through the application service', async () => {
    const graph = createInvoiceFlowGraph()
    const resources = new MemoryDesignRepository()
    await resources.createProject(graph.project)
    await resources.createDocument(graph.document)
    const graphs = new MemoryDesignGraphRepository([graph])
    const application = new CanvasGraphApplicationService(resources, graphs)

    const updated = await application.updateNode(graph.document.id, 'node_primary_button', {
      name: 'Create billing invoice',
      semantic: { ...graph.nodes.find((node) => node.id === 'node_primary_button')!.semantic, accessibleName: 'Create billing invoice', label: 'Primary invoice action' },
    })

    expect(updated.nodes.find((node) => node.id === 'node_primary_button')).toMatchObject({ name: 'Create billing invoice', semantic: { accessibleName: 'Create billing invoice', label: 'Primary invoice action' } })
    expect((await graphs.getDesignGraph(graph.document.id))?.nodes.find((node) => node.id === 'node_primary_button')?.name).toBe('Create billing invoice')
  })

  it('keeps the inspector outside persistence, graph traversal, and runtime store ownership', async () => {
    const source = await readFile(new URL('../src/ui/inspector/InspectorPanel.tsx', import.meta.url), 'utf8')
    expect(source).not.toMatch(/fetch\(|localStorage|sessionStorage|indexedDB|useCanvasStore|projectInspector\(/)
    expect(source).toContain('onUpdateNode')
    expect(source).toContain("role=\"alert\"")
  })
})
