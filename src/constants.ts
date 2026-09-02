import type { CanvasElement, ElementType, Tool } from './types'

export const HUMAN_COLOR = '#2563eb'
export const AGENT_COLOR = '#8b5cf6'
export const AGENT_NAME = 'Aria'

export const GRID_GAP = 32

/** Shape fill palette exposed in the UI and to the agent. */
export const FILL_SWATCHES = [
  '#ffffff',
  '#e2e8f0',
  '#bae6fd',
  '#bbf7d0',
  '#fde68a',
  '#fecaca',
  '#ddd6fe',
  '#fbcfe8',
  '#1e293b',
]

export const STROKE_SWATCHES = [
  '#0f172a',
  '#334155',
  '#2563eb',
  '#059669',
  '#d97706',
  '#dc2626',
  '#8b5cf6',
  '#db2777',
  '#ffffff',
]

/** Sticky note colors (name -> hex) — friendly for natural-language agent calls. */
export const STICKY_COLORS: Record<string, string> = {
  yellow: '#fde68a',
  green: '#bbf7d0',
  blue: '#bfdbfe',
  pink: '#fbcfe8',
  purple: '#ddd6fe',
  orange: '#fed7aa',
  gray: '#e5e7eb',
}

/** Named colors resolvable from agent input. */
export const NAMED_COLORS: Record<string, string> = {
  white: '#ffffff',
  black: '#0f172a',
  gray: '#94a3b8',
  grey: '#94a3b8',
  slate: '#334155',
  red: '#dc2626',
  orange: '#ea580c',
  amber: '#d97706',
  yellow: '#eab308',
  green: '#16a34a',
  emerald: '#059669',
  teal: '#0d9488',
  cyan: '#0891b2',
  sky: '#0284c7',
  blue: '#2563eb',
  indigo: '#4f46e5',
  violet: '#8b5cf6',
  purple: '#9333ea',
  pink: '#db2777',
  rose: '#e11d48',
}

/** Per-type defaults merged when an element is created. */
export const TYPE_DEFAULTS: Record<ElementType, Partial<CanvasElement>> = {
  rectangle: { width: 140, height: 90, fill: '#ffffff', stroke: '#0f172a', strokeWidth: 2 },
  ellipse: { width: 130, height: 110, fill: '#ffffff', stroke: '#0f172a', strokeWidth: 2 },
  diamond: { width: 150, height: 110, fill: '#ffffff', stroke: '#0f172a', strokeWidth: 2 },
  text: {
    width: 220,
    height: 40,
    fill: 'transparent',
    stroke: 'transparent',
    strokeWidth: 0,
    fontSize: 24,
    textAlign: 'left',
    text: 'Text',
  },
  sticky: {
    width: 170,
    height: 170,
    fill: '#fde68a',
    stroke: 'transparent',
    strokeWidth: 0,
    fontSize: 16,
    textColor: '#422006',
    textAlign: 'center',
  },
  frame: {
    width: 480,
    height: 340,
    fill: 'rgba(148,163,184,0.06)',
    stroke: '#94a3b8',
    strokeWidth: 1.5,
    dashed: true,
    fontSize: 14,
    textAlign: 'left',
    text: 'Frame',
  },
  connector: { width: 120, height: 0, fill: 'transparent', stroke: '#334155', strokeWidth: 2 },
  line: { width: 120, height: 0, fill: 'transparent', stroke: '#334155', strokeWidth: 2 },
}

export interface ToolDef {
  id: Tool
  label: string
  shortcut: string
}

export const TOOLS: ToolDef[] = [
  { id: 'select', label: 'Select', shortcut: 'V' },
  { id: 'hand', label: 'Pan', shortcut: 'H' },
  { id: 'rectangle', label: 'Rectangle', shortcut: 'R' },
  { id: 'ellipse', label: 'Ellipse', shortcut: 'O' },
  { id: 'diamond', label: 'Diamond', shortcut: 'D' },
  { id: 'text', label: 'Text', shortcut: 'T' },
  { id: 'sticky', label: 'Sticky note', shortcut: 'S' },
  { id: 'frame', label: 'Frame', shortcut: 'F' },
  { id: 'connector', label: 'Connector', shortcut: 'C' },
  { id: 'comment', label: 'Comment', shortcut: 'M' },
]

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 4

/** Resolve a user/agent-provided color name or hex to a hex string. */
export function resolveColor(input: string | undefined, fallback: string): string {
  if (!input) return fallback
  const v = input.trim().toLowerCase()
  if (v === 'transparent' || v === 'none') return 'transparent'
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(v)) return v
  if (STICKY_COLORS[v]) return STICKY_COLORS[v]
  if (NAMED_COLORS[v]) return NAMED_COLORS[v]
  return fallback
}
