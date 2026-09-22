import { getCanonicalGraph } from '../../graph/canonicalGraph'
import { loadGraphIntoCanvas } from '../../graph/canvasStoreAdapter'
import { runEditorCommand } from '../../application/commands'
import { useCanvasStore } from '../../store/store'
import { NODE_TYPES } from '../../../server/domain/graph-types'
import { err, ok, okJson } from '../helpers'
import type { ToolDef } from './create'

/**
 * Canonical Design Graph WebMCP tools.
 *
 * These route every mutation through the canonical editor command bus
 * (POST /api/v1/documents/:id/commands) rather than the local Zustand canvas
 * store. After each mutation the canvas projection is reconciled from the
 * returned graph so both surfaces stay in sync.
 *
 * They are named with the `cc_` prefix to distinguish them from the legacy
 * whiteboard tools that operate on a different element model.
 */

const NODE_TYPE_ENUM = NODE_TYPES.filter((t) => t !== 'page' && t !== 'component-instance')

function requireDocumentId(): string | null {
  return getCanonicalGraph()?.document.id ?? null
}

function reconcileFromGraph(graph: Parameters<typeof loadGraphIntoCanvas>[0]): void {
  loadGraphIntoCanvas(graph, useCanvasStore.getState().loadSnapshot)
}

export function canonicalTools(): ToolDef[] {
  return [
    {
      name: 'cc_get_graph',
      description:
        'Read the current canonical Design Graph (project, document, page, nodes, tokens, and component definitions). Returns null when no design is loaded. Use this to understand the current state before issuing mutations.',
      annotations: { readOnlyHint: true },
      inputSchema: { type: 'object', properties: {} },
      execute: () => {
        const graph = getCanonicalGraph()
        if (!graph) return err('No canonical design is loaded. Open a design first.')
        const summary = {
          project: { id: graph.project.id, name: graph.project.name },
          document: { id: graph.document.id, name: graph.document.name },
          page: { id: graph.page.id, name: graph.page.name },
          nodeCount: graph.nodes.length,
          nodes: graph.nodes.map((n) => ({
            id: n.id,
            type: n.type,
            name: n.name,
            parentId: n.parentId ?? null,
            orderIndex: n.orderIndex,
            layout: n.layout,
            ...(n.properties && Object.keys(n.properties).length ? { properties: n.properties } : {}),
          })),
          tokenCount: graph.tokens.length,
          componentDefinitionCount: graph.componentDefinitions.length,
        }
        return okJson(`Canonical graph for "${graph.document.name}"`, summary)
      },
    },
    {
      name: 'cc_create_node',
      description:
        `Create a node in the canonical Design Graph and persist it through the command bus. The graph is the source of truth — this bypasses the legacy board model. Returns the new node id.\n\nSupported types: ${NODE_TYPE_ENUM.join(', ')}.`,
      inputSchema: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: NODE_TYPE_ENUM, description: 'Node type' },
          name: { type: 'string', description: 'Node name (label in the layers panel)' },
          parentId: { type: 'string', description: 'Parent node id (omit for top-level)' },
          x: { type: 'number', description: 'X position (world px)' },
          y: { type: 'number', description: 'Y position (world px)' },
          width: { type: 'number', description: 'Width in px' },
          height: { type: 'number', description: 'Height in px' },
          text: { type: 'string', description: 'Text content (for text/heading/button nodes)' },
        },
        required: ['type', 'name'],
      },
      execute: async (a) => {
        const documentId = requireDocumentId()
        if (!documentId) return err('No canonical design is loaded. Open a design first.')
        const type = typeof a.type === 'string' ? a.type : ''
        if (!NODE_TYPE_ENUM.includes(type as (typeof NODE_TYPE_ENUM)[number])) {
          return err(`Unknown node type "${type}". Supported: ${NODE_TYPE_ENUM.join(', ')}.`)
        }
        const name = typeof a.name === 'string' && a.name.trim() ? a.name.trim() : type.charAt(0).toUpperCase() + type.slice(1)
        const layout: Record<string, unknown> = {}
        if (a.x !== undefined) layout.x = Number(a.x)
        if (a.y !== undefined) layout.y = Number(a.y)
        if (a.width !== undefined) layout.width = Number(a.width)
        if (a.height !== undefined) layout.height = Number(a.height)
        const payload: Record<string, unknown> = { type, name, ...(Object.keys(layout).length ? { layout } : {}) }
        if (typeof a.parentId === 'string' && a.parentId.trim()) payload.parentId = a.parentId.trim()
        if (typeof a.text === 'string') payload.properties = { text: a.text }
        try {
          const result = await runEditorCommand(documentId, 'create', payload)
          reconcileFromGraph(result.graph)
          return ok(`Created ${type} node "${name}" (id: ${result.nodeId ?? 'unknown'}).`)
        } catch (e) {
          return err(e instanceof Error ? e.message : 'The create command failed.')
        }
      },
    },
    {
      name: 'cc_update_node',
      description:
        'Update layout or properties of an existing canonical node. Only the provided fields change. For text content provide the "text" field; for position provide x/y; for size provide width/height.',
      inputSchema: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Node id to update' },
          name: { type: 'string', description: 'New display name' },
          x: { type: 'number', description: 'New X position' },
          y: { type: 'number', description: 'New Y position' },
          width: { type: 'number', description: 'New width in px' },
          height: { type: 'number', description: 'New height in px' },
          text: { type: 'string', description: 'New text content' },
        },
        required: ['nodeId'],
      },
      execute: async (a) => {
        const documentId = requireDocumentId()
        if (!documentId) return err('No canonical design is loaded. Open a design first.')
        const nodeId = typeof a.nodeId === 'string' ? a.nodeId.trim() : ''
        if (!nodeId) return err('nodeId is required.')
        const graph = getCanonicalGraph()
        const node = graph?.nodes.find((n) => n.id === nodeId)
        if (!node) return err(`No node with id "${nodeId}".`)
        const patch: Record<string, unknown> = {}
        if (typeof a.name === 'string' && a.name.trim()) patch.name = a.name.trim()
        if (a.x !== undefined || a.y !== undefined || a.width !== undefined || a.height !== undefined) {
          patch.layout = {
            ...(node.layout ?? {}),
            ...(a.x !== undefined ? { x: Number(a.x) } : {}),
            ...(a.y !== undefined ? { y: Number(a.y) } : {}),
            ...(a.width !== undefined ? { width: Number(a.width) } : {}),
            ...(a.height !== undefined ? { height: Number(a.height) } : {}),
          }
        }
        if (typeof a.text === 'string') {
          patch.properties = { ...(typeof node.properties === 'object' && node.properties ? node.properties : {}), text: a.text }
        }
        if (!Object.keys(patch).length) return err('Provide at least one field to update (name, x, y, width, height, or text).')
        try {
          const result = await runEditorCommand(documentId, 'update', { nodeId, patch })
          reconcileFromGraph(result.graph)
          return ok(`Updated node "${nodeId}".`)
        } catch (e) {
          return err(e instanceof Error ? e.message : 'The update command failed.')
        }
      },
    },
    {
      name: 'cc_resize_node',
      description: 'Resize a canonical node to the given width and height, and optionally reposition it.',
      inputSchema: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Node id to resize' },
          width: { type: 'number', description: 'New width in px' },
          height: { type: 'number', description: 'New height in px' },
          x: { type: 'number', description: 'Optional new X position' },
          y: { type: 'number', description: 'Optional new Y position' },
        },
        required: ['nodeId', 'width', 'height'],
      },
      execute: async (a) => {
        const documentId = requireDocumentId()
        if (!documentId) return err('No canonical design is loaded. Open a design first.')
        const nodeId = typeof a.nodeId === 'string' ? a.nodeId.trim() : ''
        if (!nodeId) return err('nodeId is required.')
        const width = Number(a.width)
        const height = Number(a.height)
        if (!Number.isFinite(width) || !Number.isFinite(height)) return err('width and height must be finite numbers.')
        const payload: Record<string, unknown> = { nodeId, width, height }
        if (a.x !== undefined) payload.x = Number(a.x)
        if (a.y !== undefined) payload.y = Number(a.y)
        try {
          const result = await runEditorCommand(documentId, 'resize', payload)
          reconcileFromGraph(result.graph)
          return ok(`Resized node "${nodeId}" to ${width}×${height}px.`)
        } catch (e) {
          return err(e instanceof Error ? e.message : 'The resize command failed.')
        }
      },
    },
    {
      name: 'cc_move_node',
      description: 'Re-parent or reorder a canonical node in the tree.',
      inputSchema: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Node id to move' },
          parentId: { type: 'string', description: 'New parent node id (omit or pass null for top-level)' },
          orderIndex: { type: 'number', description: 'New position among siblings (0-based)' },
        },
        required: ['nodeId'],
      },
      execute: async (a) => {
        const documentId = requireDocumentId()
        if (!documentId) return err('No canonical design is loaded. Open a design first.')
        const nodeId = typeof a.nodeId === 'string' ? a.nodeId.trim() : ''
        if (!nodeId) return err('nodeId is required.')
        const parentId = a.parentId === null || a.parentId === undefined ? null : typeof a.parentId === 'string' ? a.parentId.trim() || null : null
        const payload: Record<string, unknown> = { nodeId, parentId }
        if (a.orderIndex !== undefined) payload.orderIndex = Number(a.orderIndex)
        try {
          const result = await runEditorCommand(documentId, 'move', payload)
          reconcileFromGraph(result.graph)
          return ok(`Moved node "${nodeId}" to parent "${parentId ?? '(root)'}'.`)
        } catch (e) {
          return err(e instanceof Error ? e.message : 'The move command failed.')
        }
      },
    },
    {
      name: 'cc_delete_node',
      description: 'Delete a canonical node and all its descendants from the Design Graph. This is permanent (undo via the editor undo stack).',
      inputSchema: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Node id to delete' },
        },
        required: ['nodeId'],
      },
      execute: async (a) => {
        const documentId = requireDocumentId()
        if (!documentId) return err('No canonical design is loaded. Open a design first.')
        const nodeId = typeof a.nodeId === 'string' ? a.nodeId.trim() : ''
        if (!nodeId) return err('nodeId is required.')
        try {
          const result = await runEditorCommand(documentId, 'delete', { nodeId })
          reconcileFromGraph(result.graph)
          return ok(`Deleted node "${nodeId}" and its descendants.`)
        } catch (e) {
          return err(e instanceof Error ? e.message : 'The delete command failed.')
        }
      },
    },
    {
      name: 'cc_duplicate_node',
      description: 'Duplicate a canonical node (and its subtree) as a sibling in the Design Graph. Returns the new node id.',
      inputSchema: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Node id to duplicate' },
        },
        required: ['nodeId'],
      },
      execute: async (a) => {
        const documentId = requireDocumentId()
        if (!documentId) return err('No canonical design is loaded. Open a design first.')
        const nodeId = typeof a.nodeId === 'string' ? a.nodeId.trim() : ''
        if (!nodeId) return err('nodeId is required.')
        try {
          const result = await runEditorCommand(documentId, 'duplicate', { nodeId })
          reconcileFromGraph(result.graph)
          return ok(`Duplicated node "${nodeId}" → new id: ${result.nodeId ?? 'unknown'}.`)
        } catch (e) {
          return err(e instanceof Error ? e.message : 'The duplicate command failed.')
        }
      },
    },
  ]
}
