import type { CanvasStore } from '../../store/store'
import type { BoardSnapshot } from '../../types'
import { asStr, err, ok } from '../helpers'
import type { ToolDef } from './create'

type Store = () => CanvasStore

export function boardTools(getStore: Store): ToolDef[] {
  return [
    {
      name: 'clear_board',
      description: 'Remove every element and comment from the board. This is undoable by the human (Ctrl+Z). Use with care.',
      inputSchema: { type: 'object', properties: {} },
      execute: () => {
        const store = getStore()
        const n = store.order.length
        store.clearBoard('agent')
        return ok(`Cleared the board (${n} element(s) removed). The human can undo with Ctrl+Z.`)
      },
    },
    {
      name: 'load_board',
      description:
        'Replace the board with a JSON snapshot previously produced by export_json. Pass the snapshot object as "snapshot". Undoable by the human.',
      inputSchema: {
        type: 'object',
        properties: {
          snapshot: { type: 'object', description: 'A BoardSnapshot object { version, elements, order, comments }' },
        },
        required: ['snapshot'],
      },
      execute: (a) => {
        const raw = a.snapshot
        if (!raw || typeof raw !== 'object') return err('Provide a snapshot object.')
        const snap = raw as Partial<BoardSnapshot>
        if (!snap.elements || !Array.isArray(snap.order)) return err('Snapshot must have "elements" and "order".')
        const store = getStore()
        store.loadSnapshot({ version: 1, elements: snap.elements as BoardSnapshot['elements'], order: snap.order, comments: snap.comments ?? [] }, 'agent')
        return ok(`Loaded a board with ${snap.order.length} element(s).`)
      },
    },
    {
      name: 'agent_say',
      description:
        'Post a short chat-style message to the activity feed as the agent (does not modify the board). Use to narrate what you are doing or answer the human conversationally.',
      inputSchema: {
        type: 'object',
        properties: { message: { type: 'string' } },
        required: ['message'],
      },
      execute: (a) => {
        const store = getStore()
        const msg = asStr(a.message)
        if (!msg) return err('Provide a message.')
        store.logActivity('agent', 'comment', `${store.agent.name}: ${msg}`, [])
        return ok('Message posted to the activity feed.')
      },
    },
  ]
}
