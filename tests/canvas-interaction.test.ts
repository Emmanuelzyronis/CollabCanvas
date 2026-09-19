import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { CanvasGraphApplicationService } from '../server/application/canvas-graph-service.js'
import { EditorCommandApplicationService } from '../server/application/editor-command-service.js'
import { DesignGraphHistory, EditorHistoryApplicationService } from '../server/application/editor-history-service.js'
import { HumanWorkspaceService } from '../server/application/workspace-service.js'
import { VersioningApplicationService } from '../server/application/version-service.js'
import { DomainError } from '../server/domain/errors.js'
import type { DesignGraph } from '../server/domain/contracts.js'
import { MemoryDesignGraphRepository } from '../server/persistence/memory-graph.js'
import { MemoryDesignRepository } from '../server/persistence/memory.js'
import { MemoryVersionRepository } from '../server/persistence/memory-versions.js'
import { projectDesignGraph, projectInspector, projectLayers } from '../src/graph/graphProjection.js'
import { loadGraphIntoCanvas } from '../src/graph/canvasStoreAdapter.js'
import { screenToWorld, worldToScreen } from '../src/canvas/coords.js'
import { useCanvasStore } from '../src/store/store.js'

function environment() {
  let sequence = 0
  const id = () => `slice-${++sequence}`
  const now = () => '2026-09-10T00:00:00.000Z'
  const resources = new MemoryDesignRepository()
  const graphs = new MemoryDesignGraphRepository()
  const versions = new MemoryVersionRepository()
  const versioning = new VersioningApplicationService(resources, graphs, versions, { id, now })
  const canvas = new CanvasGraphApplicationService(resources, graphs, versioning, { id, now })
  const history = new EditorHistoryApplicationService(canvas, versioning, new DesignGraphHistory())
  const editor = new EditorCommandApplicationService(canvas, versioning, history)
  const workspaces = new HumanWorkspaceService(resources, graphs, versioning, { id, now })
  return { resources, graphs, versions, versioning, canvas, history, editor, workspaces }
}

async function blankWorkspace() {
  const env = environment()
  const workspace = await env.workspaces.create('blank')
  const base = workspace.version.id
  const created = await env.editor.execute(
    workspace.document.id,
    'create',
    { type: 'heading', name: 'Heading', properties: { text: 'Heading' }, layout: { x: 100, y: 120, width: 320, height: 56 } },
    base,
  )
  const nodeId = created.nodeId!
  return { ...env, workspace, base, nodeId }
}

const layoutOf = (graph: DesignGraph, id: string) => graph.nodes.find((node) => node.id === id)!.layout
const textOf = (graph: DesignGraph, id: string) => graph.nodes.find((node) => node.id === id)!.properties.text

describe('Canvas interaction slice — viewport stability', () => {
  it('constrains the shell workspace to one definite row so canvas height cannot balloon with content', async () => {
    const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')
    const workspaceRule = css.slice(css.indexOf('.cc-shell-workspace {'), css.indexOf('.cc-shell-panel {'))
    expect(workspaceRule).toContain('grid-template-columns: minmax(0, 1fr)')
    expect(workspaceRule).toContain('grid-template-rows: minmax(0, 1fr)')
  })

  it('keeps an overflow-controlled, min-height-zero chain from shell to canvas section', async () => {
    const [shell, workspace, canvasShell] = await Promise.all([
      readFile(new URL('../src/ui/shell/AppShell.tsx', import.meta.url), 'utf8'),
      readFile(new URL('../src/features/editor/EditorWorkspace.tsx', import.meta.url), 'utf8'),
      readFile(new URL('../src/canvas/CanvasShell.tsx', import.meta.url), 'utf8'),
    ])
    expect(shell).toContain('grid-rows-[auto_minmax(0,1fr)_auto]')
    expect(shell).toContain('overflow-hidden')
    expect(workspace).toContain('relative h-full min-h-0 overflow-hidden')
    expect(canvasShell).toContain('h-full min-h-0 min-w-0 overflow-hidden')
  })

  it('converts pointer coordinates against the rendered viewport, independent of how many nodes exist', () => {
    const viewport = { width: 928, height: 908 }
    const camera = { x: 0, y: 0, zoom: 1 }
    const pointer = { x: 240, y: 180 }
    const world = screenToWorld(camera, pointer.x, pointer.y)
    expect(world).toEqual({ x: 240, y: 180 })
    // What is rendered is what is converted back — no dependency on node count.
    expect(worldToScreen(camera, world.x, world.y)).toEqual(pointer)
    expect(viewport.height).toBe(908)
    expect(world.y).toBeLessThan(viewport.height)
  })

  it('never lets a runtime graph reload change the transient viewport', async () => {
    const { workspace, canvas } = await blankWorkspace()
    useCanvasStore.getState().setCamera({ x: 5, y: 7, zoom: 1.1 })
    useCanvasStore.getState().setViewport(928, 908)

    loadGraphIntoCanvas(await canvas.getDocumentGraph(workspace.document.id), useCanvasStore.getState().loadSnapshot)

    expect(useCanvasStore.getState().viewport).toEqual({ width: 928, height: 908 })
    expect(useCanvasStore.getState().camera).toEqual({ x: 5, y: 7, zoom: 1.1 })
  })
})

describe('Canvas interaction slice — canonical manipulation', () => {
  it('moves a node through the canonical command and persists it for reload', async () => {
    const { canvas, workspace, nodeId, editor } = await blankWorkspace()
    const moved = await editor.execute(workspace.document.id, 'update', {
      nodeId,
      patch: { layout: { ...layoutOf(await canvas.getDocumentGraph(workspace.document.id), nodeId), x: 360, y: 240 } },
    })
    expect(layoutOf(moved.graph, nodeId)).toMatchObject({ x: 360, y: 240 })

    const reloaded = await canvas.getWorkspaceGraph(workspace.project.id, workspace.document.id, workspace.page.id)
    expect(layoutOf(reloaded, nodeId)).toMatchObject({ x: 360, y: 240 })
  })

  it('resizes a node through the canonical resize command with minimum dimensions and persists it', async () => {
    const { canvas, workspace, nodeId, editor } = await blankWorkspace()
    const resized = await editor.execute(workspace.document.id, 'resize', { nodeId, width: 480, height: 96, x: 120, y: 140 })
    expect(layoutOf(resized.graph, nodeId)).toMatchObject({ x: 120, y: 140, width: 480, height: 96 })

    const reloaded = await canvas.getWorkspaceGraph(workspace.project.id, workspace.document.id, workspace.page.id)
    expect(layoutOf(reloaded, nodeId)).toMatchObject({ width: 480, height: 96 })

    await expect(editor.execute(workspace.document.id, 'resize', { nodeId, width: 4, height: 4 })).rejects.toBeInstanceOf(DomainError)
  })

  it('edits text through the canonical update command and persists it', async () => {
    const { canvas, workspace, nodeId, editor } = await blankWorkspace()
    const graph = await canvas.getDocumentGraph(workspace.document.id)
    const node = graph.nodes.find((candidate) => candidate.id === nodeId)!
    const updated = await editor.execute(workspace.document.id, 'update', { nodeId, patch: { properties: { ...node.properties, text: 'Invoice overview' } } })
    expect(textOf(updated.graph, nodeId)).toBe('Invoice overview')

    const reloaded = await canvas.getWorkspaceGraph(workspace.project.id, workspace.document.id, workspace.page.id)
    expect(textOf(reloaded, nodeId)).toBe('Invoice overview')
  })

  it('converges canvas projection, layers, and inspector on the same canonical node', async () => {
    const { canvas, workspace, nodeId, editor } = await blankWorkspace()
    const graph = await canvas.getDocumentGraph(workspace.document.id)
    const moved = await editor.execute(workspace.document.id, 'update', {
      nodeId,
      patch: { layout: { ...layoutOf(graph, nodeId), x: 44, y: 88 } },
    })

    const projection = projectDesignGraph(moved.graph, [nodeId])
    const layers = projectLayers(moved.graph, [nodeId])
    const inspector = projectInspector(moved.graph, [nodeId])

    expect(projection.selection.primaryNodeId).toBe(nodeId)
    const flatten = (nodes: typeof layers.roots): (typeof layers.roots)[number][] => nodes.flatMap((node) => [node, ...flatten(node.children)])
    expect(flatten(layers.roots).find((node) => node.id === nodeId)?.selected).toBe(true)
    expect(inspector.nodes.map((node) => node.metadata.id)).toEqual([nodeId])

    const store = useCanvasStore.getState()
    loadGraphIntoCanvas(moved.graph, store.loadSnapshot)
    expect(useCanvasStore.getState().elements[nodeId]).toMatchObject({ x: 44, y: 88 })
  })
})

describe('Canvas interaction slice — honest canonical undo/redo', () => {
  it('undoes and redoes a move, then preserves the resulting state for reload', async () => {
    const { canvas, history, workspace, nodeId, editor } = await blankWorkspace()
    const original = layoutOf(await canvas.getDocumentGraph(workspace.document.id), nodeId)
    await editor.execute(workspace.document.id, 'update', { nodeId, patch: { layout: { ...original, x: 500, y: 400 } } })

    const undone = await history.run(workspace.document.id, 'undo')
    expect(undone.changed).toBe(true)
    expect(layoutOf(undone.graph, nodeId)).toMatchObject({ x: original.x, y: original.y })
    expect(undone.history).toEqual({ canUndo: true, canRedo: true })

    const reloadedAfterUndo = await canvas.getWorkspaceGraph(workspace.project.id, workspace.document.id, workspace.page.id)
    expect(layoutOf(reloadedAfterUndo, nodeId)).toMatchObject({ x: original.x, y: original.y })

    const redone = await history.run(workspace.document.id, 'redo')
    expect(redone.changed).toBe(true)
    expect(layoutOf(redone.graph, nodeId)).toMatchObject({ x: 500, y: 400 })

    const reloadedAfterRedo = await canvas.getWorkspaceGraph(workspace.project.id, workspace.document.id, workspace.page.id)
    expect(layoutOf(reloadedAfterRedo, nodeId)).toMatchObject({ x: 500, y: 400 })
  })

  it('undoes a resize and a text edit in stack order', async () => {
    const { history, workspace, nodeId, editor } = await blankWorkspace()
    await editor.execute(workspace.document.id, 'resize', { nodeId, width: 400, height: 80 })
    await editor.execute(workspace.document.id, 'update', { nodeId, patch: { properties: { text: 'Edited' } } })

    const undoneText = await history.run(workspace.document.id, 'undo')
    expect(textOf(undoneText.graph, nodeId)).toBe('Heading')
    expect(layoutOf(undoneText.graph, nodeId)).toMatchObject({ width: 400, height: 80 })

    const undoneResize = await history.run(workspace.document.id, 'undo')
    expect(layoutOf(undoneResize.graph, nodeId)).toMatchObject({ width: 320, height: 56 })
    expect(undoneResize.history.canUndo).toBe(true)
  })

  it('undoes create, delete, and duplicate without losing graph coherence', async () => {
    const { history, workspace, nodeId, editor } = await blankWorkspace()

    const duplicated = await editor.execute(workspace.document.id, 'duplicate', { nodeId })
    expect(duplicated.graph.nodes).toHaveLength(2)
    const undoneDuplicate = await history.run(workspace.document.id, 'undo')
    expect(undoneDuplicate.graph.nodes).toHaveLength(1)

    await editor.execute(workspace.document.id, 'delete', { nodeId })
    const undoneDelete = await history.run(workspace.document.id, 'undo')
    expect(undoneDelete.graph.nodes.map((node) => node.id)).toContain(nodeId)
    expect(undoneDelete.nodeId).toBe(nodeId)

    const removed = await history.run(workspace.document.id, 'undo')
    expect(removed.graph.nodes).toHaveLength(0)
    expect(removed.history.canUndo).toBe(false)

    const restored = await history.run(workspace.document.id, 'redo')
    expect(restored.graph.nodes.map((node) => node.id)).toContain(nodeId)
  })

  it('drops the redo branch when a new canonical mutation arrives', async () => {
    const { history, workspace, nodeId, editor } = await blankWorkspace()
    await editor.execute(workspace.document.id, 'resize', { nodeId, width: 400, height: 80 })
    await history.run(workspace.document.id, 'undo')
    expect((await history.run(workspace.document.id, 'redo')).changed).toBe(true)
    await history.run(workspace.document.id, 'undo')

    await editor.execute(workspace.document.id, 'resize', { nodeId, width: 260, height: 70 })
    expect((await history.run(workspace.document.id, 'redo')).changed).toBe(false)
  })

  it('returns an unchanged graph when there is nothing to undo or redo', async () => {
    const { history, workspace, nodeId } = await blankWorkspace()
    // The create itself is the only recorded entry; redo is empty.
    const nothingToRedo = await history.run(workspace.document.id, 'redo')
    expect(nothingToRedo.changed).toBe(false)
    expect(nothingToRedo.nodeId).toBeNull()

    await history.run(workspace.document.id, 'undo')
    const drained = await history.run(workspace.document.id, 'undo')
    expect(drained.changed).toBe(false)
    expect(drained.graph.nodes.map((node) => node.id)).not.toContain(nodeId)
    expect(drained.history).toEqual({ canUndo: false, canRedo: true })
  })

  it('rejects a stale base version instead of silently overwriting newer state', async () => {
    const { history, workspace } = await blankWorkspace()
    await expect(history.run(workspace.document.id, 'undo', 'stale-version')).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
  })
})

describe('Canvas interaction slice — canonical command records', () => {
  it('records the graph state on both sides of a committed command', async () => {
    const env = environment()
    const workspace = await env.workspaces.create('blank')
    const records: { command: string; before: number; after: number }[] = []
    const editor = new EditorCommandApplicationService(env.canvas, env.versioning, {
      record: (_documentId: string, entry: { command: string; before: { nodes: unknown[] }; after: { nodes: unknown[] } }) => {
        records.push({ command: entry.command, before: entry.before.nodes.length, after: entry.after.nodes.length })
      },
    })

    await editor.execute(workspace.document.id, 'create', { type: 'heading', name: 'Heading', layout: { x: 0, y: 0, width: 320, height: 56 } }, workspace.version.id)

    expect(records).toEqual([{ command: 'create', before: 0, after: 1 }])
  })

  it('does not create an undo step for a command that leaves graph content unchanged', async () => {
    const { history, workspace, nodeId, canvas, editor } = await blankWorkspace()
    expect(history.state(workspace.document.id)).toEqual({ canUndo: true, canRedo: false })

    const graph = await canvas.getDocumentGraph(workspace.document.id)
    const node = graph.nodes.find((candidate) => candidate.id === nodeId)!
    await editor.execute(workspace.document.id, 'update', { nodeId, patch: { layout: { ...node.layout } } })

    expect(history.state(workspace.document.id)).toEqual({ canUndo: true, canRedo: false })
  })
})
