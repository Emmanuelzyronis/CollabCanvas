import { useCallback, useEffect, useRef, useState } from 'react'
import { useCanvasStore } from '../store/store'
import { screenToWorld, worldToScreen } from './coords'
import { boundsOf, elementRect, hitTest, rectIntersects, type Rect } from '../store/geometry'
import { ConnectorView, ShapeView } from './ElementView'
import { GRID_GAP, TYPE_DEFAULTS } from '../constants'
import type { CanvasElement, ElementType } from '../types'

type Interaction =
  | { mode: 'idle' }
  | { mode: 'panning'; lastX: number; lastY: number }
  | { mode: 'moving'; lastWx: number; lastWy: number; ids: string[] }
  | { mode: 'resizing'; id: string; handle: string; orig: { x: number; y: number; w: number; h: number }; startWx: number; startWy: number }
  | { mode: 'creating'; id: string; startWx: number; startWy: number }
  | { mode: 'marquee'; startWx: number; startWy: number }
  | { mode: 'connecting'; from: string }

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

export default function Canvas() {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const interaction = useRef<Interaction>({ mode: 'idle' })
  const spaceRef = useRef(false)

  const elements = useCanvasStore((s) => s.elements)
  const order = useCanvasStore((s) => s.order)
  const comments = useCanvasStore((s) => s.comments)
  const selection = useCanvasStore((s) => s.selection)
  const camera = useCanvasStore((s) => s.camera)
  const activeTool = useCanvasStore((s) => s.activeTool)
  const editingId = useCanvasStore((s) => s.editingId)
  const agent = useCanvasStore((s) => s.agent)

  const [marquee, setMarquee] = useState<Rect | null>(null)
  const [connectDraft, setConnectDraft] = useState<{ from: string; x: number; y: number } | null>(null)
  const [commentDraft, setCommentDraft] = useState<{ x: number; y: number; text: string } | null>(null)

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
        e.preventDefault()
        if (e.shiftKey) st.redo()
        else st.undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        st.redo()
        return
      }
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        st.selectAll()
        return
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        if (st.selection.length) st.duplicateElements(st.expandGroups(st.selection))
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (st.selection.length) {
          e.preventDefault()
          st.deleteElements(st.expandGroups(st.selection))
        }
        return
      }
      if (e.key === 'Escape') {
        st.setEditing(null)
        st.clearSelection()
        st.setActiveTool('select')
        setConnectDraft(null)
        setCommentDraft(null)
        return
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && st.selection.length) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        st.moveElements(st.expandGroups(st.selection), dx, dy)
        return
      }
      const shortcuts: Record<string, () => void> = {
        v: () => st.setActiveTool('select'),
        h: () => st.setActiveTool('hand'),
        r: () => st.setActiveTool('rectangle'),
        o: () => st.setActiveTool('ellipse'),
        d: () => st.setActiveTool('diamond'),
        t: () => st.setActiveTool('text'),
        s: () => st.setActiveTool('sticky'),
        f: () => st.setActiveTool('frame'),
        c: () => st.setActiveTool('connector'),
        m: () => st.setActiveTool('comment'),
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
    const panMode = spaceRef.current || st.activeTool === 'hand' || e.button === 1
    svgRef.current!.setPointerCapture(e.pointerId)

    if (panMode) {
      interaction.current = { mode: 'panning', lastX: e.clientX, lastY: e.clientY }
      return
    }

    if (st.activeTool === 'select') {
      const hit = topmostAt(wx, wy)
      if (hit) {
        let sel: string[]
        if (e.shiftKey) {
          st.select(hit.id, true)
          sel = useCanvasStore.getState().selection
        } else if (!st.selection.includes(hit.id)) {
          sel = st.expandGroups([hit.id])
          st.setSelection(sel)
        } else {
          sel = st.selection
        }
        const ids = st.expandGroups(sel)
        st.pushHistory()
        interaction.current = { mode: 'moving', lastWx: wx, lastWy: wy, ids }
      } else {
        if (!e.shiftKey) st.clearSelection()
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
    if (ref.mode === 'idle') return
    const st = useCanvasStore.getState()
    if (ref.mode === 'panning') {
      st.panBy(e.clientX - ref.lastX, e.clientY - ref.lastY)
      ref.lastX = e.clientX
      ref.lastY = e.clientY
      return
    }
    const { x: wx, y: wy } = worldFromEvent(e)
    if (ref.mode === 'moving') {
      st.moveElements(ref.ids, wx - ref.lastWx, wy - ref.lastWy, { record: false })
      ref.lastWx = wx
      ref.lastWy = wy
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
      st.updateElement(ref.id, { x, y, width: w, height: h }, { record: false })
    } else if (ref.mode === 'marquee') {
      const r = normalizeRect(ref.startWx, ref.startWy, wx, wy)
      setMarquee(r)
      const sel = st.getElements().filter((el) => rectIntersects(elementRect(el), r)).map((el) => el.id)
      st.setSelection(st.expandGroups(sel))
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
    interaction.current = { mode: 'idle' }
  }

  const onDoubleClick = (e: React.PointerEvent<SVGSVGElement>) => {
    const { x: wx, y: wy } = worldFromEvent(e)
    const hit = topmostAt(wx, wy)
    const st = useCanvasStore.getState()
    if (hit && hit.type !== 'connector' && hit.type !== 'line') {
      st.setSelection([hit.id])
      st.pushHistory()
      st.setEditing(hit.id)
    }
  }

  const cursor =
    activeTool === 'hand' ? 'grab' : activeTool === 'select' ? 'default' : activeTool === 'comment' ? 'copy' : 'crosshair'

  const gridStyle: React.CSSProperties = {
    backgroundImage: 'radial-gradient(circle, rgba(100,116,139,0.35) 1px, transparent 1px)',
    backgroundSize: `${GRID_GAP * camera.zoom}px ${GRID_GAP * camera.zoom}px`,
    backgroundPosition: `${-camera.x * camera.zoom}px ${-camera.y * camera.zoom}px`,
  }

  // selection overlay geometry (screen space)
  const selEls = selection.map((id) => elements[id]).filter(Boolean) as CanvasElement[]
  const selBounds = boundsOf(selEls)
  const editingEl = editingId ? elements[editingId] : null

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-slate-50">
      <div className="pointer-events-none absolute inset-0" style={gridStyle} />
      <svg
        ref={svgRef}
        className="absolute inset-0 h-full w-full"
        style={{ cursor, touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
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
          {order.map((id) => {
            const el = elements[id]
            if (!el) return null
            if (el.type === 'connector' || el.type === 'line') return <ConnectorView key={id} el={el} elements={elements} />
            return <ShapeView key={id} el={el} />
          })}
        </g>

        {/* screen-space overlay */}
        <g>
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
                <rect x={tl.x - 1} y={tl.y - 1} width={w + 2} height={h + 2} fill="none" stroke="#2563eb" strokeWidth={1.5} rx={2} />
                {selection.length === 1 &&
                  !editingId &&
                  HANDLES.map((hd) => {
                    const hx = tl.x + hd.fx * w
                    const hy = tl.y + hd.fy * h
                    return (
                      <rect
                        key={hd.id}
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
                          st.pushHistory()
                          const { x, y } = worldFromEvent(ev)
                          interaction.current = { mode: 'resizing', id, handle: hd.id, orig: { x: rr.minX, y: rr.minY, w: rr.width, h: rr.height }, startWx: x, startWy: y }
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
            defaultValue={editingEl.text}
            onChange={(e) => useCanvasStore.getState().updateElement(editingEl.id, { text: e.target.value }, { record: false })}
            onBlur={() => useCanvasStore.getState().setEditing(null)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) {
                e.preventDefault()
                useCanvasStore.getState().setEditing(null)
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
