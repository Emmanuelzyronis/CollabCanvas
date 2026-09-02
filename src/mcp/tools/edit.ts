import type { CanvasStore } from '../../store/store'
import type { CanvasElement } from '../../types'
import type { AlignEdge } from '../../store/geometry'
import { resolveColor } from '../../constants'
import { asBool, asNum, asStr, asStrArr, err, ok } from '../helpers'
import type { ToolDef } from './create'

type Store = () => CanvasStore

const ALIGN_ENUM = ['left', 'right', 'top', 'bottom', 'centerX', 'centerY'] as const

/** Build a style/geometry patch from loose agent args. */
function buildPatch(a: Record<string, unknown>): Partial<CanvasElement> {
  const patch: Partial<CanvasElement> = {}
  if (a.x !== undefined) patch.x = asNum(a.x)
  if (a.y !== undefined) patch.y = asNum(a.y)
  if (a.width !== undefined) patch.width = asNum(a.width)
  if (a.height !== undefined) patch.height = asNum(a.height)
  if (a.text !== undefined) patch.text = asStr(a.text)
  if (a.fill !== undefined) patch.fill = resolveColor(asStr(a.fill), '#ffffff')
  if (a.stroke !== undefined) patch.stroke = resolveColor(asStr(a.stroke), '#0f172a')
  if (a.textColor !== undefined) patch.textColor = resolveColor(asStr(a.textColor), '#0f172a')
  if (a.strokeWidth !== undefined) patch.strokeWidth = asNum(a.strokeWidth, 2)
  if (a.fontSize !== undefined) patch.fontSize = asNum(a.fontSize, 16)
  if (a.opacity !== undefined) patch.opacity = asNum(a.opacity, 1)
  if (a.dashed !== undefined) patch.dashed = asBool(a.dashed)
  if (a.bold !== undefined) patch.fontWeight = asBool(a.bold) ? 700 : 400
  return patch
}

export function editTools(getStore: Store): ToolDef[] {
  return [
    {
      name: 'update_element',
      description:
        'Update a single element by id. Any of: position (x,y), size (width,height), text, colors (fill/stroke/textColor), strokeWidth, fontSize, opacity, dashed, bold. Only provided fields change.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Element id' },
          x: { type: 'number' },
          y: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number' },
          text: { type: 'string' },
          fill: { type: 'string' },
          stroke: { type: 'string' },
          textColor: { type: 'string' },
          strokeWidth: { type: 'number' },
          fontSize: { type: 'number' },
          opacity: { type: 'number', description: '0..1' },
          dashed: { type: 'boolean' },
          bold: { type: 'boolean' },
        },
        required: ['id'],
      },
      execute: (a) => {
        const store = getStore()
        const id = asStr(a.id)
        if (!store.elements[id]) return err(`No element with id "${id}".`)
        const patch = buildPatch(a)
        if (Object.keys(patch).length === 0) return err('Provide at least one field to update.')
        store.updateElement(id, patch, { author: 'agent' })
        return ok(`Updated ${id}.`)
      },
    },
    {
      name: 'move_elements',
      description: 'Move elements by a delta (dx,dy) in world px. Positive dx = right, positive dy = down.',
      inputSchema: {
        type: 'object',
        properties: {
          ids: { type: 'array', items: { type: 'string' } },
          dx: { type: 'number', description: 'Horizontal delta' },
          dy: { type: 'number', description: 'Vertical delta' },
        },
        required: ['ids', 'dx', 'dy'],
      },
      execute: (a) => {
        const store = getStore()
        const ids = store.expandGroups(asStrArr(a.ids))
        if (ids.length === 0) return err('Provide element ids.')
        store.moveElements(ids, asNum(a.dx), asNum(a.dy), { author: 'agent' })
        return ok(`Moved ${ids.length} element(s) by (${asNum(a.dx)}, ${asNum(a.dy)}).`)
      },
    },
    {
      name: 'set_style',
      description:
        'Restyle one or more elements at once: fill, stroke, textColor, strokeWidth, fontSize, opacity, dashed, bold. Great for theming a whole selection.',
      inputSchema: {
        type: 'object',
        properties: {
          ids: { type: 'array', items: { type: 'string' } },
          fill: { type: 'string' },
          stroke: { type: 'string' },
          textColor: { type: 'string' },
          strokeWidth: { type: 'number' },
          fontSize: { type: 'number' },
          opacity: { type: 'number' },
          dashed: { type: 'boolean' },
          bold: { type: 'boolean' },
        },
        required: ['ids'],
      },
      execute: (a) => {
        const store = getStore()
        const ids = store.expandGroups(asStrArr(a.ids))
        if (ids.length === 0) return err('Provide element ids.')
        const patch = buildPatch({ ...a, x: undefined, y: undefined, width: undefined, height: undefined, text: undefined })
        if (Object.keys(patch).length === 0) return err('Provide at least one style field.')
        store.setStyle(ids, patch, { author: 'agent' })
        return ok(`Styled ${ids.length} element(s).`)
      },
    },
    {
      name: 'delete_elements',
      description: 'Delete elements by id. Connectors touching a deleted element are removed too.',
      inputSchema: {
        type: 'object',
        properties: { ids: { type: 'array', items: { type: 'string' } } },
        required: ['ids'],
      },
      execute: (a) => {
        const store = getStore()
        const ids = store.expandGroups(asStrArr(a.ids))
        if (ids.length === 0) return err('Provide element ids.')
        store.deleteElements(ids, 'agent')
        return ok(`Deleted ${ids.length} element(s).`)
      },
    },
    {
      name: 'group_elements',
      description: 'Group elements so they move and select together. Returns the group id.',
      inputSchema: {
        type: 'object',
        properties: { ids: { type: 'array', items: { type: 'string' } } },
        required: ['ids'],
      },
      execute: (a) => {
        const store = getStore()
        const ids = asStrArr(a.ids)
        if (ids.length < 2) return err('Grouping needs at least 2 element ids.')
        const groupId = store.groupElements(ids, 'agent')
        return groupId ? ok(`Grouped ${ids.length} elements (group: ${groupId}).`) : err('Could not group.')
      },
    },
    {
      name: 'ungroup_elements',
      description: 'Ungroup elements (dissolve their group membership).',
      inputSchema: {
        type: 'object',
        properties: { ids: { type: 'array', items: { type: 'string' } } },
        required: ['ids'],
      },
      execute: (a) => {
        const store = getStore()
        const ids = asStrArr(a.ids)
        if (ids.length === 0) return err('Provide element ids.')
        store.ungroupElements(ids, 'agent')
        return ok(`Ungrouped.`)
      },
    },
    {
      name: 'align_elements',
      description: 'Align elements to a shared edge: left, right, top, bottom, centerX, or centerY.',
      inputSchema: {
        type: 'object',
        properties: {
          ids: { type: 'array', items: { type: 'string' } },
          edge: { type: 'string', enum: ALIGN_ENUM },
        },
        required: ['ids', 'edge'],
      },
      execute: (a) => {
        const store = getStore()
        const ids = store.expandGroups(asStrArr(a.ids))
        const edge = asStr(a.edge) as AlignEdge
        if (ids.length < 2) return err('Aligning needs at least 2 elements.')
        if (!ALIGN_ENUM.includes(edge as (typeof ALIGN_ENUM)[number])) return err(`Unknown edge "${a.edge}".`)
        store.alignElements(ids, edge, 'agent')
        return ok(`Aligned ${ids.length} elements to ${edge}.`)
      },
    },
    {
      name: 'distribute_elements',
      description: 'Evenly space 3+ elements along an axis: horizontal or vertical.',
      inputSchema: {
        type: 'object',
        properties: {
          ids: { type: 'array', items: { type: 'string' } },
          axis: { type: 'string', enum: ['horizontal', 'vertical'] },
        },
        required: ['ids', 'axis'],
      },
      execute: (a) => {
        const store = getStore()
        const ids = store.expandGroups(asStrArr(a.ids))
        const axis = asStr(a.axis) === 'vertical' ? 'vertical' : 'horizontal'
        if (ids.length < 3) return err('Distributing needs at least 3 elements.')
        store.distributeElements(ids, axis, 'agent')
        return ok(`Distributed ${ids.length} elements (${axis}).`)
      },
    },
    {
      name: 'arrange_grid',
      description: 'Lay elements out in a tidy grid. Optional columns and gap (px).',
      inputSchema: {
        type: 'object',
        properties: {
          ids: { type: 'array', items: { type: 'string' } },
          columns: { type: 'number' },
          gap: { type: 'number', description: 'Default 32' },
        },
        required: ['ids'],
      },
      execute: (a) => {
        const store = getStore()
        const ids = store.expandGroups(asStrArr(a.ids))
        if (ids.length === 0) return err('Provide element ids.')
        const opts: { columns?: number; gap?: number } = {}
        if (a.columns !== undefined) opts.columns = asNum(a.columns)
        if (a.gap !== undefined) opts.gap = asNum(a.gap, 32)
        store.arrangeGrid(ids, opts, 'agent')
        return ok(`Arranged ${ids.length} elements in a grid.`)
      },
    },
  ]
}
