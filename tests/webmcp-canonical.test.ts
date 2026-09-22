import { describe, expect, it, beforeEach, vi } from 'vitest'
import { publishCanonicalGraph, getCanonicalGraph } from '../src/graph/canonicalGraph'
import { canonicalTools } from '../src/mcp/tools/canonical'
import { createInvoiceFlowGraph } from '../server/domain/fixtures/invoiceflow'

/**
 * EMM-101 WebMCP canonical convergence — unit tests.
 *
 * These tests verify that the canonical WebMCP tools:
 * 1. Read document identity from the published canonical graph.
 * 2. Delegate every mutation to runEditorCommand (command bus) instead of
 *    writing directly to the Zustand canvas store.
 * 3. Return meaningful error messages when no design is loaded.
 * 4. Reconcile the canvas after each successful mutation.
 */

const graph = createInvoiceFlowGraph()

// Stub runEditorCommand — the tool imports it at module scope, so we intercept
// via vi.mock before any tool execute() call.
vi.mock('../src/application/commands', () => ({
  runEditorCommand: vi.fn(),
}))
vi.mock('../src/graph/canvasStoreAdapter', () => ({
  loadGraphIntoCanvas: vi.fn(),
}))
vi.mock('../src/store/store', () => ({
  useCanvasStore: { getState: () => ({ loadSnapshot: vi.fn() }) },
}))

import { runEditorCommand } from '../src/application/commands'
import { loadGraphIntoCanvas } from '../src/graph/canvasStoreAdapter'

const mockRunEditorCommand = vi.mocked(runEditorCommand)
const mockLoadGraphIntoCanvas = vi.mocked(loadGraphIntoCanvas)

function makeCommandResult(nodeId: string | null = null) {
  return {
    graph,
    nodeId,
    version: { baseVersionId: null, currentVersionId: 'v1', revision: 1, status: 'draft' as const },
    validation: { valid: true as const },
  }
}

describe('cc_ canonical WebMCP tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    publishCanonicalGraph(graph)
  })

  it('cc_get_graph returns a structured summary of the loaded canonical graph', async () => {
    const tools = canonicalTools()
    const tool = tools.find((t) => t.name === 'cc_get_graph')!
    const result = await tool.execute({})
    expect(result.isError).toBeFalsy()
    const text = result.content[0].text
    expect(text).toContain(graph.document.name)
    expect(text).toContain(graph.project.id)
    expect(text).toContain('"nodeCount"')
  })

  it('cc_get_graph returns an error when no design is loaded', async () => {
    publishCanonicalGraph(null)
    const tools = canonicalTools()
    const tool = tools.find((t) => t.name === 'cc_get_graph')!
    const result = await tool.execute({})
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('No canonical design is loaded')
  })

  it('cc_create_node calls runEditorCommand with create command and reconciles canvas', async () => {
    mockRunEditorCommand.mockResolvedValueOnce(makeCommandResult('new-node-1'))
    const tools = canonicalTools()
    const tool = tools.find((t) => t.name === 'cc_create_node')!
    const result = await tool.execute({ type: 'section', name: 'Hero section', x: 0, y: 0, width: 1440, height: 600 })
    expect(result.isError).toBeFalsy()
    expect(mockRunEditorCommand).toHaveBeenCalledWith(
      graph.document.id,
      'create',
      expect.objectContaining({ type: 'section', name: 'Hero section', layout: { x: 0, y: 0, width: 1440, height: 600 } }),
    )
    expect(mockLoadGraphIntoCanvas).toHaveBeenCalledWith(graph, expect.any(Function))
    expect(result.content[0].text).toContain('new-node-1')
  })

  it('cc_create_node with text property forwards it as properties.text', async () => {
    mockRunEditorCommand.mockResolvedValueOnce(makeCommandResult('txt-1'))
    const tools = canonicalTools()
    const tool = tools.find((t) => t.name === 'cc_create_node')!
    await tool.execute({ type: 'text', name: 'Body copy', text: 'Hello world' })
    expect(mockRunEditorCommand).toHaveBeenCalledWith(
      graph.document.id,
      'create',
      expect.objectContaining({ properties: { text: 'Hello world' } }),
    )
  })

  it('cc_create_node rejects unknown node types', async () => {
    const tools = canonicalTools()
    const tool = tools.find((t) => t.name === 'cc_create_node')!
    const result = await tool.execute({ type: 'widget', name: 'Bad type' })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Unknown node type')
    expect(mockRunEditorCommand).not.toHaveBeenCalled()
  })

  it('cc_create_node returns error when no design is loaded', async () => {
    publishCanonicalGraph(null)
    const tools = canonicalTools()
    const tool = tools.find((t) => t.name === 'cc_create_node')!
    const result = await tool.execute({ type: 'section', name: 'X' })
    expect(result.isError).toBe(true)
    expect(mockRunEditorCommand).not.toHaveBeenCalled()
  })

  it('cc_update_node calls update command with merged layout patch', async () => {
    mockRunEditorCommand.mockResolvedValueOnce(makeCommandResult(null))
    const tools = canonicalTools()
    const tool = tools.find((t) => t.name === 'cc_update_node')!
    const existingNodeId = graph.nodes[0].id
    const result = await tool.execute({ nodeId: existingNodeId, x: 100, y: 200 })
    expect(result.isError).toBeFalsy()
    expect(mockRunEditorCommand).toHaveBeenCalledWith(
      graph.document.id,
      'update',
      expect.objectContaining({ nodeId: existingNodeId, patch: expect.objectContaining({ layout: expect.objectContaining({ x: 100, y: 200 }) }) }),
    )
    expect(mockLoadGraphIntoCanvas).toHaveBeenCalled()
  })

  it('cc_update_node returns error for unknown node id', async () => {
    const tools = canonicalTools()
    const tool = tools.find((t) => t.name === 'cc_update_node')!
    const result = await tool.execute({ nodeId: 'does-not-exist', x: 0 })
    expect(result.isError).toBe(true)
    expect(mockRunEditorCommand).not.toHaveBeenCalled()
  })

  it('cc_resize_node calls resize command with width and height', async () => {
    mockRunEditorCommand.mockResolvedValueOnce(makeCommandResult(null))
    const tools = canonicalTools()
    const tool = tools.find((t) => t.name === 'cc_resize_node')!
    const nodeId = graph.nodes[0].id
    const result = await tool.execute({ nodeId, width: 800, height: 400 })
    expect(result.isError).toBeFalsy()
    expect(mockRunEditorCommand).toHaveBeenCalledWith(graph.document.id, 'resize', { nodeId, width: 800, height: 400 })
    expect(mockLoadGraphIntoCanvas).toHaveBeenCalled()
  })

  it('cc_delete_node calls delete command and reconciles canvas', async () => {
    mockRunEditorCommand.mockResolvedValueOnce(makeCommandResult(null))
    const tools = canonicalTools()
    const tool = tools.find((t) => t.name === 'cc_delete_node')!
    const nodeId = graph.nodes[0].id
    const result = await tool.execute({ nodeId })
    expect(result.isError).toBeFalsy()
    expect(mockRunEditorCommand).toHaveBeenCalledWith(graph.document.id, 'delete', { nodeId })
    expect(mockLoadGraphIntoCanvas).toHaveBeenCalled()
  })

  it('cc_duplicate_node calls duplicate command and returns new node id', async () => {
    mockRunEditorCommand.mockResolvedValueOnce(makeCommandResult('dup-node-1'))
    const tools = canonicalTools()
    const tool = tools.find((t) => t.name === 'cc_duplicate_node')!
    const nodeId = graph.nodes[0].id
    const result = await tool.execute({ nodeId })
    expect(result.isError).toBeFalsy()
    expect(mockRunEditorCommand).toHaveBeenCalledWith(graph.document.id, 'duplicate', { nodeId })
    expect(result.content[0].text).toContain('dup-node-1')
  })

  it('cc_move_node calls move command with parentId and orderIndex', async () => {
    mockRunEditorCommand.mockResolvedValueOnce(makeCommandResult(null))
    const tools = canonicalTools()
    const tool = tools.find((t) => t.name === 'cc_move_node')!
    const nodeId = graph.nodes[0].id
    const result = await tool.execute({ nodeId, parentId: null, orderIndex: 2 })
    expect(result.isError).toBeFalsy()
    expect(mockRunEditorCommand).toHaveBeenCalledWith(graph.document.id, 'move', { nodeId, parentId: null, orderIndex: 2 })
  })

  it('all canonical tools surface command bus errors as tool errors', async () => {
    mockRunEditorCommand.mockRejectedValue(new Error('VERSION_CONFLICT: stale base version'))
    const tools = canonicalTools()
    const createTool = tools.find((t) => t.name === 'cc_create_node')!
    const result = await createTool.execute({ type: 'text', name: 'X' })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('VERSION_CONFLICT')
  })

  it('canonical tool suite is registered in allTools() alongside legacy board tools', async () => {
    const { allTools } = await import('../src/mcp/tools/index')
    const tools = allTools()
    const names = tools.map((t) => t.name)
    expect(names).toContain('cc_get_graph')
    expect(names).toContain('cc_create_node')
    expect(names).toContain('cc_update_node')
    expect(names).toContain('cc_resize_node')
    expect(names).toContain('cc_move_node')
    expect(names).toContain('cc_delete_node')
    expect(names).toContain('cc_duplicate_node')
    // Legacy tools remain
    expect(names).toContain('create_shape')
    expect(names).toContain('update_element')
  })

  it('cc_get_graph is marked read-only', () => {
    const tools = canonicalTools()
    const tool = tools.find((t) => t.name === 'cc_get_graph')!
    expect(tool.annotations?.readOnlyHint).toBe(true)
  })
})
