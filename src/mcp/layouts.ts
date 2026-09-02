import type { ElementInput } from '../types'
import { STICKY_COLORS } from '../constants'

/**
 * Layout generators: each turns a natural-language-ish spec (title + items)
 * into a batch of ElementInputs positioned at a world origin. The MCP
 * generate_layout tool feeds these into addElements + connectors.
 */

export type LayoutKind = 'flowchart' | 'kanban' | 'mindmap' | 'orgchart' | 'wireframe' | 'form'

export interface LayoutSpec {
  kind: LayoutKind
  title?: string
  items?: string[]
  columns?: string[]
  originX?: number
  originY?: number
}

/** A connector request expressed by element index into the returned elements array. */
export interface ConnRequest {
  fromIndex: number
  toIndex: number
  label?: string
}

export interface LayoutResult {
  elements: ElementInput[]
  connections: ConnRequest[]
}

const stickyPalette = [STICKY_COLORS.yellow, STICKY_COLORS.green, STICKY_COLORS.blue, STICKY_COLORS.pink, STICKY_COLORS.purple, STICKY_COLORS.orange]

function flowchart(spec: LayoutSpec): LayoutResult {
  const ox = spec.originX ?? 0
  const oy = spec.originY ?? 0
  const steps = spec.items?.length ? spec.items : ['Start', 'Process', 'Decision?', 'End']
  const elements: ElementInput[] = []
  const connections: ConnRequest[] = []
  const stepW = 200
  const gapY = 120
  const stepH = 80
  steps.forEach((label, i) => {
    const isDecision = /\?$/.test(label.trim())
    const isTerminal = i === 0 || i === steps.length - 1
    elements.push({
      type: isDecision ? 'diamond' : isTerminal ? 'ellipse' : 'rectangle',
      x: ox,
      y: oy + i * (stepH + gapY),
      width: stepW,
      height: isDecision ? 100 : stepH,
      text: label,
      fill: isTerminal ? '#dbeafe' : isDecision ? '#fef3c7' : '#ffffff',
    })
    if (i > 0) connections.push({ fromIndex: i - 1, toIndex: i })
  })
  return { elements, connections }
}

function kanban(spec: LayoutSpec): LayoutResult {
  const ox = spec.originX ?? 0
  const oy = spec.originY ?? 0
  const columns = spec.columns?.length ? spec.columns : ['To Do', 'In Progress', 'Done']
  const colW = 260
  const colGap = 32
  const colH = 460
  const elements: ElementInput[] = []
  columns.forEach((col, i) => {
    elements.push({
      type: 'frame',
      x: ox + i * (colW + colGap),
      y: oy,
      width: colW,
      height: colH,
      text: col,
      fill: '#f8fafc',
      stroke: '#cbd5e1',
    })
  })
  // Seed the first column with sample cards when the caller gave loose items.
  const cards = spec.items ?? []
  cards.forEach((card, i) => {
    elements.push({
      type: 'sticky',
      x: ox + 20,
      y: oy + 56 + i * 108,
      width: colW - 40,
      height: 92,
      text: card,
      fill: stickyPalette[i % stickyPalette.length],
    })
  })
  return { elements, connections: [] }
}

function mindmap(spec: LayoutSpec): LayoutResult {
  const ox = spec.originX ?? 0
  const oy = spec.originY ?? 0
  const center = spec.title ?? 'Central Idea'
  const branches = spec.items?.length ? spec.items : ['Branch A', 'Branch B', 'Branch C', 'Branch D']
  const elements: ElementInput[] = []
  const connections: ConnRequest[] = []
  const cx = ox
  const cy = oy
  elements.push({ type: 'ellipse', x: cx - 90, y: cy - 45, width: 180, height: 90, text: center, fill: '#ede9fe', stroke: '#8b5cf6' })
  const radius = 280
  branches.forEach((b, i) => {
    const angle = (i / branches.length) * Math.PI * 2 - Math.PI / 2
    const bx = cx + Math.cos(angle) * radius - 80
    const by = cy + Math.sin(angle) * radius - 35
    elements.push({ type: 'rectangle', x: bx, y: by, width: 160, height: 70, text: b, fill: '#ffffff' })
    connections.push({ fromIndex: 0, toIndex: i + 1 })
  })
  return { elements, connections }
}

function orgchart(spec: LayoutSpec): LayoutResult {
  const ox = spec.originX ?? 0
  const oy = spec.originY ?? 0
  const root = spec.title ?? 'CEO'
  const reports = spec.items?.length ? spec.items : ['VP Eng', 'VP Sales', 'VP Ops']
  const nodeW = 170
  const nodeH = 70
  const gap = 40
  const elements: ElementInput[] = []
  const connections: ConnRequest[] = []
  const totalW = reports.length * nodeW + (reports.length - 1) * gap
  elements.push({ type: 'rectangle', x: ox + totalW / 2 - nodeW / 2, y: oy, width: nodeW, height: nodeH, text: root, fill: '#dbeafe', stroke: '#2563eb' })
  reports.forEach((rep, i) => {
    elements.push({ type: 'rectangle', x: ox + i * (nodeW + gap), y: oy + nodeH + 100, width: nodeW, height: nodeH, text: rep, fill: '#ffffff' })
    connections.push({ fromIndex: 0, toIndex: i + 1 })
  })
  return { elements, connections }
}

function wireframe(spec: LayoutSpec): LayoutResult {
  const ox = spec.originX ?? 0
  const oy = spec.originY ?? 0
  const W = 420
  const elements: ElementInput[] = [
    { type: 'frame', x: ox, y: oy, width: W, height: 640, text: spec.title ?? 'Screen', fill: '#ffffff', stroke: '#94a3b8' },
    { type: 'rectangle', x: ox + 16, y: oy + 40, width: W - 32, height: 56, text: 'Header', fill: '#e2e8f0', stroke: '#94a3b8' },
    { type: 'rectangle', x: ox + 16, y: oy + 112, width: W - 32, height: 180, text: 'Hero / Banner', fill: '#f1f5f9', stroke: '#94a3b8' },
    { type: 'rectangle', x: ox + 16, y: oy + 308, width: (W - 44) / 2, height: 120, text: 'Card', fill: '#f8fafc', stroke: '#94a3b8' },
    { type: 'rectangle', x: ox + 28 + (W - 44) / 2, y: oy + 308, width: (W - 44) / 2, height: 120, text: 'Card', fill: '#f8fafc', stroke: '#94a3b8' },
    { type: 'rectangle', x: ox + 16, y: oy + 444, width: W - 32, height: 120, text: 'Content', fill: '#f8fafc', stroke: '#94a3b8' },
    { type: 'rectangle', x: ox + 16, y: oy + 580, width: W - 32, height: 44, text: 'Footer', fill: '#e2e8f0', stroke: '#94a3b8' },
  ]
  return { elements, connections: [] }
}

function form(spec: LayoutSpec): LayoutResult {
  const ox = spec.originX ?? 0
  const oy = spec.originY ?? 0
  const W = 380
  const fields = spec.items?.length ? spec.items : ['Name', 'Email', 'Message']
  const elements: ElementInput[] = [
    { type: 'frame', x: ox, y: oy, width: W, height: 120 + fields.length * 88, text: spec.title ?? 'Form', fill: '#ffffff', stroke: '#94a3b8' },
  ]
  fields.forEach((f, i) => {
    const fy = oy + 48 + i * 88
    elements.push({ type: 'text', x: ox + 24, y: fy, width: W - 48, height: 24, text: f, fontSize: 14, textColor: '#475569', textAlign: 'left' })
    elements.push({ type: 'rectangle', x: ox + 24, y: fy + 28, width: W - 48, height: 44, fill: '#f8fafc', stroke: '#cbd5e1' })
  })
  elements.push({ type: 'rectangle', x: ox + 24, y: oy + 48 + fields.length * 88, width: 140, height: 44, text: 'Submit', fill: '#2563eb', stroke: '#2563eb', textColor: '#ffffff' })
  return { elements, connections: [] }
}

const GENERATORS: Record<LayoutKind, (spec: LayoutSpec) => LayoutResult> = {
  flowchart,
  kanban,
  mindmap,
  orgchart,
  wireframe,
  form,
}

export function generateLayout(spec: LayoutSpec): LayoutResult {
  const gen = GENERATORS[spec.kind]
  return gen ? gen(spec) : { elements: [], connections: [] }
}

export const LAYOUT_KINDS = Object.keys(GENERATORS) as LayoutKind[]
