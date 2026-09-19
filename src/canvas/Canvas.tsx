import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCanvasStore } from '../store/store'
import { describeSelection } from './selection/selectionModel'
import { screenToWorld, worldToScreen } from './coords'
import { boundsOf, elementRect, hitTest, rectIntersects, type Rect } from '../store/geometry'
import { ConnectorView, ShapeView } from './ElementView'
import { GRID_GAP, TYPE_DEFAULTS } from '../constants'
import type { CanvasElement, ElementType } from '../types'
import type { EditorToolKind } from '../features/editor/editorModel'
import { specFor } from '../features/editor/editorModel'
import { useEditorToolStore } from '../features/editor/editorToolStore'

type Interaction =
  | { mode: 'idle' }
  | { mode: 'panning'; lastX: number; lastY: number }
  | { mode: 'moving'; lastWx: number; lastWy: number; ids: string[]; moved: boolean }
  | { mode: 'resizing'; id: string; handle: string; orig: { x: number; y: number; w: number; h: number }; startWx: number; startWy: number; moved: boolean }
  | { mode: 'creating'; id: string; startWx: number; startWy: number }
  | { mode: 'inserting'; kind: EditorToolKind; startWx: number; startWy: number }
  | { mode: 'marquee'; startWx: number; startWy: number }
  | { mode: 'connecting'; from: string }

export interface CanvasRect {
  x: number
  y: number
  width: number
  height: number
}

export interface CanvasEditorHandlers {
  onResize?: (nodeId: string, width: number, height: number, x?: number, y?: number) => Promise<void> | void
  onCommitMove?: (ids: readonly string[]) => Promise<void> | void
  onDeleteNodes?: (ids: readonly string[]) => Promise<void> | void
  onDuplicateNodes?: (ids: readonly string[]) => Promise<void> | void
  onInsertNode?: (kind: EditorToolKind, rect: CanvasRect) => Promise<void> | void
  onCommitText?: (nodeId: string, text: string) => Promise<void> | void
  onHistoryUndo?: () => Promise<void> | void
  onHistoryRedo?: () => Promise<void> | void
}

const HANDLES: { id: string; fx: number; fy: number; cursor: string }[] = [
  { id: 'nw', fx: 0, fy: 0, cursor: 'nwse-resize' },
  { id: 'n', fx: 0.5, fy: 0, cursor: 'ns-resize' },
  { id: 'ne', fx: 1, fy: 0, cursor: 'nesw-resize' },
  { id: 'e', fx: 1, fy: 0.5, cursor: 'ew-resize' },
  { id: 'se', fx: 1, fy: 1, cursor: 'nwse-resize' },
  { id: 's', fx: 0.5, fy: 1, cursor: 'ns-resize' },
  { id: 'sw', fx: 0, fy: 1, cursor: 'nesw-resize' },
  { id: 'w', fx: 0, fy: 0.5, cursor: 'ew-resize' },
]

function normalizeRect(x0: number, y0: number, x1: number, y1: number): Rect {
  const minX = Math.min(x0, x1)
  const minY = Math.min(y0, y1)
  const maxX = Math.max(x0, x1)
  const maxY = Math.max(y0, y1)
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 }
}

export default function Canvas({ onResize, onCommitMove, onDeleteNodes, onDuplicateNodes, onInsertNode, onCommitText, onHistoryUndo, onHistoryRedo }: CanvasEditorHandlers) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const interaction = useRef<Interaction>({ mode: 'idle' })
  const spaceRef = useRef(false)
  const handlers = useRef<CanvasEditorHandlers>({ onResize, onCommitMove, onDeleteNodes, onDuplicateNodes, onInsertNode, onCommitText, onHistoryUndo, onHistoryRedo })
  handlers.current = { onResize, onCommitMove, onDeleteNodes, onDuplicateNodes, onInsertNode, onCommitText, onHistoryUndo, onHistoryRedo }

  const elements = useCanvasStore((s) => s.elements)
  const order = useCanvasStore((s) => s.order)
  const comments = useCanvasStore((s) => s.comments)
  const selection = useCanvasStore((s) => s.selection)
  const hoveredNodeId = useCanvasStore((s) => s.hoveredNodeId)
  const selectionInteraction = useCanvasStore((s) => s.selectionInteraction)
  const camera = useCanvasStore((s) => s.camera)
  const activeTool = useCanvasStore((s) => s.activeTool)
  const editingId = useCanvasStore((s) => s.editingId)
  const agent = useCanvasStore((s) => s.agent)
  const editorTool = useEditorToolStore((s) => s.tool)
  const setEditorTool = useEditorToolStore((s) => s.setTool)

  const [textDraft, setTextDraft] = useState<string | null>(null)
  const cancelEditRef = useRef(false)
  const [marquee, setMarquee] = useState<Rect | null>(null)
  const [insertPreview, setInsertPreview] = useState<Rect | null>(null)
  const [connectDraft, setConnectDraft] = useState<{ from: string; x: number; y: number } | null>(null)
  const [commentDraft, setCommentDraft] = useState<{ x: number; y: number; text: string } | null>(null)
  const selectionState = describeSelection(selection, hoveredNodeId, selectionInteraction)
  const selectedNodeIds = useMemo(() => new Set(selection), [selection])

  useEffect(() => {
    cancelEditRef.current = false
    if (!editingId) {
      setTextDraft(null)
      return
    }
    const element = useCanvasStore.getState().elements[editingId]
    setTextDraft(element ? element.text : '')
  }, [editingId])

  const worldFromEvent = useCallback((e: { clientX: number; clientY: number }) => {
    const rect = svgRef.current!.getBoundingClientRect()
    const cam = useCanvasStore.getState().camera
    return screenToWorld(cam, e.clientX - rect.left, e.clientY - rect.top)
  }, [])

  const topmostAt = useCallback((wx: number, wy: number): CanvasElement | null => {
    const st = useCanvasStore.getState()
    for (let i = st.order.length - 1; i >= 0; i--) {
      const el = st.elements[st.order[i]]
      if (el && hitTest(el, wx, wy)) return el
    }
    return null
  }, [])

  // viewport sizing
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => useCanvasStore.getState().setViewport(el.clientWidth, el.clientHeight)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // wheel: pan by default, zoom with ctrl/meta (trackpad pinch)
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const st = useCanvasStore.getState()
      if (e.ctrlKey || e.metaKey) {
        const rect = svg.getBoundingClientRect()
        const factor = Math.exp(-e.deltaY * 0.0015)
        st.zoomTo(st.camera.zoom * factor, { x: e.clientX - rect.left, y: e.clientY - rect.top })
      } else {
        st.panBy(-e.deltaX, -e.deltaY)
      }
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [])

  // keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const st = useCanvasStore.getState()
      const target = e.target as HTMLElement
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (typing) return

      if (e.code === 'Space') {
        spaceRef.current = true
        return
      }
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        // Undo/redo is canonical graph history. The legacy local board stack is
        // never consulted, so the shortcut is honest even when unavailable.
        e.preventDefault()
        const run = e.shiftKey ? handlers.current.onHistoryRedo : handlers.current.onHistoryUndo
        if (run) void run()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        const run = handlers.current.onHistoryRedo
        if (run) void run()
        return
      }
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        st.selectAll()
        return
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        if (st.selection.length) {
          const ids = st.expandGroups(st.selection)
          if (handlers.current.onDuplicateNodes) void handlers.current.onDuplicateNodes(ids)
          else st.duplicateElements(ids)
        }
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (st.selection.length) {
          e.preventDefault()
          if (handlers.current.onDeleteNodes) void handlers.current.onDeleteNodes(st.expandGroups(st.selection))
          else st.deleteElements(st.expandGroups(st.selection))
        }
        return
      }
      if (e.key === 'Escape') {
        st.setEditing(null)
        st.clearSelection()
        st.setActiveTool('select')
        useEditorToolStore.getState().setTool('select')
        setConnectDraft(null)
        setCommentDraft(null)
        return
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && st.selection.length) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        const ids = st.expandGroups(st.selection)
        st.moveElements(ids, dx, dy, { record: !handlers.current.onCommitMove })
        if (handlers.current.onCommitMove) void handlers.current.onCommitMove(ids)
        return
      }
      const shortcuts: Record<string, () => void> = {
        v: () => st.setActiveTool('select'),
        h: () => st.setActiveTool('hand'),
        ...(!handlers.current.onInsertNode
          ? {
              r: () => st.setActiveTool('rectangle'),
              o: () => st.setActiveTool('ellipse'),
              d: () => st.setActiveTool('diamond'),
              t: () => st.setActiveTool('text'),
              s: () => st.setActiveTool('sticky'),
              f: () => st.setActiveTool('frame'),
              c: () => st.setActiveTool('connector'),
              m: () => st.setActiveTool('comment'),
            }
          : {}),
      }
      if (!mod && shortcuts[e.key.toLowerCase()]) shortcuts[e.key.toLowerCase()]()
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceRef.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button === 2) return
    const st = useCanvasStore.getState()
    const { x: wx, y: wy } = worldFromEvent(e)
    const panMode = spaceRef.current || editorTool === 'hand' || st.activeTool === 'hand' || e.button === 1
    svgRef.current!.setPointerCapture(e.pointerId)

    if (panMode) {
      st.setSelectionInteraction('idle')
      interaction.current = { mode: 'panning', lastX: e.clientX, lastY: e.clientY }
      return
    }

    if (editorTool !== 'select') {
      st.clearSelection()
      st.setHoveredNode(null)
      st.setSelectionInteraction('idle')
      interaction.current = { mode: 'inserting', kind: editorTool, startWx: wx, startWy: wy }
      setInsertPreview({ minX: wx, minY: wy, maxX: wx, maxY: wy, width: 0, height: 0, cx: wx, cy: wy })
      return
    }

    // With the canonical editor mounted, never fall through to hidden local element creation.
    if (st.activeTool !== 'select' && st.activeTool !== 'hand') st.setActiveTool('select')

    if (st.activeTool === 'select') {
      const hit = topmostAt(wx, wy)
      st.setHoveredNode(hit?.id ?? null)
      if (hit) {
        let sel: string[]
        if (e.shiftKey) {
          st.select(hit.id, true)
          sel = useCanvasStore.getState().selection
        } else if (!st.selection.includes(hit.id)) {
          sel = [hit.id]
          st.setSelection(sel)
        } else {
          sel = st.selection
        }
        const ids = st.expandGroups(sel)
        st.setSelectionInteraction('dragging')
        interaction.current = { mode: 'moving', lastWx: wx, lastWy: wy, ids, moved: false }
      } else {
        if (!e.shiftKey) st.clearSelection()
        st.setSelectionInteraction('selecting')
        interaction.current = { mode: 'marquee', startWx: wx, startWy: wy }
        setMarquee(normalizeRect(wx, wy, wx, wy))
      }
      return
    }

    if (st.activeTool === 'connector') {
      const hit = topmostAt(wx, wy)
      if (hit) {
        interaction.current = { mode: 'connecting', from: hit.id }
        setConnectDraft({ from: hit.id, x: wx, y: wy })
      }
      return
    }

    if (st.activeTool === 'comment') {
      setCommentDraft({ x: wx, y: wy, text: '' })
      interaction.current = { mode: 'idle' }
      return
    }

    if (st.activeTool === 'text' || st.activeTool === 'sticky') {
      const def = TYPE_DEFAULTS[st.activeTool]
      const w = def.width ?? 160
      const h = def.height ?? 60
      const id = st.addElement({ type: st.activeTool, x: wx - w / 2, y: wy - h / 2, text: '' }, 'human')
      st.setActiveTool('select')
      st.setSelection([id])
      st.pushHistory()
      st.setEditing(id)
      interaction.current = { mode: 'idle' }
      return
    }

    // rectangle / ellipse / diamond / frame -> drag to create
    const id = st.addElement({ type: st.activeTool as ElementType, x: wx, y: wy, width: 0, height: 0 }, 'human')
    interaction.current = { mode: 'creating', id, startWx: wx, startWy: wy }
  }

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const ref = interaction.current
    if (ref.mode === 'idle') {
      const st = useCanvasStore.getState()
      if (st.activeTool === 'select') {
        const { x: wx, y: wy } = worldFromEvent(e)
        st.setHoveredNode(topmostAt(wx, wy)?.id ?? null)
      }
      return
    }
    const st = useCanvasStore.getState()
    if (ref.mode === 'panning') {
      st.panBy(e.clientX - ref.lastX, e.clientY - ref.lastY)
      ref.lastX = e.clientX
      ref.lastY = e.clientY
      return
    }
    const { x: wx, y: wy } = worldFromEvent(e)
    if (ref.mode === 'moving') {
      const dx = wx - ref.lastWx
      const dy = wy - ref.lastWy
      if (dx !== 0 || dy !== 0) {
        ref.moved = true
        st.moveElements(ref.ids, dx, dy, { record: false })
      }
      ref.lastWx = wx
      ref.lastWy = wy
    } else if (ref.mode === 'inserting') {
      setInsertPreview(normalizeRect(ref.startWx, ref.startWy, wx, wy))
    } else if (ref.mode === 'creating') {
      st.updateElement(ref.id, { width: wx - ref.startWx, height: wy - ref.startWy }, { record: false })
    } else if (ref.mode === 'resizing') {
      const dx = wx - ref.startWx
      const dy = wy - ref.startWy
      let { x, y, w, h } = ref.orig
      if (ref.handle.includes('w')) {
        x = ref.orig.x + dx
        w = ref.orig.w - dx
      }
      if (ref.handle.includes('e')) w = ref.orig.w + dx
      if (ref.handle.includes('n')) {
        y = ref.orig.y + dy
        h = ref.orig.h - dy
      }
      if (ref.handle.includes('s')) h = ref.orig.h + dy
      w = Math.max(8, w)
      h = Math.max(8, h)
      if (dx !== 0 || dy !== 0) ref.moved = true
      st.updateElement(ref.id, { x, y, width: w, height: h }, { record: false })
    } else if (ref.mode === 'marquee') {
      const r = normalizeRect(ref.startWx, ref.startWy, wx, wy)
      setMarquee(r)
      const sel = st.getElements().filter((el) => rectIntersects(elementRect(el), r)).map((el) => el.id)
      st.setSelection(sel)
    } else if (ref.mode === 'connecting') {
      setConnectDraft((d) => (d ? { ...d, x: wx, y: wy } : d))
    }
  }

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const ref = interaction.current
    const st = useCanvasStore.getState()
    try {
      svgRef.current!.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    if (ref.mode === 'creating') {
      const el = st.elements[ref.id]
      if (el) {
        const tiny = Math.abs(el.width) < 6 && Math.abs(el.height) < 6
        if (tiny) {
          const def = TYPE_DEFAULTS[el.type]
          st.updateElement(ref.id, { width: def.width ?? 140, height: def.height ?? 90 }, { record: false })
        } else {
          st.updateElement(
            ref.id,
            { x: Math.min(el.x, el.x + el.width), y: Math.min(el.y, el.y + el.height), width: Math.abs(el.width), height: Math.abs(el.height) },
            { record: false },
          )
        }
        st.setActiveTool('select')
        st.setSelection([ref.id])
      }
    } else if (ref.mode === 'inserting') {
      const spec = specFor(ref.kind)
      const { x: endWx, y: endWy } = worldFromEvent(e)
      const dragRect = normalizeRect(ref.startWx, ref.startWy, endWx, endWy)
      const width = dragRect.width
      const height = dragRect.height
      const isClick = Math.abs(width) < 8 && Math.abs(height) < 8
      const rect = isClick
        ? { x: ref.startWx - spec.defaultWidth / 2, y: ref.startWy - spec.defaultHeight / 2, width: spec.defaultWidth, height: spec.defaultHeight }
        : { x: dragRect.minX, y: dragRect.minY, width: dragRect.width, height: dragRect.height }
      setInsertPreview(null)
      setEditorTool('select')
      if (handlers.current.onInsertNode) void handlers.current.onInsertNode(ref.kind, rect)
    } else if (ref.mode === 'connecting') {
      const { x: wx, y: wy } = worldFromEvent(e)
      const hit = topmostAt(wx, wy)
      if (hit && hit.id !== ref.from) {
        st.addElement({ type: 'connector', from: ref.from, to: hit.id, x: 0, y: 0 }, 'human')
      }
      setConnectDraft(null)
    } else if (ref.mode === 'marquee') {
      setMarquee(null)
    }
    if (ref.mode === 'resizing' && ref.moved && handlers.current.onResize) {
      const resized = st.elements[ref.id]
      if (resized) void Promise.resolve(handlers.current.onResize(ref.id, resized.width, resized.height, resized.x, resized.y)).catch(() => undefined)
    } else if (ref.mode === 'moving' && ref.moved && handlers.current.onCommitMove && ref.ids.length) {
      void handlers.current.onCommitMove(ref.ids)
    }
    interaction.current = { mode: 'idle' }
    st.setSelectionInteraction(useCanvasStore.getState().editingId ? 'editing' : 'idle')
  }

  const onDoubleClick = (e: React.PointerEvent<SVGSVGElement>) => {
    const { x: wx, y: wy } = worldFromEvent(e)
    const hit = topmostAt(wx, wy)
    const st = useCanvasStore.getState()
    if (hit && hit.type !== 'connector' && hit.type !== 'line') {
      st.setSelection([hit.id])
      st.setEditing(hit.id)
    }
  }

  const gridStyle: React.CSSProperties = {
    backgroundImage: 'radial-gradient(circle, rgba(100,116,139,0.35) 1px, transparent 1px)',
    backgroundSize: `${GRID_GAP * camera.zoom}px ${GRID_GAP * camera.zoom}px`,
    backgroundPosition: `${-camera.x * camera.zoom}px ${-camera.y * camera.zoom}px`,
  }

  // selection overlay geometry (screen space)
  const selEls = selection.map((id) => elements[id]).filter(Boolean) as CanvasElement[]
  const selBounds = boundsOf(selEls)
  const hoveredElement = hoveredNodeId ? elements[hoveredNodeId] : null
  const editingEl = editingId ? elements[editingId] : null

  const cursor =
    editorTool === 'hand' || activeTool === 'hand'
      ? 'grab'
      : editorTool !== 'select'
        ? 'crosshair'
        : activeTool === 'comment'
          ? 'copy'
          : selectionInteraction === 'dragging'
            ? 'grabbing'
            : hoveredElement
              ? 'move'
              : 'default'

  /** Commit the inline text draft through the canonical update command. */
  const commitInlineText = () => {
    const target = editingEl
    const value = textDraft
    useCanvasStore.getState().setEditing(null)
    setTextDraft(null)
    if (cancelEditRef.current) {
      cancelEditRef.current = false
      return
    }
    if (target && value !== null && value !== target.text) void handlers.current.onCommitText?.(target.id, value)
  }

  return (
    <div ref={containerRef} className="relative h-full w-full select-none overflow-hidden bg-slate-50">
      <div className="pointer-events-none absolute inset-0" style={gridStyle} />
      <svg
        ref={svgRef}
        className="absolute inset-0 h-full w-full"
        style={{ cursor, touchAction: 'none' }}
        tabIndex={0}
        aria-label="Canvas interaction surface"
        data-selection-mode={selectionState.mode}
        data-selection-interaction={selectionState.interaction}
        data-primary-node-id={selectionState.primaryNodeId ?? undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          if (interaction.current.mode === 'idle') useCanvasStore.getState().setHoveredNode(null)
        }}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        <defs>
          <filter id="stickyShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.18" />
          </filter>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
          </marker>
        </defs>

        <g transform={`translate(${-camera.x * camera.zoom}, ${-camera.y * camera.zoom}) scale(${camera.zoom})`}>
          {insertPreview ? <rect data-insert-preview="true" x={insertPreview.minX} y={insertPreview.minY} width={insertPreview.width} height={insertPreview.height} fill="rgba(37,99,235,0.10)" stroke="#2563eb" strokeWidth={1.5} strokeDasharray="5 4" rx={3} pointerEvents="none" /> : null}
          {order.map((id) => {
            const el = elements[id]
            if (!el) return null
            return (
              <g key={id} data-canvas-node-id={id} data-selected={selectedNodeIds.has(id) ? 'true' : undefined} data-hovered={hoveredNodeId === id ? 'true' : undefined}>
                {el.type === 'connector' || el.type === 'line'
                  ? <ConnectorView el={el} elements={elements} />
                  : <ShapeView el={el} />}
              </g>
            )
          })}
        </g>

        {/* screen-space overlay */}
        <g>
          {hoveredElement && !selectedNodeIds.has(hoveredElement.id) && (() => {
            const bounds = elementRect(hoveredElement)
            const topLeft = worldToScreen(camera, bounds.minX, bounds.minY)
            const bottomRight = worldToScreen(camera, bounds.maxX, bounds.maxY)
            return <rect data-selection-hover="true" x={topLeft.x - 1} y={topLeft.y - 1} width={bottomRight.x - topLeft.x + 2} height={bottomRight.y - topLeft.y + 2} fill="none" stroke="#2563eb" strokeWidth={1} strokeDasharray="3 3" rx={2} pointerEvents="none" />
          })()}

          {marquee && (() => {
            const tl = worldToScreen(camera, marquee.minX, marquee.minY)
            const br = worldToScreen(camera, marquee.maxX, marquee.maxY)
            return <rect x={tl.x} y={tl.y} width={br.x - tl.x} height={br.y - tl.y} fill="rgba(37,99,235,0.08)" stroke="#2563eb" strokeWidth={1} strokeDasharray="4 3" />
          })()}

          {connectDraft && (() => {
            const from = elements[connectDraft.from]
            if (!from) return null
            const r = elementRect(from)
            const a = worldToScreen(camera, r.cx, r.cy)
            const b = worldToScreen(camera, connectDraft.x, connectDraft.y)
            return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#8b5cf6" strokeWidth={2} strokeDasharray="6 4" />
          })()}

          {selBounds && (() => {
            const tl = worldToScreen(camera, selBounds.minX, selBounds.minY)
            const br = worldToScreen(camera, selBounds.maxX, selBounds.maxY)
            const w = br.x - tl.x
            const h = br.y - tl.y
            return (
              <g>
                <rect data-selection-overlay="true" x={tl.x - 1} y={tl.y - 1} width={w + 2} height={h + 2} fill="none" stroke="#2563eb" strokeWidth={1.5} rx={2} />
                {selection.length === 1 &&
                  !editingId &&
                  HANDLES.map((hd) => {
                    const hx = tl.x + hd.fx * w
                    const hy = tl.y + hd.fy * h
                    return (
                      <rect
                        key={hd.id}
                        data-resize-handle={hd.id}
                        x={hx - 5}
                        y={hy - 5}
                        width={10}
                        height={10}
                        rx={2}
                        fill="#ffffff"
                        stroke="#2563eb"
                        strokeWidth={1.5}
                        style={{ cursor: hd.cursor }}
                        onPointerDown={(ev) => {
                          ev.stopPropagation()
                          const st = useCanvasStore.getState()
                          const id = st.selection[0]
                          const el = st.elements[id]
                          if (!el) return
                          const rr = elementRect(el)
                          st.setSelectionInteraction('resizing')
                          const { x, y } = worldFromEvent(ev)
                          interaction.current = { mode: 'resizing', id, handle: hd.id, orig: { x: rr.minX, y: rr.minY, w: rr.width, h: rr.height }, startWx: x, startWy: y, moved: false }
                          svgRef.current!.setPointerCapture(ev.pointerId)
                        }}
                      />
                    )
                  })}
              </g>
            )
          })()}

          {comments.map((c) => {
            const p = worldToScreen(camera, c.x, c.y)
            return (
              <g key={c.id} style={{ cursor: 'pointer' }} opacity={c.resolved ? 0.4 : 1}>
                <circle cx={p.x} cy={p.y} r={11} fill={c.author === 'agent' ? '#8b5cf6' : '#2563eb'} stroke="#fff" strokeWidth={2} />
                <text x={p.x} y={p.y + 1} fontSize={11} fill="#fff" textAnchor="middle" dominantBaseline="middle" style={{ pointerEvents: 'none' }}>
                  {c.author === 'agent' ? '🤖' : '💬'}
                </text>
              </g>
            )
          })}

          {agent.cursor && (() => {
            const p = worldToScreen(camera, agent.cursor.x, agent.cursor.y)
            return (
              <g transform={`translate(${p.x}, ${p.y})`} style={{ transition: 'transform 0.35s ease-out' }}>
                <path d="M0 0 L0 16 L4.5 12 L7.5 18 L9.5 17 L6.5 11 L12 11 Z" fill={agent.color} stroke="#fff" strokeWidth={1} />
                <rect x={12} y={10} rx={4} width={agent.name.length * 7 + 14} height={18} fill={agent.color} />
                <text x={19} y={19} fontSize={11} fill="#fff" style={{ pointerEvents: 'none' }}>
                  {agent.name}
                </text>
              </g>
            )
          })()}
        </g>
      </svg>

      {editingEl && (() => {
        const r = elementRect(editingEl)
        const tl = worldToScreen(camera, r.minX, r.minY)
        return (
          <textarea
            autoFocus
            data-inline-text-editor="true"
            value={textDraft ?? editingEl.text}
            onChange={(e) => setTextDraft(e.target.value)}
            onBlur={commitInlineText}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                // Cancel: drop the draft without writing a canonical mutation.
                cancelEditRef.current = true
                useCanvasStore.getState().setEditing(null)
                setTextDraft(null)
                return
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                commitInlineText()
              }
            }}
            className="absolute resize-none rounded-md border-2 border-blue-500 bg-white/95 p-1 shadow-lg outline-none"
            style={{
              left: tl.x,
              top: tl.y,
              width: Math.max(r.width * camera.zoom, 60),
              height: Math.max(r.height * camera.zoom, 30),
              fontSize: Math.max(editingEl.fontSize * camera.zoom, 8),
              color: editingEl.textColor,
              textAlign: editingEl.textAlign,
              lineHeight: 1.25,
            }}
          />
        )
      })()}

      {commentDraft && (() => {
        const p = worldToScreen(camera, commentDraft.x, commentDraft.y)
        return (
          <div className="absolute z-20 w-60 rounded-lg border border-slate-200 bg-white p-2 shadow-xl" style={{ left: p.x, top: p.y }}>
            <textarea
              autoFocus
              className="h-16 w-full resize-none rounded border border-slate-200 p-1.5 text-sm outline-none focus:border-blue-400"
              placeholder="Add a comment…"
              value={commentDraft.text}
              onChange={(e) => setCommentDraft({ ...commentDraft, text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (commentDraft.text.trim()) useCanvasStore.getState().addComment({ x: commentDraft.x, y: commentDraft.y, text: commentDraft.text.trim() })
                  setCommentDraft(null)
                  useCanvasStore.getState().setActiveTool('select')
                }
                if (e.key === 'Escape') setCommentDraft(null)
              }}
            />
            <div className="mt-1 flex justify-end gap-1.5">
              <button className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100" onClick={() => setCommentDraft(null)}>
                Cancel
              </button>
              <button
                className="rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
                onClick={() => {
                  if (commentDraft.text.trim()) useCanvasStore.getState().addComment({ x: commentDraft.x, y: commentDraft.y, text: commentDraft.text.trim() })
                  setCommentDraft(null)
                  useCanvasStore.getState().setActiveTool('select')
                }}
              >
                Comment
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
