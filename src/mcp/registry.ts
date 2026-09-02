import { allTools, type ToolDef } from './tools'
import type { ToolResult } from './helpers'

/**
 * Central WebMCP registry.
 *
 * Keeps our own name→execute map (so the in-page Agent Console can drive tools
 * without depending on Chrome-only executeTool), and mirrors every tool into
 * `document.modelContext` when the WebMCP API (native or polyfilled) is present.
 */

let TOOLS: ToolDef[] = []
const BY_NAME = new Map<string, ToolDef>()

function buildRegistry(): void {
  if (TOOLS.length) return
  TOOLS = allTools()
  for (const t of TOOLS) BY_NAME.set(t.name, t)
}

export function getToolDefs(): ToolDef[] {
  buildRegistry()
  return TOOLS
}

/** Execute a tool by name through our own registry. Always returns a ToolResult. */
export async function callTool(name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
  buildRegistry()
  const tool = BY_NAME.get(name)
  if (!tool) return { content: [{ type: 'text', text: `Error: unknown tool "${name}".` }], isError: true }
  try {
    return await tool.execute(args)
  } catch (e) {
    return { content: [{ type: 'text', text: `Error: ${(e as Error).message}` }], isError: true }
  }
}

/** True when a WebMCP host (Chrome flag or polyfill) exposes document.modelContext. */
export function isWebMcpAvailable(): boolean {
  return typeof document !== 'undefined' && !!document.modelContext
}

/**
 * Register every tool with document.modelContext.
 * Returns an unregister function (drives an AbortController the host respects).
 */
export async function registerAll(): Promise<() => void> {
  buildRegistry()
  const mc = typeof document !== 'undefined' ? document.modelContext : undefined
  if (!mc) return () => {}

  const controller = new AbortController()
  for (const tool of TOOLS) {
    try {
      await mc.registerTool(
        {
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          ...(tool.annotations ? { annotations: tool.annotations } : {}),
          execute: (input: unknown) => tool.execute((input ?? {}) as Record<string, unknown>),
        },
        { signal: controller.signal },
      )
    } catch (e) {
      console.warn(`[CollabCanvas] Failed to register tool "${tool.name}":`, e)
    }
  }
  return () => controller.abort()
}
