import { callTool, getToolDefs } from '../mcp/registry'
import { AGENT_NAME } from '../constants'
import { chatCompletion, isLlmConfigured, type ChatMessage, type OpenAiTool } from './llm'
import type { RunResult } from './runner'

/**
 * LLM-backed agent loop for Aria. Exposes the 33 WebMCP tools to an
 * OpenAI-compatible model, executes whatever tool calls it requests against our
 * registry, feeds the results back, and repeats until the model returns a plain
 * text answer (or we hit the step cap). Purely additive: if no model is
 * configured, callers fall back to the deterministic rule-based interpreter.
 */

const MAX_STEPS = 6

const SYSTEM_PROMPT = `You are ${AGENT_NAME}, an AI collaborator embedded in CollabCanvas — a shared infinite canvas that a human and you edit together in real time.

You act by calling the provided tools; each maps to a real operation on the live board (create/edit/arrange/style/group shapes, generate whole layouts, query the board, export it, move the camera). Prefer tools over describing what to do — actually do it.

Guidelines:
- To build structured diagrams (kanban, flowchart, mind map, org chart, timeline, grid, wireframe, form) prefer the single generate_layout tool over placing many shapes by hand.
- Before restyling, moving, aligning, or deleting "the selection", call get_selection; for "everything" use get_board_state to get ids. Never invent element ids.
- Keep going until the user's request is fully done, then reply with ONE short, friendly sentence describing what you changed. Do not narrate every step.
- If the request is a question about the board, use get_board_state / summarize_board and answer concisely.
- If a request is ambiguous or impossible with the tools, say so briefly instead of guessing wildly.`

/** Convert our registry's tool defs into OpenAI function-calling shape. */
function toolsForModel(): OpenAiTool[] {
  return getToolDefs().map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.inputSchema },
  }))
}

/** Flatten an MCP tool result to plain text. */
function textOf(res: { content?: Array<{ type: string; text?: string }>; isError?: boolean }): string {
  const t = (res.content ?? [])
    .filter((c) => c.type === 'text' && c.text)
    .map((c) => c.text as string)
    .join('\n')
  return t || (res.isError ? 'Error.' : 'Done.')
}

/** True when we should try the LLM path at all. */
export function canUseAi(): boolean {
  return isLlmConfigured()
}

/**
 * Run one user turn through the model. Returns a RunResult the console renders.
 * Throws only on setup errors; transport/model errors are surfaced as a failed
 * RunResult so the caller can decide whether to fall back.
 */
export async function runWithAi(input: string, signal?: AbortSignal): Promise<RunResult> {
  const tools = toolsForModel()
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: input },
  ]

  let toolsRun = 0

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await chatCompletion(messages, tools, { signal })
    const choice = res.choices?.[0]
    if (!choice) return { ok: false, reply: 'The AI returned an empty response.' }

    const msg = choice.message
    const calls = msg.tool_calls ?? []

    // No tool calls → the model is done and this is its final answer.
    if (calls.length === 0) {
      const reply = (msg.content ?? '').trim()
      return { ok: true, reply: reply || (toolsRun ? 'Done.' : "I'm not sure how to do that on the board.") }
    }

    // Record the assistant turn (with its tool_calls) before answering them.
    messages.push({ role: 'assistant', content: msg.content ?? null, tool_calls: calls })

    // Execute each requested tool call and feed the result back.
    for (const call of calls) {
      let args: Record<string, unknown> = {}
      try {
        args = call.function.arguments ? JSON.parse(call.function.arguments) : {}
      } catch {
        messages.push({ role: 'tool', tool_call_id: call.id, name: call.function.name, content: 'Error: arguments were not valid JSON.' })
        continue
      }
      const result = await callTool(call.function.name, args)
      toolsRun++
      messages.push({ role: 'tool', tool_call_id: call.id, name: call.function.name, content: textOf(result) })
    }
  }

  // Hit the step cap — ask the model for a closing summary with no more tools.
  try {
    const res = await chatCompletion(
      [...messages, { role: 'user', content: 'Summarize what you changed in one short sentence.' }],
      undefined,
      { signal },
    )
    const reply = (res.choices?.[0]?.message.content ?? '').trim()
    return { ok: true, reply: reply || `Done (${toolsRun} operations).` }
  } catch {
    return { ok: true, reply: `Done (${toolsRun} operations).` }
  }
}
