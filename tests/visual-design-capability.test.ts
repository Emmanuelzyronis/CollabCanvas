import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CanvasGraphApplicationService } from '../server/application/canvas-graph-service'
import { EditorCommandApplicationService } from '../server/application/editor-command-service'
import { DesignGraphHistory, EditorHistoryApplicationService } from '../server/application/editor-history-service'
import { VersioningApplicationService } from '../server/application/version-service'
import { HumanWorkspaceService } from '../server/application/workspace-service'
import { MemoryDesignGraphRepository } from '../server/persistence/memory-graph'
import { MemoryDesignRepository } from '../server/persistence/memory'
import { MemoryVersionRepository } from '../server/persistence/memory-versions'
import { createNodePayload } from '../src/features/editor/editorCommands'
import { graphToCanvasProjection } from '../src/graph/canvasProjection'
import { projectInspector, projectLayers } from '../src/graph/graphProjection'
import { ShapeView } from '../src/canvas/ElementView'
import { coverImageRect } from '../src/canvas/imageFill'
import InspectorPanel from '../src/ui/inspector/InspectorPanel'

function environment() {
  let sequence = 0
  const id = () => `visual-${++sequence}`
  const now = () => '2026-09-10T00:00:00.000Z'
  const resources = new MemoryDesignRepository()
  const graphs = new MemoryDesignGraphRepository()
  const versions = new MemoryVersionRepository()
  const versioning = new VersioningApplicationService(resources, graphs, versions, { id, now })
  const canvas = new CanvasGraphApplicationService(resources, graphs, versioning, { id, now })
  const history = new EditorHistoryApplicationService(canvas, versioning, new DesignGraphHistory())
  const editor = new EditorCommandApplicationService(canvas, versioning, history)
  const workspaces = new HumanWorkspaceService(resources, graphs, versioning, { id, now })
  return { canvas, history, editor, workspaces }
}

describe('human visual design capability', () => {
  it('projects persisted typography and appearance into the canvas renderer', async () => {
    const env = environment()
    const workspace = await env.workspaces.create('blank')
    const created = await env.editor.execute(workspace.document.id, 'create', createNodePayload('heading', { x: 20, y: 30, width: 360, height: 100 }), workspace.version.id)
    const nodeId = created.nodeId!
    const updated = await env.editor.execute(workspace.document.id, 'update', { nodeId, patch: { properties: { text: 'Designed for people', fontSize: 42, fontWeight: 700, textAlign: 'left', style: { fontFamily: 'Georgia, serif', lineHeight: 1.1, textColor: '#be123c', fill: '#fff1f2', stroke: '#be123c', strokeWidth: 1, borderRadius: 16, opacity: 0.9 } } } })

    expect(graphToCanvasProjection(updated.graph).elements[0]).toMatchObject({ text: 'Designed for people', fontSize: 42, fontWeight: 700, fontFamily: 'Georgia, serif', lineHeight: 1.1, textColor: '#be123c', borderRadius: 16, opacity: 0.9 })
    expect((await env.canvas.getDocumentGraph(workspace.document.id)).nodes[0]?.properties.style).toMatchObject({ textColor: '#be123c', borderRadius: 16 })
  })

  it('inserts a real image source, persists it, and converges canvas, layers, and inspector', async () => {
    const env = environment()
    const workspace = await env.workspaces.create('blank')
    const created = await env.editor.execute(workspace.document.id, 'create', createNodePayload('image', { x: 100, y: 120, width: 320, height: 220 }), workspace.version.id)
    const nodeId = created.nodeId!
    const reloaded = await env.canvas.getWorkspaceGraph(workspace.project.id, workspace.document.id, workspace.page.id)

    expect(reloaded.nodes[0]).toMatchObject({ id: nodeId, type: 'image', layout: { width: 320, height: 220 } })
    expect(String(reloaded.nodes[0]?.assetRef?.source)).toMatch(/^data:image\/svg\+xml,/)
    expect(reloaded.nodes[0]?.assetRef).toMatchObject({ kind: 'image', name: 'Image', width: 800, height: 520 })
    const projectedImage = graphToCanvasProjection(reloaded).elements[0]
    expect(projectedImage?.imageSrc).toMatch(/^data:image\/svg\+xml,/)
    expect(projectedImage).toMatchObject({ imageWidth: 800, imageHeight: 520 })
    expect(projectedImage?.text).toBe('')
    expect(projectLayers(reloaded, [nodeId]).roots[0]?.selected).toBe(true)
    expect(projectInspector(reloaded, [nodeId]).primaryNodeId).toBe(nodeId)
  })

  it('fills an image frame with a cropped cover render instead of letterboxing it', () => {
    const frame = { minX: 100, minY: 50, width: 320, height: 220 }
    const cover = coverImageRect({ width: 800, height: 520 }, frame)

    expect(cover).not.toBeNull()
    expect(cover!.height).toBeCloseTo(220, 6)
    expect(cover!.width).toBeGreaterThan(frame.width)
    expect(cover!.x).toBeLessThan(frame.minX)
    expect(cover!.x + cover!.width / 2).toBeCloseTo(frame.minX + frame.width / 2, 6)
    expect(cover!.width / cover!.height).toBeCloseTo(800 / 520, 6)
    expect(coverImageRect(null, frame)).toBeNull()
    expect(coverImageRect({ width: 800, height: 520 }, { minX: 0, minY: 0, width: 0, height: 0 })).toBeNull()
  })

  it('renders a resized image as a clipped cover fill so the frame stays visually coherent', async () => {
    const env = environment()
    const workspace = await env.workspaces.create('blank')
    const created = await env.editor.execute(workspace.document.id, 'create', createNodePayload('image', { x: 40, y: 40, width: 320, height: 220 }), workspace.version.id)
    const resized = await env.editor.execute(workspace.document.id, 'resize', { nodeId: created.nodeId, width: 340, height: 190 })
    const element = graphToCanvasProjection(resized.graph).elements[0]!
    const markup = renderToStaticMarkup(createElement('svg', null, createElement(ShapeView, { el: element })))

    const image = /<image[^>]*x="(-?[\d.]+)"[^>]*y="(-?[\d.]+)"[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"/.exec(markup)
    expect(image).not.toBeNull()
    const [, x, y, width, height] = image!.map(Number)
    expect(width).toBeCloseTo(340, 6)
    expect(height).toBeCloseTo((520 * 340) / 800, 6)
    expect(width / height).toBeCloseTo(800 / 520, 6)
    expect(x).toBeCloseTo(40, 6)
    expect(y).toBeCloseTo(40 - (height - 190) / 2, 6)
    expect(markup).toContain('clip-path="url(#clip-')
    expect(markup).toContain('<clipPath id="clip-')
  })

  it('uses canonical history for visual style changes and image insertion', async () => {
    const env = environment()
    const workspace = await env.workspaces.create('blank')
    const image = await env.editor.execute(workspace.document.id, 'create', createNodePayload('image', { x: 0, y: 0, width: 300, height: 180 }), workspace.version.id)
    await env.editor.execute(workspace.document.id, 'update', { nodeId: image.nodeId, patch: { properties: { ...image.graph.nodes[0]?.properties, style: { fill: '#111827', stroke: '#f59e0b', strokeWidth: 3, borderRadius: 24 } } } })

    const undoneStyle = await env.history.run(workspace.document.id, 'undo')
    expect(undoneStyle.graph.nodes[0]?.properties.style).not.toMatchObject({ borderRadius: 24 })
    const undoneImage = await env.history.run(workspace.document.id, 'undo')
    expect(undoneImage.graph.nodes).toHaveLength(0)
    const redoneImage = await env.history.run(workspace.document.id, 'redo')
    expect(redoneImage.graph.nodes[0]?.type).toBe('image')
    const redoneStyle = await env.history.run(workspace.document.id, 'redo')
    expect(redoneStyle.graph.nodes[0]?.properties.style).toMatchObject({ borderRadius: 24, strokeWidth: 3 })
  })

  it('shows human-facing controls relevant to text and image elements', async () => {
    const env = environment()
    const workspace = await env.workspaces.create('blank')
    const heading = await env.editor.execute(workspace.document.id, 'create', createNodePayload('heading', { x: 0, y: 0, width: 320, height: 80 }), workspace.version.id)
    const image = await env.editor.execute(workspace.document.id, 'create', createNodePayload('image', { x: 0, y: 120, width: 320, height: 220 }))
    const textHtml = renderToStaticMarkup(createElement(InspectorPanel, { projection: projectInspector(image.graph, [heading.nodeId!]), onUpdateNode: async () => undefined }))
    const imageHtml = renderToStaticMarkup(createElement(InspectorPanel, { projection: projectInspector(image.graph, [image.nodeId!]), onUpdateNode: async () => undefined }))

    expect(textHtml).toContain('Typography')
    expect(textHtml).toContain('aria-label="Font size"')
    expect(textHtml).not.toContain('aria-label="Fill"')
    expect(imageHtml).toContain('Appearance')
    expect(imageHtml).toContain('aria-label="Radius"')
    expect(imageHtml).not.toContain('aria-label="Font size"')
  })

  it('stacks each new element on top of its siblings in creation order', async () => {
    const env = environment()
    const workspace = await env.workspaces.create('blank')
    const section = await env.editor.execute(workspace.document.id, 'create', createNodePayload('section', { x: 0, y: 0, width: 640, height: 400 }), workspace.version.id)
    const heading = await env.editor.execute(workspace.document.id, 'create', createNodePayload('heading', { x: 40, y: 40, width: 320, height: 60 }))
    const image = await env.editor.execute(workspace.document.id, 'create', createNodePayload('image', { x: 40, y: 140, width: 300, height: 200 }))

    const graph = image.graph
    const order = graph.nodes.map((node) => `${node.id}:${node.orderIndex}`)
    expect(order).toEqual([`${section.nodeId}:0`, `${heading.nodeId}:1`, `${image.nodeId}:2`])
    expect(graphToCanvasProjection(graph).order).toEqual([section.nodeId, heading.nodeId, image.nodeId])
  })

  it('does not paint a layer name as canvas content on container shapes', async () => {
    const env = environment()
    const workspace = await env.workspaces.create('blank')
    const section = await env.editor.execute(workspace.document.id, 'create', createNodePayload('section', { x: 0, y: 0, width: 640, height: 400 }), workspace.version.id)
    const card = await env.editor.execute(workspace.document.id, 'create', createNodePayload('card', { x: 20, y: 40, width: 240, height: 160 }))
    const heading = await env.editor.execute(workspace.document.id, 'create', createNodePayload('heading', { x: 20, y: 240, width: 320, height: 60 }))
    const elements = new Map(graphToCanvasProjection(heading.graph).elements.map((element) => [element.id, element]))

    expect(elements.get(section.nodeId!)?.text).toBe('')
    expect(elements.get(card.nodeId!)?.text).toBe('')
    expect(elements.get(heading.nodeId!)?.text).toBe('Heading')

    const cardNode = heading.graph.nodes.find((node) => node.id === card.nodeId)!
    const withText = await env.editor.execute(workspace.document.id, 'update', { nodeId: card.nodeId, patch: { properties: { ...cardNode.properties, text: 'Featured blend' } } })
    expect(graphToCanvasProjection(withText.graph).elements.find((element) => element.id === card.nodeId)?.text).toBe('Featured blend')
  })
})
