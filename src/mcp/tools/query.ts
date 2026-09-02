import type { CanvasStore } from '../../store/store'
import type { CanvasElement } from '../../types'
import { boundsOf } from '../../store/geometry'
import { asNum, asStr, asStrArr, ok, okJson, serializeElement } from '../helpers'
import type { ToolDef } from './create'

type Store = () => CanvasStore

function r(n: number): number {
  return Math.round(n * 10) / 10
}

/** Count elements by type for compact summaries. */
function countByType(els: CanvasElement[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const el of els) counts[el.type] = (counts[el.type] ?? 0) + 1
  return counts
}

export function queryTools(getStore: Store): ToolDef[] {
  return [
    {
      name: 'get_board_state',
      description:
        'Get the full board as structured JSON: every element (id, type, position, size, text, colors, author) plus counts and overall bounds. Use this to understand what is on the canvas before editing.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: () => {
        const store = getStore()
        const els = store.getElements()
        const bounds = boundsOf(els)
        const data = {
          count: els.length,
          byType: countByType(els),
          bounds: bounds ? { x: r(bounds.minX), y: r(bounds.minY), width: r(bounds.width), height: r(bounds.height) } : null,
          elements: els.map(serializeElement),
          comments: store.comments.map((c) => ({ id: c.id, x: r(c.x), y: r(c.y), text: c.text, author: c.author, targetId: c.targetId, resolved: c.resolved })),
        }
        return okJson(`Board has ${els.length} element(s) and ${store.comments.length} comment(s).`, data)
      },
    },
    {
      name: 'get_selection',
      description: 'Get the elements the human currently has selected (ids + details). Useful for "restyle what I selected" flows.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: () => {
        const store = getStore()
        const els = store.selection.map((id) => store.elements[id]).filter(Boolean)
        if (els.length === 0) return ok('Nothing is selected.')
        return okJson(`${els.length} element(s) selected.`, { ids: store.selection, elements: els.map(serializeElement) })
      },
    },
    {
      name: 'find_elements',
      description:
        'Find elements matching filters: by type, by text substring (case-insensitive), by author (human/agent), or within a world rectangle (x,y,width,height). Returns matching ids + details.',
      inputSchema: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'Element type to match' },
          text: { type: 'string', description: 'Substring to find in element text' },
          author: { type: 'string', enum: ['human', 'agent'] },
          x: { type: 'number', description: 'Region top-left X' },
          y: { type: 'number', description: 'Region top-left Y' },
          width: { type: 'number', description: 'Region width' },
          height: { type: 'number', description: 'Region height' },
        },
      },
      annotations: { readOnlyHint: true },
      execute: (a) => {
        const store = getStore()
        const type = a.type !== undefined ? asStr(a.type) : null
        const text = a.text !== undefined ? asStr(a.text).toLowerCase() : null
        const author = a.author !== undefined ? asStr(a.author) : null
        const hasRegion = a.x !== undefined && a.y !== undefined && a.width !== undefined && a.height !== undefined
        const rx = asNum(a.x)
        const ry = asNum(a.y)
        const rw = asNum(a.width)
        const rh = asNum(a.height)
        const matches = store.getElements().filter((el) => {
          if (type && el.type !== type) return false
          if (text && !el.text.toLowerCase().includes(text)) return false
          if (author && el.author !== author) return false
          if (hasRegion) {
            const cx = el.x + el.width / 2
            const cy = el.y + el.height / 2
            if (cx < rx || cx > rx + rw || cy < ry || cy > ry + rh) return false
          }
          return true
        })
        if (matches.length === 0) return ok('No matching elements.')
        return okJson(`Found ${matches.length} element(s).`, { ids: matches.map((e) => e.id), elements: matches.map(serializeElement) })
      },
    },
    {
      name: 'summarize_board',
      description:
        'Return a concise natural-language summary of the board: element counts by type, frames/sections present, connector relationships, and open comments. Use when the human asks "what is on the board?".',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: () => {
        const store = getStore()
        const els = store.getElements()
        if (els.length === 0) return ok('The board is empty.')
        const byType = countByType(els)
        const lines: string[] = []
        lines.push(`The board has ${els.length} element(s): ${Object.entries(byType).map(([t, n]) => `${n} ${t}${n > 1 ? 's' : ''}`).join(', ')}.`)
        const frames = els.filter((e) => e.type === 'frame')
        if (frames.length) lines.push(`Sections: ${frames.map((f) => `"${f.text || 'untitled'}"`).join(', ')}.`)
        const connectors = els.filter((e) => e.type === 'connector' && e.from && e.to)
        if (connectors.length) {
          const rels = connectors.slice(0, 8).map((c) => {
            const from = store.elements[c.from!]
            const to = store.elements[c.to!]
            const fromLabel = from?.text || from?.type || c.from
            const toLabel = to?.text || to?.type || c.to
            return `${fromLabel} → ${toLabel}`
          })
          lines.push(`Connections: ${rels.join('; ')}${connectors.length > 8 ? ` (and ${connectors.length - 8} more)` : ''}.`)
        }
        const open = store.comments.filter((c) => !c.resolved)
        if (open.length) lines.push(`${open.length} open comment(s).`)
        return ok(lines.join('\n'))
      },
    },
    {
      name: 'select_elements',
      description: 'Set the current selection to the given element ids (highlights them for the human).',
      inputSchema: {
        type: 'object',
        properties: { ids: { type: 'array', items: { type: 'string' } } },
        required: ['ids'],
      },
      execute: (a) => {
        const store = getStore()
        const ids = asStrArr(a.ids).filter((id) => store.elements[id])
        store.setSelection(ids)
        return ok(`Selected ${ids.length} element(s).`)
      },
    },
  ]
}
