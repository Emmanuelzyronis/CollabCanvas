import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type {
  ActivityEntry,
  ActivityKind,
  AgentPresence,
  Author,
  BoardSnapshot,
  Camera,
  CanvasElement,
  Comment,
  ElementInput,
  Tool,
} from '../types'
import { AGENT_COLOR, AGENT_NAME, MAX_ZOOM, MIN_ZOOM, TYPE_DEFAULTS } from '../constants'
import { reduceSelection, type SelectionInteraction } from '../canvas/selection/selectionModel'
import { boundsOf, computeAlign, computeDistribute, computeGrid, elementRect, type AlignEdge } from './geometry'

const BASE_ELEMENT: Omit<CanvasElement, 'id' | 'type' | 'createdAt' | 'updatedAt' | 'author'> = {
  x: 0,
  y: 0,
  width: 140,
  height: 90,
  rotation: 0,
  fill: '#ffffff',
  stroke: '#0f172a',
  strokeWidth: 2,
  opacity: 1,
  dashed: false,
  text: '',
  fontSize: 16,
  fontWeight: 400,
  textColor: '#0f172a',
  textAlign: 'center',
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  lineHeight: 1.25,
  borderRadius: 8,
  from: null,
  to: null,
  groupId: null,
  locked: false,
}

export function makeElement(input: ElementInput, author: Author): CanvasElement {
  const now = Date.now()
  const el: CanvasElement = {
    ...BASE_ELEMENT,
    ...TYPE_DEFAULTS[input.type],
    ...input,
    id: nanoid(8),
    type: input.type,
    author,
    createdAt: now,
    updatedAt: now,
  }
  // Sign agent-authored geometric shapes with the agent color unless overridden.
  if (author === 'agent' && input.stroke === undefined && el.stroke === '#0f172a') {
    el.stroke = AGENT_COLOR
  }
  return el
}

interface MutateOpts {
  record?: boolean
  author?: Author
}

export interface CanvasStore {
  // --- state ---
  elements: Record<string, CanvasElement>
  order: string[]
  comments: Comment[]
  selection: string[]
  hoveredNodeId: string | null
  selectionInteraction: SelectionInteraction
  camera: Camera
  viewport: { width: number; height: number }
  activeTool: Tool
  editingId: string | null
  activity: ActivityEntry[]
  agent: AgentPresence
  past: BoardSnapshot[]
  future: BoardSnapshot[]

  // --- selectors / helpers ---
  getElements: () => CanvasElement[]
  expandGroups: (ids: string[]) => string[]

  // --- history ---
  pushHistory: () => void
  undo: () => void
  redo: () => void

  // --- creation ---
  addElement: (input: ElementInput, author?: Author) => string
  addElements: (inputs: ElementInput[], author?: Author) => string[]
  duplicateElements: (ids: string[], author?: Author) => string[]

  // --- editing ---
  updateElement: (id: string, patch: Partial<CanvasElement>, opts?: MutateOpts) => void
  updateElements: (ids: string[], patch: Partial<CanvasElement>, opts?: MutateOpts) => void
  moveElements: (ids: string[], dx: number, dy: number, opts?: MutateOpts) => void
  setStyle: (ids: string[], patch: Partial<CanvasElement>, opts?: MutateOpts) => void
  deleteElements: (ids: string[], author?: Author) => void

  // --- ordering ---
  bringToFront: (ids: string[]) => void
  sendToBack: (ids: string[]) => void

  // --- grouping / arrangement ---
  groupElements: (ids: string[], author?: Author) => string | null
  ungroupElements: (ids: string[], author?: Author) => void
  alignElements: (ids: string[], edge: AlignEdge, author?: Author) => void
  distributeElements: (ids: string[], axis: 'horizontal' | 'vertical', author?: Author) => void
  arrangeGrid: (ids: string[], opts: { columns?: number; gap?: number }, author?: Author) => void

  // --- selection ---
  setSelection: (ids: string[]) => void
  select: (id: string, additive?: boolean) => void
  clearSelection: () => void
  selectAll: () => void
  setHoveredNode: (id: string | null) => void
  setSelectionInteraction: (interaction: SelectionInteraction) => void

  // --- comments ---
  addComment: (c: { x: number; y: number; text: string; author?: Author; targetId?: string | null }) => string
  resolveComment: (id: string) => void
  deleteComment: (id: string) => void

  // --- camera / view ---
  setViewport: (width: number, height: number) => void
  setCamera: (patch: Partial<Camera>) => void
  panBy: (dxScreen: number, dyScreen: number) => void
  zoomTo: (zoom: number, center?: { x: number; y: number }) => void
  zoomToFit: (ids?: string[], author?: Author) => void
  focusElement: (id: string, author?: Author) => void

  // --- ui ---
  setActiveTool: (tool: Tool) => void
  setEditing: (id: string | null) => void

  // --- agent presence + activity ---
  setAgentPresence: (patch: Partial<AgentPresence>) => void
  logActivity: (author: Author, kind: ActivityKind, message: string, elementIds?: string[]) => void

  // --- board lifecycle ---
  getSnapshot: () => BoardSnapshot
  loadSnapshot: (snap: BoardSnapshot, author?: Author, opts?: { record?: boolean }) => void
  clearBoard: (author?: Author) => void
}

function snapshot(s: Pick<CanvasStore, 'elements' | 'order' | 'comments'>): BoardSnapshot {
  return {
    version: 1,
    elements: structuredClone(s.elements),
    order: [...s.order],
    comments: structuredClone(s.comments),
  }
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  elements: {},
  order: [],
  comments: [],
  selection: [],
  hoveredNodeId: null,
  selectionInteraction: 'idle',
  camera: { x: -200, y: -150, zoom: 1 },
  viewport: { width: 1280, height: 800 },
  activeTool: 'select',
  editingId: null,
  activity: [],
  agent: { cursor: null, status: null, color: AGENT_COLOR, name: AGENT_NAME },
  past: [],
  future: [],

  getElements: () => get().order.map((id) => get().elements[id]).filter(Boolean),

  expandGroups: (ids) => {
    const { elements } = get()
    const groups = new Set<string>()
    for (const id of ids) {
      const g = elements[id]?.groupId
      if (g) groups.add(g)
    }
    if (groups.size === 0) return ids
    const result = new Set(ids)
    for (const el of Object.values(elements)) {
      if (el.groupId && groups.has(el.groupId)) result.add(el.id)
    }
    return [...result]
  },

  pushHistory: () => {
    set((s) => {
      const snap = snapshot(s)
      const last = s.past[s.past.length - 1]
      if (last && last.order.length === snap.order.length && JSON.stringify(last.elements) === JSON.stringify(snap.elements) && JSON.stringify(last.comments) === JSON.stringify(snap.comments)) {
        return {}
      }
      return { past: [...s.past.slice(-59), snap], future: [] }
    })
  },

  undo: () => {
    const { past } = get()
    if (past.length === 0) return
    set((s) => {
      const prev = s.past[s.past.length - 1]
      const current = snapshot(s)
      return {
        elements: prev.elements,
        order: prev.order,
        comments: prev.comments,
        past: s.past.slice(0, -1),
        future: [...s.future, current],
        selection: reduceSelection(s.selection, { type: 'reconcile' }, prev.order),
        hoveredNodeId: s.hoveredNodeId && prev.elements[s.hoveredNodeId] ? s.hoveredNodeId : null,
        selectionInteraction: 'idle',
      }
    })
  },

  redo: () => {
    const { future } = get()
    if (future.length === 0) return
    set((s) => {
      const next = s.future[s.future.length - 1]
      const current = snapshot(s)
      return {
        elements: next.elements,
        order: next.order,
        comments: next.comments,
        future: s.future.slice(0, -1),
        past: [...s.past, current],
        selection: reduceSelection(s.selection, { type: 'reconcile' }, next.order),
        hoveredNodeId: s.hoveredNodeId && next.elements[s.hoveredNodeId] ? s.hoveredNodeId : null,
        selectionInteraction: 'idle',
      }
    })
  },

  addElement: (input, author = 'human') => {
    get().pushHistory()
    const el = makeElement(input, author)
    set((s) => ({ elements: { ...s.elements, [el.id]: el }, order: [...s.order, el.id] }))
    get().logActivity(author, 'create', `Created ${el.type}${el.text ? ` "${truncate(el.text)}"` : ''}`, [el.id])
    return el.id
  },

  addElements: (inputs, author = 'human') => {
    get().pushHistory()
    const els = inputs.map((i) => makeElement(i, author))
    set((s) => {
      const elements = { ...s.elements }
      for (const el of els) elements[el.id] = el
      return { elements, order: [...s.order, ...els.map((e) => e.id)] }
    })
    get().logActivity(author, 'create', `Created ${els.length} elements`, els.map((e) => e.id))
    return els.map((e) => e.id)
  },

  duplicateElements: (ids, author = 'human') => {
    get().pushHistory()
    const { elements } = get()
    const groupRemap: Record<string, string> = {}
    const clones: CanvasElement[] = []
    for (const id of ids) {
      const src = elements[id]
      if (!src) continue
      let groupId = src.groupId
      if (groupId) {
        if (!groupRemap[groupId]) groupRemap[groupId] = nanoid(6)
        groupId = groupRemap[groupId]
      }
      clones.push({ ...src, id: nanoid(8), x: src.x + 24, y: src.y + 24, groupId, author, createdAt: Date.now(), updatedAt: Date.now() })
    }
    set((s) => {
      const next = { ...s.elements }
      for (const c of clones) next[c.id] = c
      const order = [...s.order, ...clones.map((c) => c.id)]
      return { elements: next, order, selection: reduceSelection(s.selection, { type: 'replace', nodeIds: clones.map((c) => c.id) }, order) }
    })
    get().logActivity(author, 'create', `Duplicated ${clones.length} element(s)`, clones.map((c) => c.id))
    return clones.map((c) => c.id)
  },

  updateElement: (id, patch, opts = {}) => {
    if (opts.record !== false) get().pushHistory()
    set((s) => {
      const el = s.elements[id]
      if (!el) return {}
      return { elements: { ...s.elements, [id]: { ...el, ...patch, id, updatedAt: Date.now() } } }
    })
    if (opts.author) get().logActivity(opts.author, 'update', `Updated element`, [id])
  },

  updateElements: (ids, patch, opts = {}) => {
    if (opts.record !== false) get().pushHistory()
    set((s) => {
      const elements = { ...s.elements }
      for (const id of ids) {
        const el = elements[id]
        if (el) elements[id] = { ...el, ...patch, id, updatedAt: Date.now() }
      }
      return { elements }
    })
  },

  moveElements: (ids, dx, dy, opts = {}) => {
    if (opts.record !== false) get().pushHistory()
    set((s) => {
      const elements = { ...s.elements }
      for (const id of ids) {
        const el = elements[id]
        if (el && !el.locked) elements[id] = { ...el, x: el.x + dx, y: el.y + dy, updatedAt: Date.now() }
      }
      return { elements }
    })
    if (opts.author) get().logActivity(opts.author, 'update', `Moved ${ids.length} element(s)`, ids)
  },

  setStyle: (ids, patch, opts = {}) => {
    if (opts.record !== false) get().pushHistory()
    set((s) => {
      const elements = { ...s.elements }
      for (const id of ids) {
        const el = elements[id]
        if (el) elements[id] = { ...el, ...patch, id, updatedAt: Date.now() }
      }
      return { elements }
    })
    if (opts.author) get().logActivity(opts.author, 'style', `Restyled ${ids.length} element(s)`, ids)
  },

  deleteElements: (ids, author = 'human') => {
    get().pushHistory()
    const idSet = new Set(ids)
    set((s) => {
      const elements = { ...s.elements }
      for (const id of ids) delete elements[id]
      // also drop connectors that referenced deleted elements
      for (const el of Object.values(elements)) {
        if ((el.from && idSet.has(el.from)) || (el.to && idSet.has(el.to))) delete elements[el.id]
      }
      const order = s.order.filter((id) => elements[id])
      return {
        elements,
        order,
        selection: reduceSelection(s.selection, { type: 'reconcile' }, order),
        hoveredNodeId: s.hoveredNodeId && elements[s.hoveredNodeId] ? s.hoveredNodeId : null,
        selectionInteraction: 'idle',
      }
    })
    get().logActivity(author, 'delete', `Deleted ${ids.length} element(s)`, [])
  },

  bringToFront: (ids) => {
    set((s) => {
      const setIds = new Set(ids)
      const rest = s.order.filter((id) => !setIds.has(id))
      return { order: [...rest, ...s.order.filter((id) => setIds.has(id))] }
    })
  },

  sendToBack: (ids) => {
    set((s) => {
      const setIds = new Set(ids)
      const rest = s.order.filter((id) => !setIds.has(id))
      return { order: [...s.order.filter((id) => setIds.has(id)), ...rest] }
    })
  },

  groupElements: (ids, author = 'human') => {
    if (ids.length < 2) return null
    get().pushHistory()
    const groupId = nanoid(6)
    set((s) => {
      const elements = { ...s.elements }
      for (const id of ids) if (elements[id]) elements[id] = { ...elements[id], groupId }
      return { elements }
    })
    get().logActivity(author, 'group', `Grouped ${ids.length} elements`, ids)
    return groupId
  },

  ungroupElements: (ids, author = 'human') => {
    get().pushHistory()
    const expanded = get().expandGroups(ids)
    set((s) => {
      const elements = { ...s.elements }
      for (const id of expanded) if (elements[id]) elements[id] = { ...elements[id], groupId: null }
      return { elements }
    })
    get().logActivity(author, 'group', `Ungrouped elements`, expanded)
  },

  alignElements: (ids, edge, author = 'human') => {
    get().pushHistory()
    const els = ids.map((id) => get().elements[id]).filter(Boolean)
    const patches = computeAlign(els, edge)
    set((s) => {
      const elements = { ...s.elements }
      for (const [id, p] of Object.entries(patches)) elements[id] = { ...elements[id], ...p, updatedAt: Date.now() }
      return { elements }
    })
    get().logActivity(author, 'arrange', `Aligned ${els.length} elements (${edge})`, ids)
  },

  distributeElements: (ids, axis, author = 'human') => {
    get().pushHistory()
    const els = ids.map((id) => get().elements[id]).filter(Boolean)
    const patches = computeDistribute(els, axis)
    set((s) => {
      const elements = { ...s.elements }
      for (const [id, p] of Object.entries(patches)) elements[id] = { ...elements[id], ...p, updatedAt: Date.now() }
      return { elements }
    })
    get().logActivity(author, 'arrange', `Distributed ${els.length} elements (${axis})`, ids)
  },

  arrangeGrid: (ids, opts, author = 'human') => {
    get().pushHistory()
    const els = ids.map((id) => get().elements[id]).filter(Boolean)
    const patches = computeGrid(els, opts)
    set((s) => {
      const elements = { ...s.elements }
      for (const [id, p] of Object.entries(patches)) elements[id] = { ...elements[id], ...p, updatedAt: Date.now() }
      return { elements }
    })
    get().logActivity(author, 'arrange', `Arranged ${els.length} elements in a grid`, ids)
  },

  setSelection: (ids) => set((s) => ({ selection: reduceSelection(s.selection, { type: 'replace', nodeIds: ids }, s.order) })),

  select: (id, additive = false) => {
    set((s) => {
      const action = additive ? { type: 'toggle' as const, nodeId: id } : { type: 'replace' as const, nodeIds: [id] }
      return { selection: reduceSelection(s.selection, action, s.order) }
    })
  },

  clearSelection: () => set((s) => ({ selection: reduceSelection(s.selection, { type: 'clear' }, s.order) })),

  selectAll: () => set((s) => ({ selection: reduceSelection(s.selection, { type: 'select-all' }, s.order) })),

  setHoveredNode: (id) => set((s) => {
    const hoveredNodeId = id && s.elements[id] ? id : null
    return hoveredNodeId === s.hoveredNodeId ? {} : { hoveredNodeId }
  }),

  setSelectionInteraction: (interaction) => set((s) => interaction === s.selectionInteraction ? {} : { selectionInteraction: interaction }),

  addComment: (c) => {
    get().pushHistory()
    const author = c.author ?? 'human'
    const comment: Comment = {
      id: nanoid(8),
      x: c.x,
      y: c.y,
      text: c.text,
      author,
      targetId: c.targetId ?? null,
      resolved: false,
      createdAt: Date.now(),
    }
    set((s) => ({ comments: [...s.comments, comment] }))
    get().logActivity(author, 'comment', `${author === 'agent' ? get().agent.name : 'You'}: "${truncate(c.text)}"`, comment.targetId ? [comment.targetId] : [])
    return comment.id
  },

  resolveComment: (id) => set((s) => ({ comments: s.comments.map((c) => (c.id === id ? { ...c, resolved: !c.resolved } : c)) })),

  deleteComment: (id) => set((s) => ({ comments: s.comments.filter((c) => c.id !== id) })),

  setViewport: (width, height) => set({ viewport: { width, height } }),

  setCamera: (patch) => {
    set((s) => {
      const zoom = patch.zoom !== undefined ? clamp(patch.zoom, MIN_ZOOM, MAX_ZOOM) : s.camera.zoom
      return { camera: { ...s.camera, ...patch, zoom } }
    })
  },

  panBy: (dxScreen, dyScreen) => {
    set((s) => ({ camera: { ...s.camera, x: s.camera.x - dxScreen / s.camera.zoom, y: s.camera.y - dyScreen / s.camera.zoom } }))
  },

  zoomTo: (zoom, center) => {
    set((s) => {
      const z = clamp(zoom, MIN_ZOOM, MAX_ZOOM)
      const c = center ?? { x: s.viewport.width / 2, y: s.viewport.height / 2 }
      const worldX = c.x / s.camera.zoom + s.camera.x
      const worldY = c.y / s.camera.zoom + s.camera.y
      return { camera: { x: worldX - c.x / z, y: worldY - c.y / z, zoom: z } }
    })
  },

  zoomToFit: (ids, author) => {
    const state = get()
    const els = (ids && ids.length ? ids.map((id) => state.elements[id]) : state.getElements()).filter(Boolean)
    const b = boundsOf(els)
    if (!b) return
    const pad = 80
    const vw = state.viewport.width
    const vh = state.viewport.height
    const zoom = clamp(Math.min(vw / (b.width + pad * 2), vh / (b.height + pad * 2)), MIN_ZOOM, MAX_ZOOM)
    const x = b.cx - vw / (2 * zoom)
    const y = b.cy - vh / (2 * zoom)
    set({ camera: { x, y, zoom } })
    if (author) state.logActivity(author, 'view', 'Zoomed to fit the board', [])
  },

  focusElement: (id, author) => {
    const state = get()
    const el = state.elements[id]
    if (!el) return
    const r = elementRect(el)
    const zoom = clamp(Math.min(state.viewport.width / (r.width + 240), state.viewport.height / (r.height + 240), 1.5), MIN_ZOOM, MAX_ZOOM)
    set({ camera: { x: r.cx - state.viewport.width / (2 * zoom), y: r.cy - state.viewport.height / (2 * zoom), zoom } })
    if (author) state.logActivity(author, 'view', `Focused on an element`, [id])
  },

  setActiveTool: (tool) => set((s) => ({ activeTool: tool, editingId: null, hoveredNodeId: tool === 'select' ? s.hoveredNodeId : null, selectionInteraction: 'idle' })),
  setEditing: (id) => set((s) => {
    const editingId = id && s.elements[id] ? id : null
    return { editingId, selectionInteraction: editingId ? 'editing' : 'idle' }
  }),

  setAgentPresence: (patch) => set((s) => ({ agent: { ...s.agent, ...patch } })),

  logActivity: (author, kind, message, elementIds = []) => {
    const entry: ActivityEntry = { id: nanoid(6), author, kind, message, elementIds, at: Date.now() }
    set((s) => ({ activity: [...s.activity.slice(-199), entry] }))
  },

  getSnapshot: () => snapshot(get()),

  loadSnapshot: (snap, author = 'human', opts = {}) => {
    // Canonical graph reconciliation must not create a second, local undo
    // stack: the graph is the only history authority.
    if (opts.record !== false) get().pushHistory()
    set({ elements: structuredClone(snap.elements), order: [...snap.order], comments: structuredClone(snap.comments), selection: [], hoveredNodeId: null, selectionInteraction: 'idle' })
    get().logActivity(author, 'generate', `Loaded a board (${snap.order.length} elements)`, [])
  },

  clearBoard: (author = 'human') => {
    get().pushHistory()
    set({ elements: {}, order: [], comments: [], selection: [], hoveredNodeId: null, selectionInteraction: 'idle' })
    get().logActivity(author, 'delete', 'Cleared the board', [])
  },
}))

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function truncate(s: string, n = 24): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}
