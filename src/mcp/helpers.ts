import type { CanvasElement } from '../types'
import { elementRect } from '../store/geometry'

/** Minimal WebMCP result shape (subset of CallToolResult we emit). */
export interface ToolResult {
  content: { type: 'text'; text: string }[]
  isError?: boolean
}

export function ok(text: string): ToolResult {
  return { content: [{ type: 'text', text }] }
}

export function okJson(summary: string, data: unknown): ToolResult {
  return { content: [{ type: 'text', text: `${summary}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`` }] }
}

export function err(text: string): ToolResult {
  return { content: [{ type: 'text', text: `Error: ${text}` }], isError: true }
}

// --- argument coercion (boundary values arrive as unknown) ---

export function asStr(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

export function asNum(v: unknown, fallback = 0): number {
  const n = typeof v === 'string' ? Number(v) : (v as number)
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback
}

export function asBool(v: unknown, fallback = false): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') return v === 'true' || v === '1' || v === 'yes'
  return fallback
}

export function asStrArr(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string')
  if (typeof v === 'string' && v.trim()) return [v]
  return []
}

/** Round to 1 decimal so agent-facing JSON stays readable. */
function r(n: number): number {
  return Math.round(n * 10) / 10
}

/** Compact, agent-friendly view of an element (drops noise + defaults). */
export function serializeElement(el: CanvasElement): Record<string, unknown> {
  const rect = elementRect(el)
  const out: Record<string, unknown> = {
    id: el.id,
    type: el.type,
    x: r(rect.minX),
    y: r(rect.minY),
    width: r(rect.width),
    height: r(rect.height),
    author: el.author,
  }
  if (el.text) out.text = el.text
  if (el.type !== 'connector' && el.type !== 'line') {
    out.fill = el.fill
    out.stroke = el.stroke
  }
  if (el.from) out.from = el.from
  if (el.to) out.to = el.to
  if (el.groupId) out.groupId = el.groupId
  if (el.locked) out.locked = true
  return out
}
