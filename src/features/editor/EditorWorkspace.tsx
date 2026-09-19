import { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import { useWorkspaceContext } from '../../workspace'
import { useCanvasStore } from '../../store/store'
import { loadGraphIntoCanvas } from '../../graph/canvasStoreAdapter'
import { CopilotProposalPanel } from '../copilot'
import CanvasShell from '../../canvas/CanvasShell'
import EditorToolbar from './EditorToolbar'
import StartSurface from './StartSurface'
import { createNodePayload, positionLayoutPatch, topLevelSelectedIds, type InsertRect } from './editorCommands'
import type { EditorToolKind } from './editorModel'
import { useEditorToolStore } from './editorToolStore'

/**
 * Reconcile the runtime canvas projection against the canonical graph that a
 * command just persisted. Selection is applied only after the node is present
 * in the projection, so a freshly created node is never filtered out as
 * unknown.
 */
function reconcileCanvas(result: { graph: Parameters<typeof loadGraphIntoCanvas>[0] }, selection?: readonly string[] | null): void {
  const store = useCanvasStore.getState()
  // `loadSnapshot` empties runtime selection. Preserve (or explicitly replace)
  // it so Canvas, Layers, and Inspector keep pointing at the same canonical
  // node after a mutation instead of diverging.
  const requested = selection === undefined || selection === null ? store.selection : [...selection]
  loadGraphIntoCanvas(result.graph, store.loadSnapshot)
  const available = new Set(result.graph.nodes.map((node) => node.id))
  useCanvasStore.getState().setSelection(requested.filter((id) => available.has(id)))
}

export default function EditorWorkspace() {
  const workspace = useWorkspaceContext()
  const [copilotOpen, setCopilotOpen] = useState(false)
  const [copilotMounted, setCopilotMounted] = useState(false)
  const [error, setError] = useState<string>()
  const [savedAt, setSavedAt] = useState<string>()

  const graph = workspace.graph
  const empty = workspace.availability === 'GRAPH_AVAILABLE' && graph !== null && graph.nodes.length === 0
  const command = workspace.command
  // The empty-state card is a pointer target; while an insert tool is armed it
  // must not intercept the click that is meant for the canvas underneath it.
  const editorTool = useEditorToolStore((state) => state.tool)
  const showEmptyState = empty && editorTool === 'select'

  const noticeError = (caught: unknown) => {
    setError(caught instanceof Error ? caught.message : 'The edit could not be saved.')
  }

  const insertAt = useCallback(async (kind: EditorToolKind, rect: InsertRect) => {
    setError(undefined)
    if (!command) return
    const payload = createNodePayload(kind, rect)
    try {
      const result = await command('create', payload)
      reconcileCanvas(result, result.nodeId ? [result.nodeId] : null)
      setSavedAt(new Date().toLocaleTimeString())
    } catch (caught) {
      noticeError(caught)
    }
  }, [command])

  const commitMove = useCallback(async (ids: readonly string[]) => {
    setError(undefined)
    if (!command || !graph) return
    const elements = useCanvasStore.getState().elements
    let last: Awaited<ReturnType<NonNullable<typeof command>>> | undefined
    try {
      for (const id of topLevelSelectedIds(graph, ids)) {
        const element = elements[id]
        if (!element) continue
        const patch = positionLayoutPatch(graph, id, element.x, element.y)
        if (!patch) continue
        last = await command('update', patch)
      }
      if (last) reconcileCanvas(last, null)
      setSavedAt(new Date().toLocaleTimeString())
    } catch (caught) {
      noticeError(caught)
    }
  }, [command, graph])

  const commitText = useCallback(async (nodeId: string, text: string) => {
    setError(undefined)
    if (!command || !graph) return
    const node = graph.nodes.find((candidate) => candidate.id === nodeId)
    if (!node) return
    const previous = typeof node.properties.text === 'string' ? node.properties.text : ''
    if (previous === text) return
    try {
      const result = await command('update', { nodeId, patch: { properties: { ...node.properties, text } } })
      reconcileCanvas(result)
      setSavedAt(new Date().toLocaleTimeString())
    } catch (caught) {
      noticeError(caught)
    }
  }, [command, graph])

  const undo = useCallback(async () => {
    setError(undefined)
    if (!workspace.undo) return
    try {
      const result = await workspace.undo()
      reconcileCanvas(result)
      setSavedAt(new Date().toLocaleTimeString())
    } catch (caught) {
      noticeError(caught)
    }
  }, [workspace])

  const redo = useCallback(async () => {
    setError(undefined)
    if (!workspace.redo) return
    try {
      const result = await workspace.redo()
      reconcileCanvas(result)
      setSavedAt(new Date().toLocaleTimeString())
    } catch (caught) {
      noticeError(caught)
    }
  }, [workspace])

  const deleteNodes = useCallback(async (ids: readonly string[]) => {
    setError(undefined)
    if (!command || !graph) return
    let last: Awaited<ReturnType<NonNullable<typeof command>>> | undefined
    try {
      for (const id of topLevelSelectedIds(graph, ids)) last = await command('delete', { nodeId: id })
      if (last) reconcileCanvas(last, [])
      setSavedAt(new Date().toLocaleTimeString())
    } catch (caught) {
      noticeError(caught)
    }
  }, [command, graph])

  const duplicateNodes = useCallback(async (ids: readonly string[]) => {
    setError(undefined)
    if (!command || !graph) return
    const created: string[] = []
    let last: Awaited<ReturnType<NonNullable<typeof command>>> | undefined
    try {
      for (const id of topLevelSelectedIds(graph, ids)) {
        const result = await command('duplicate', { nodeId: id })
        last = result
        if (result.nodeId) created.push(result.nodeId)
      }
      if (last) reconcileCanvas(last, created.length ? created : null)
      setSavedAt(new Date().toLocaleTimeString())
    } catch (caught) {
      noticeError(caught)
    }
  }, [command, graph])

  useEffect(() => {
    if (!error) return
    const timer = window.setTimeout(() => setError(undefined), 6000)
    return () => window.clearTimeout(timer)
  }, [error])

  const openCopilot = () => {
    setCopilotMounted(true)
    setCopilotOpen(true)
  }

  return (
    <div className="relative h-full min-h-0 overflow-hidden" data-editor-workspace="true">
      <CanvasShell
        onResize={workspace.resizeNode}
        onCommitMove={commitMove}
        onDeleteNodes={deleteNodes}
        onDuplicateNodes={duplicateNodes}
        onInsertNode={insertAt}
        onCommitText={commitText}
        onHistoryUndo={undo}
        onHistoryRedo={redo}
      />
      {workspace.availability === 'GRAPH_AVAILABLE' ? <EditorToolbar /> : null}
      {showEmptyState ? <StartSurface onInsertAt={(kind, rect) => void insertAt(kind, rect)} /> : null}

      {error ? (
        <div data-editor-error="true" role="alert" className="absolute bottom-4 left-1/2 z-30 max-w-md -translate-x-1/2 rounded-xl border border-error bg-panel px-4 py-2 text-sm text-error shadow-floating">
          {error}
        </div>
      ) : savedAt && workspace.availability === 'GRAPH_AVAILABLE' ? (
        <div data-editor-saved="true" className="pointer-events-none absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full border border-border-subtle bg-panel/90 px-3 py-1 text-xs text-text-muted shadow-subtle">
          Saved · {savedAt}
        </div>
      ) : null}

      <div className="absolute bottom-4 right-4 z-30 flex flex-col items-end gap-2" data-copilot-region="true">
        {copilotMounted ? (
          <div data-copilot-panel-host="true" hidden={!copilotOpen} className="w-[min(24rem,calc(100vw-2rem))]">
            <CopilotProposalPanel />
          </div>
        ) : null}
        <button
          type="button"
          data-copilot-toggle="true"
          aria-expanded={copilotOpen}
          onClick={() => (copilotOpen ? setCopilotOpen(false) : openCopilot())}
          className={clsx('flex min-h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium shadow-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500', copilotOpen ? 'border-blue-500 bg-blue-600 text-white' : 'border-border-default bg-panel text-text-secondary hover:text-text-primary')}
        >
          <span aria-hidden="true">✦</span>
          {copilotOpen ? 'Hide assistant' : 'Assistant'}
        </button>
      </div>
    </div>
  )
}
