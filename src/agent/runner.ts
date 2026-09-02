import { callTool } from '../mcp/registry'
import { useCanvasStore } from '../store/store'
import { interpret, type PlannedCall } from './intent'
import { canUseAi, runWithAi } from './aiRunner'

/**
 * Bridges the natural-language interpreter to the WebMCP registry. Most planned
 * calls map straight to a registered tool; a few pseudo-tools (prefixed `__`)
 * resolve a scope ("selection" vs "all") into concrete element ids first, then
 * fan out to real tools. This keeps the interpreter dumb and the store the only
 * source of truth for what is selected.
 */

export interface RunResult {
  ok: boolean
  reply: string
  detail?: string
}

/** Resolve the id set a scoped command should act on. */
function scopeIds(scope: unknown): string[] {
  const store = useCanvasStore.getState()
  if (scope === 'all') return [...store.order]
  return [...store.selection]
}

async function runPlanned(call: PlannedCall): Promise<RunResult> {
  const { tool, args } = call

  // --- pseudo-tools: scope → real tool ---
  if (tool === '__style_scope') {
    const ids = scopeIds(args.scope)
    if (ids.length === 0) return { ok: false, reply: 'Nothing selected — select some elements first, or say "make everything <color>".' }
    const res = await callTool('set_style', { ids, ...(args.patch as Record<string, unknown>) })
    return { ok: !res.isError, reply: res.isError ? textOf(res) : `Restyled ${ids.length} element(s).`, detail: textOf(res) }
  }
  if (tool === '__arrange_scope') {
    const ids = scopeIds(args.scope)
    if (ids.length === 0) return { ok: false, reply: 'Nothing to arrange — select elements or say "tidy everything".' }
    const res = await callTool('arrange_grid', { ids })
    return { ok: !res.isError, reply: res.isError ? textOf(res) : `Arranged ${ids.length} element(s) into a grid.`, detail: textOf(res) }
  }
  if (tool === '__align_scope') {
    const ids = scopeIds(args.scope)
    if (ids.length < 2) return { ok: false, reply: 'Select at least two elements to align.' }
    const res = await callTool('align_elements', { ids, edge: args.edge })
    return { ok: !res.isError, reply: res.isError ? textOf(res) : `Aligned ${ids.length} element(s).`, detail: textOf(res) }
  }

  // --- normal tool call ---
  const res = await callTool(tool, args)
  return { ok: !res.isError, reply: textOf(res), detail: textOf(res) }
}

/** Flatten an MCP tool result to plain text. */
function textOf(res: { content?: Array<{ type: string; text?: string }> }): string {
  if (!res.content) return ''
  return res.content
    .filter((c) => c.type === 'text' && c.text)
    .map((c) => c.text as string)
    .join('\n')
}

/**
 * Take a human sentence and act on the board. When the user has configured a
 * model (see llm.ts) we route through the LLM agent loop, which can plan
 * genuine multi-step tool use; on any AI/transport error we degrade gracefully
 * to the deterministic rule-based interpreter below, so the app never
 * hard-fails and works out of the box with no key.
 */
export async function runCommand(input: string, signal?: AbortSignal): Promise<RunResult> {
  if (canUseAi()) {
    try {
      return await runWithAi(input, signal)
    } catch (e) {
      // AI unreachable/misconfigured — fall back but keep the reason in detail.
      const fallback = await runRuleBased(input)
      return { ...fallback, detail: fallback.detail ?? (e as Error).message }
    }
  }
  return runRuleBased(input)
}

/**
 * Deterministic path: interpret the sentence, run the resulting tool calls in
 * order, and return a single reply the console can show. If the interpreter
 * produced a canned reply (e.g. "Generating a kanban…") we prefer that;
 * otherwise we surface the last tool's text output (useful for summarize/suggest).
 */
async function runRuleBased(input: string): Promise<RunResult> {
  const plan = interpret(input)
  if (plan.calls.length === 0) return { ok: true, reply: plan.reply }

  let last: RunResult = { ok: true, reply: '' }
  for (const call of plan.calls) {
    last = await runPlanned(call)
    if (!last.ok) return last
  }

  const reply = plan.reply || last.reply
  return { ok: last.ok, reply, detail: last.detail }
}
