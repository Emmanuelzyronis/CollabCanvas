import type { CanvasStore } from '../../store/store'
import type { ElementInput, ElementType } from '../../types'
import { resolveColor } from '../../constants'
import { asNum, asStr, err, ok, serializeElement, type ToolResult } from '../helpers'

export interface ToolDef {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  annotations?: { readOnlyHint?: boolean }
  execute: (args: Record<string, unknown>) => ToolResult | Promise<ToolResult>
}

type Store = () => CanvasStore

const SHAPE_ENUM = ['rectangle', 'ellipse', 'diamond'] as const

export function createTools(getStore: Store): ToolDef[] {
  return [
    {
      name: 'create_shape',
      description:
        'Create a shape (rectangle, ellipse, or diamond) on the canvas at world coordinates (x,y = top-left). Optional label text, fill/stroke colors (hex or names like "blue"), and size. Returns the new element id.',
      inputSchema: {
        type: 'object',
        properties: {
          shape: { type: 'string', enum: SHAPE_ENUM, description: 'Shape kind' },
          x: { type: 'number', description: 'Top-left X in world coords' },
          y: { type: 'number', description: 'Top-left Y in world coords' },
          width: { type: 'number', description: 'Width in px (default per shape)' },
          height: { type: 'number', description: 'Height in px (default per shape)' },
          text: { type: 'string', description: 'Optional label centered in the shape' },
          fill: { type: 'string', description: 'Fill color (hex or name), or "transparent"' },
          stroke: { type: 'string', description: 'Stroke color (hex or name)' },
        },
        required: ['shape'],
      },
      execute: (a) => {
        const shape = asStr(a.shape) as ElementType
        if (!SHAPE_ENUM.includes(shape as (typeof SHAPE_ENUM)[number])) return err(`Unknown shape "${a.shape}". Use rectangle, ellipse, or diamond.`)
        const input: ElementInput = { type: shape, x: asNum(a.x, 0), y: asNum(a.y, 0) }
        if (a.width !== undefined) input.width = asNum(a.width)
        if (a.height !== undefined) input.height = asNum(a.height)
        if (a.text !== undefined) input.text = asStr(a.text)
        if (a.fill !== undefined) input.fill = resolveColor(asStr(a.fill), '#ffffff')
        if (a.stroke !== undefined) input.stroke = resolveColor(asStr(a.stroke), '#0f172a')
        const id = getStore().addElement(input, 'agent')
        return ok(`Created ${shape} (id: ${id}).`)
      },
    },
    {
      name: 'create_sticky_note',
      description:
        'Create a sticky note with text. Color can be a name (yellow, green, blue, pink, purple, orange, gray) or hex. Great for brainstorming and kanban cards. Returns the new element id.',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Note text' },
          x: { type: 'number', description: 'Top-left X' },
          y: { type: 'number', description: 'Top-left Y' },
          color: { type: 'string', description: 'Sticky color name or hex (default yellow)' },
        },
        required: ['text'],
      },
      execute: (a) => {
        const input: ElementInput = { type: 'sticky', text: asStr(a.text), x: asNum(a.x, 0), y: asNum(a.y, 0) }
        if (a.color !== undefined) input.fill = resolveColor(asStr(a.color), '#fde68a')
        const id = getStore().addElement(input, 'agent')
        return ok(`Created sticky note (id: ${id}).`)
      },
    },
    {
      name: 'create_text',
      description: 'Create a standalone text label at (x,y). Optional fontSize and color. Returns the new element id.',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'The text content' },
          x: { type: 'number' },
          y: { type: 'number' },
          fontSize: { type: 'number', description: 'Font size in px (default 24)' },
          color: { type: 'string', description: 'Text color (hex or name)' },
        },
        required: ['text'],
      },
      execute: (a) => {
        const input: ElementInput = { type: 'text', text: asStr(a.text), x: asNum(a.x, 0), y: asNum(a.y, 0) }
        if (a.fontSize !== undefined) input.fontSize = asNum(a.fontSize, 24)
        if (a.color !== undefined) input.textColor = resolveColor(asStr(a.color), '#0f172a')
        const id = getStore().addElement(input, 'agent')
        return ok(`Created text (id: ${id}).`)
      },
    },
    {
      name: 'create_frame',
      description:
        'Create a frame (labeled container/section) to group related content visually. Use for kanban columns, wireframe regions, or diagram sections. Returns the new element id.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Frame label shown at top-left' },
          x: { type: 'number' },
          y: { type: 'number' },
          width: { type: 'number', description: 'Default 480' },
          height: { type: 'number', description: 'Default 340' },
        },
        required: ['title'],
      },
      execute: (a) => {
        const input: ElementInput = { type: 'frame', text: asStr(a.title, 'Frame'), x: asNum(a.x, 0), y: asNum(a.y, 0) }
        if (a.width !== undefined) input.width = asNum(a.width, 480)
        if (a.height !== undefined) input.height = asNum(a.height, 340)
        const id = getStore().addElement(input, 'agent')
        return ok(`Created frame "${input.text}" (id: ${id}).`)
      },
    },
    {
      name: 'create_connector',
      description:
        'Draw an arrow connector between two existing elements (by id). The arrow auto-anchors to element borders and follows them when moved. Optional label. Returns the new connector id.',
      inputSchema: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Source element id' },
          to: { type: 'string', description: 'Target element id' },
          label: { type: 'string', description: 'Optional label at the midpoint' },
        },
        required: ['from', 'to'],
      },
      execute: (a) => {
        const store = getStore()
        const from = asStr(a.from)
        const to = asStr(a.to)
        if (!store.elements[from]) return err(`No element with id "${from}".`)
        if (!store.elements[to]) return err(`No element with id "${to}".`)
        const input: ElementInput = { type: 'connector', from, to, x: 0, y: 0 }
        if (a.label !== undefined) input.text = asStr(a.label)
        const id = store.addElement(input, 'agent')
        return ok(`Connected ${from} → ${to} (connector id: ${id}).`)
      },
    },
    {
      name: 'duplicate_elements',
      description: 'Duplicate elements by id (offset slightly). Returns the new element ids.',
      inputSchema: {
        type: 'object',
        properties: { ids: { type: 'array', items: { type: 'string' }, description: 'Element ids to duplicate' } },
        required: ['ids'],
      },
      execute: (a) => {
        const ids = Array.isArray(a.ids) ? a.ids.filter((x): x is string => typeof x === 'string') : []
        if (ids.length === 0) return err('Provide an array of element ids.')
        const store = getStore()
        const missing = ids.filter((id) => !store.elements[id])
        if (missing.length) return err(`Unknown ids: ${missing.join(', ')}.`)
        const clones = store.duplicateElements(store.expandGroups(ids), 'agent')
        return ok(`Duplicated ${clones.length} element(s): ${clones.join(', ')}.`)
      },
    },
  ]
}

export { serializeElement }
