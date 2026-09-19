import { describe, expect, it } from 'vitest'
import { EditorCommandApplicationService } from '../server/application/editor-command-service.js'
import { HumanWorkspaceService } from '../server/application/workspace-service.js'
import { CanvasGraphApplicationService } from '../server/application/canvas-graph-service.js'
import { VersioningApplicationService } from '../server/application/version-service.js'
import { MemoryDesignGraphRepository } from '../server/persistence/memory-graph.js'
import { MemoryDesignRepository } from '../server/persistence/memory.js'
import { MemoryVersionRepository } from '../server/persistence/memory-versions.js'
import { projectDesignGraph } from '../src/graph/graphProjection.js'
import { graphToCanvasProjection } from '../src/graph/canvasProjection.js'

function environment() {
  let sequence = 0
  const id = () => `emm95-${++sequence}`
  const now = () => '2026-09-09T00:00:00.000Z'
  const resources = new MemoryDesignRepository()
  const graphs = new MemoryDesignGraphRepository()
  const versions = new MemoryVersionRepository()
  const versioning = new VersioningApplicationService(resources, graphs, versions, { id, now })
  const canvas = new CanvasGraphApplicationService(resources, graphs, versioning, { id, now })
  const editor = new EditorCommandApplicationService(canvas, versioning)
  const workspaces = new HumanWorkspaceService(resources, graphs, versioning, { id, now })
  return { resources, graphs, versions, versioning, canvas, editor, workspaces, id }
}

describe('EMM-95 blank workspace and canonical editor command bus', () => {
  it('bootstraps a blank project/document/page with an empty canonical graph and a draft base version', async () => {
    const { workspaces, canvas } = environment()
    const workspace = await workspaces.create('blank')

    expect(workspace.project.name).toBe('Untitled project')
    expect(workspace.document.name).toBe('Untitled design')
    expect(workspace.page.name).toBe('Page 1')
    expect(workspace.graph.nodes).toEqual([])
    expect(workspace.version.status).toBe('draft')
    expect(workspace.version.number).toBe(1)

    const hydrated = await canvas.getWorkspaceGraph(workspace.project.id, workspace.document.id, workspace.page.id)
    expect(hydrated.nodes).toEqual([])
    expect(hydrated.document.id).toBe(workspace.document.id)
  })

  it('creates repeated blank workspaces without slug conflicts', async () => {
    const { workspaces } = environment()
    const first = await workspaces.create('blank')
    const second = await workspaces.create('blank')
    expect(first.project.id).not.toBe(second.project.id)
    expect(first.project.slug).not.toBe(second.project.slug)
    expect(second.graph.nodes).toEqual([])
  })

  it('creates a node through the canonical command and persists it for later hydration', async () => {
    const { workspaces, editor, canvas } = environment()
    const workspace = await workspaces.create('blank')

    const created = await editor.execute(workspace.document.id, 'create', {
      type: 'heading',
      name: 'Welcome',
      properties: { text: 'Welcome' },
      layout: { x: 40, y: 60, width: 320, height: 48 },
    }, workspace.version.id)

    expect(created.validation).toEqual({ valid: true })
    expect(created.version.baseVersionId).toBe(workspace.version.id)
    expect(created.version.currentVersionId).toBe(workspace.version.id)
    expect(created.version.revision).toBe(1)
    expect(created.nodeId).toBeTruthy()
    expect(created.graph.nodes).toHaveLength(1)
    expect(created.graph.nodes[0]).toMatchObject({ type: 'heading', name: 'Welcome', layout: { x: 40, y: 60, width: 320, height: 48 } })

    // A fresh application boundary hydrates the same canonical state (reload proof).
    const reloaded = await canvas.getWorkspaceGraph(workspace.project.id, workspace.document.id, workspace.page.id)
    expect(reloaded.nodes).toHaveLength(1)
    expect(reloaded.nodes[0].id).toBe(created.nodeId)
  })

  it('routes every editor command through one mutation path and keeps the graph coherent', async () => {
    const { workspaces, editor } = environment()
    // A blank workspace keeps the assertions about command semantics independent
    // of the starter composition a preset now seeds.
    const workspace = await workspaces.create('blank')
    const base = workspace.version.id

    const created = await editor.execute(workspace.document.id, 'create', { type: 'section', name: 'Hero', layout: { x: 0, y: 0, width: 800, height: 300 } }, base)
    const sectionId = created.nodeId!
    expect(created.graph.nodes.map((node) => node.id)).toContain(sectionId)

    const updated = await editor.execute(workspace.document.id, 'update', { nodeId: sectionId, patch: { name: 'Hero section' } }, base)
    expect(updated.graph.nodes.find((node) => node.id === sectionId)?.name).toBe('Hero section')

    const resized = await editor.execute(workspace.document.id, 'resize', { nodeId: sectionId, width: 640, height: 200, x: 20, y: 30 }, base)
    expect(resized.graph.nodes.find((node) => node.id === sectionId)?.layout).toMatchObject({ x: 20, y: 30, width: 640, height: 200 })

    const moved = await editor.execute(workspace.document.id, 'move', { nodeId: sectionId, parentId: null }, base)
    expect(moved.graph.nodes.find((node) => node.id === sectionId)?.parentId).toBeNull()

    const container = await editor.execute(workspace.document.id, 'create', { type: 'container', name: 'Layout', layout: { x: 0, y: 0, width: 400, height: 400 } }, base)
    const containerId = container.nodeId!

    const movedInto = await editor.execute(workspace.document.id, 'move', { nodeId: sectionId, parentId: containerId, orderIndex: 0 }, base)
    expect(movedInto.graph.nodes.find((node) => node.id === sectionId)?.parentId).toBe(containerId)
    expect(movedInto.graph.nodes.find((node) => node.id === sectionId)?.orderIndex).toBe(0)

    const duplicated = await editor.execute(workspace.document.id, 'duplicate', { nodeId: sectionId }, base)
    expect(duplicated.nodeId).toBeTruthy()
    expect(duplicated.graph.nodes).toHaveLength(3)
    expect(duplicated.graph.nodes.find((node) => node.id === duplicated.nodeId)?.name).toBe('Hero section copy')

    const reordered = await editor.execute(workspace.document.id, 'reorder', { nodeId: containerId, orderIndex: 0 }, base)
    expect(reordered.graph.nodes.find((node) => node.id === containerId)?.orderIndex).toBe(0)

    const deleted = await editor.execute(workspace.document.id, 'delete', { nodeId: sectionId }, base)
    expect(deleted.graph.nodes.some((node) => node.id === sectionId)).toBe(false)
    expect(deleted.graph.nodes.some((node) => node.id === containerId)).toBe(true)
    expect(deleted.graph.nodes).toHaveLength(2)
  })

  it('rejects a stale base version as a conflict instead of overwriting', async () => {
    const { workspaces, editor } = environment()
    const workspace = await workspaces.create('flyer')
    await editor.execute(workspace.document.id, 'create', { type: 'text', name: 'Headline', layout: { x: 10, y: 10, width: 200, height: 40 } }, workspace.version.id)

    await expect(editor.execute(workspace.document.id, 'create', { type: 'text', name: 'Stale writer', layout: {} }, 'version-that-no-longer-exists')).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
    await expect(editor.execute(workspace.document.id, 'resize', { nodeId: 'missing', width: 100, height: 100 }, '')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('enforces approved-version immutability through the guard and allows edits again on a draft', async () => {
    const { workspaces, editor, versioning } = environment()
    const workspace = await workspaces.create('blank')
    const base = workspace.version.id

    const approved = await versioning.approveVersion(base, 'reviewer')
    await expect(editor.execute(workspace.document.id, 'create', { type: 'container', name: 'Locked', layout: {} }, approved.id)).rejects.toMatchObject({ code: 'APPROVAL_REQUIRED' })

    const draft = await versioning.createDraft(workspace.document.id, 'designer')
    const created = await editor.execute(workspace.document.id, 'create', { type: 'container', name: 'Editable', layout: { x: 0, y: 0, width: 100, height: 100 } }, draft.id)
    expect(created.graph.nodes).toHaveLength(1)
    expect((await versioning.getVersion(draft.id)).graph.nodes).toHaveLength(1)
  })

  it('keeps canvas, layers, and inspector projections on the same canonical node', async () => {
    const { workspaces, editor, canvas } = environment()
    const workspace = await workspaces.create('blank')
    const created = await editor.execute(workspace.document.id, 'create', {
      type: 'heading',
      name: 'Shared identity',
      properties: { text: 'Shared identity' },
      layout: { x: 24, y: 24, width: 300, height: 48 },
    }, workspace.version.id)
    const nodeId = created.nodeId!

    const projection = projectDesignGraph(created.graph, [nodeId])
    expect(projection.layers.nodeOrder).toContain(nodeId)
    expect(projection.inspector.primaryNodeId).toBe(nodeId)
    expect(projection.selection.selectedIds).toEqual([nodeId])

    const renderer = graphToCanvasProjection(created.graph)
    expect(renderer.order).toContain(nodeId)
    expect(renderer.elements.find((element) => element.id === nodeId)).toMatchObject({ x: 24, y: 24, width: 300, height: 48 })

    // Reloading through a fresh controller-equivalent path yields the same identity.
    const reloaded = await canvas.getDocumentGraph(workspace.document.id)
    expect(reloaded.nodes.find((node) => node.id === nodeId)).toBeTruthy()
  })
})
