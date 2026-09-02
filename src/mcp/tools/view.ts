import type { CanvasStore } from '../../store/store'
import { asNum, asStr, err, ok } from '../helpers'
import type { ToolDef } from './create'

type Store = () => CanvasStore

export function viewTools(getStore: Store): ToolDef[] {
  return [
    {
      name: 'set_camera',
      description: 'Move/zoom the viewport. x,y = world coordinate shown at the top-left; zoom = 0.1..4 (1 = 100%).',
      inputSchema: {
        type: 'object',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' },
          zoom: { type: 'number', description: '0.1 to 4' },
        },
      },
      execute: (a) => {
        const store = getStore()
        const patch: { x?: number; y?: number; zoom?: number } = {}
        if (a.x !== undefined) patch.x = asNum(a.x)
        if (a.y !== undefined) patch.y = asNum(a.y)
        if (a.zoom !== undefined) patch.zoom = asNum(a.zoom, 1)
        store.setCamera(patch)
        return ok('Camera updated.')
      },
    },
    {
      name: 'zoom_to_fit',
      description: 'Zoom and pan so all elements (or a given subset by id) fit in view. Call after generating a layout so the human sees the result.',
      inputSchema: {
        type: 'object',
        properties: { ids: { type: 'array', items: { type: 'string' }, description: 'Optional subset to fit' } },
      },
      execute: (a) => {
        const store = getStore()
        const ids = Array.isArray(a.ids) ? a.ids.filter((x): x is string => typeof x === 'string') : undefined
        store.zoomToFit(ids, 'agent')
        return ok('Zoomed to fit.')
      },
    },
    {
      name: 'focus_element',
      description: 'Center and zoom the viewport on a single element by id.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      execute: (a) => {
        const store = getStore()
        const id = asStr(a.id)
        if (!store.elements[id]) return err(`No element with id "${id}".`)
        store.focusElement(id, 'agent')
        return ok(`Focused on ${id}.`)
      },
    },
    {
      name: 'add_comment',
      description:
        'Leave a comment on the board, signed by the agent. Optionally anchor it to an element by id, otherwise place it at world (x,y). Use to explain suggestions or flag issues.',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          targetId: { type: 'string', description: 'Element id to attach the comment to' },
          x: { type: 'number', description: 'World X if not attached' },
          y: { type: 'number', description: 'World Y if not attached' },
        },
        required: ['text'],
      },
      execute: (a) => {
        const store = getStore()
        const targetId = a.targetId !== undefined ? asStr(a.targetId) : null
        let x = asNum(a.x)
        let y = asNum(a.y)
        if (targetId && store.elements[targetId]) {
          const el = store.elements[targetId]
          x = el.x + el.width + 16
          y = el.y
        }
        const id = store.addComment({ x, y, text: asStr(a.text), author: 'agent', targetId: targetId && store.elements[targetId] ? targetId : null })
        return ok(`Added comment (id: ${id}).`)
      },
    },
    {
      name: 'set_agent_presence',
      description:
        'Update the agent’s live status shown to the human (e.g. "Building a kanban board…") and optionally its cursor position in world coords. Set status to an empty string to clear it.',
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Short status message, or "" to clear' },
          cursorX: { type: 'number' },
          cursorY: { type: 'number' },
        },
      },
      execute: (a) => {
        const store = getStore()
        const patch: { status?: string | null; cursor?: { x: number; y: number } | null } = {}
        if (a.status !== undefined) {
          const s = asStr(a.status)
          patch.status = s === '' ? null : s
        }
        if (a.cursorX !== undefined && a.cursorY !== undefined) {
          patch.cursor = { x: asNum(a.cursorX), y: asNum(a.cursorY) }
        }
        store.setAgentPresence(patch)
        return ok('Presence updated.')
      },
    },
  ]
}
