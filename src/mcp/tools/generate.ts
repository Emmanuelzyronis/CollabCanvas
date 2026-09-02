import type { CanvasStore } from '../../store/store'
import type { ElementInput } from '../../types'
import { asNum, asStr, asStrArr, err, ok } from '../helpers'
import { generateLayout, LAYOUT_KINDS, type LayoutKind, type LayoutSpec } from '../layouts'
import type { ToolDef } from './create'

type Store = () => CanvasStore

export function generateTools(getStore: Store): ToolDef[] {
  return [
    {
      name: 'generate_layout',
      description:
        `Generate a whole diagram in one call from a template: ${LAYOUT_KINDS.join(', ')}. ` +
        'Provide "items" (steps/cards/branches/reports/fields) and optionally "columns" (kanban) and a "title" (mindmap center / org root / screen name). ' +
        'Elements are placed at world origin (originX,originY) and connected automatically where the template implies relationships. Returns the new element ids.',
      inputSchema: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: LAYOUT_KINDS, description: 'Template to generate' },
          title: { type: 'string', description: 'Central label (mindmap/org root/screen/form title)' },
          items: { type: 'array', items: { type: 'string' }, description: 'Steps, cards, branches, reports, or fields' },
          columns: { type: 'array', items: { type: 'string' }, description: 'Column names (kanban)' },
          originX: { type: 'number', description: 'World X origin (default 0)' },
          originY: { type: 'number', description: 'World Y origin (default 0)' },
        },
        required: ['kind'],
      },
      execute: (a) => {
        const store = getStore()
        const kind = asStr(a.kind) as LayoutKind
        if (!LAYOUT_KINDS.includes(kind)) return err(`Unknown layout "${a.kind}". Use one of: ${LAYOUT_KINDS.join(', ')}.`)
        const spec: LayoutSpec = { kind }
        if (a.title !== undefined) spec.title = asStr(a.title)
        if (a.items !== undefined) spec.items = asStrArr(a.items)
        if (a.columns !== undefined) spec.columns = asStrArr(a.columns)
        if (a.originX !== undefined) spec.originX = asNum(a.originX)
        if (a.originY !== undefined) spec.originY = asNum(a.originY)

        const { elements, connections } = generateLayout(spec)
        if (elements.length === 0) return err('Layout produced no elements.')

        store.setAgentPresence({ status: `Building a ${kind}…` })
        const ids = store.addElements(elements, 'agent')

        // Wire connectors by index into the freshly created ids.
        if (connections.length) {
          const conns: ElementInput[] = connections
            .filter((c) => ids[c.fromIndex] && ids[c.toIndex])
            .map((c) => ({ type: 'connector', from: ids[c.fromIndex], to: ids[c.toIndex], x: 0, y: 0, ...(c.label ? { text: c.label } : {}) }))
          if (conns.length) store.addElements(conns, 'agent')
        }

        store.zoomToFit(ids, 'agent')
        store.setAgentPresence({ status: null })
        store.logActivity('agent', 'generate', `Generated a ${kind} (${ids.length} elements)`, ids)
        return ok(`Generated a ${kind} with ${ids.length} element(s)${connections.length ? ` and ${connections.length} connector(s)` : ''}. Element ids: ${ids.join(', ')}.`)
      },
    },
    {
      name: 'suggest_alternatives',
      description:
        'Suggest concrete next actions or layout variations for the current board without changing it. Returns a numbered list of suggestions the human can approve. Use before making big changes.',
      inputSchema: {
        type: 'object',
        properties: { focus: { type: 'string', description: 'Optional area to focus suggestions on' } },
        annotations: { readOnlyHint: true },
      },
      annotations: { readOnlyHint: true },
      execute: (a) => {
        const store = getStore()
        const els = store.getElements()
        const focus = asStr(a.focus)
        const suggestions: string[] = []
        if (els.length === 0) {
          suggestions.push('Generate a kanban board with To Do / In Progress / Done columns.')
          suggestions.push('Generate a flowchart of your process (call generate_layout kind="flowchart").')
          suggestions.push('Drop a few sticky notes to start brainstorming.')
        } else {
          const stickies = els.filter((e) => e.type === 'sticky')
          const shapes = els.filter((e) => e.type === 'rectangle' || e.type === 'ellipse' || e.type === 'diamond')
          const connectors = els.filter((e) => e.type === 'connector')
          if (stickies.length >= 3) suggestions.push(`Group your ${stickies.length} sticky notes into a tidy grid (arrange_grid).`)
          if (shapes.length >= 2 && connectors.length === 0) suggestions.push('Connect related shapes with arrows to show flow (create_connector).')
          if (shapes.length >= 2) suggestions.push('Align and evenly distribute the shapes for a cleaner look (align_elements + distribute_elements).')
          suggestions.push('Apply a consistent color theme across the board (set_style).')
          suggestions.push('Add a frame around related items to label the section (create_frame).')
        }
        const list = suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')
        return ok(`${focus ? `Suggestions for "${focus}":\n` : 'Suggestions:\n'}${list}\n\nApprove one and I'll apply it.`)
      },
    },
  ]
}
