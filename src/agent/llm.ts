/**
 * OpenAI-compatible chat client for the built-in Aria agent.
 *
 * CollabCanvas ships with no backend, so the model endpoint and key are supplied
 * by the *user* at runtime (stored in localStorage) — never hardcoded, so nothing
 * secret rides along in the deployed bundle. For local development you may also
 * set VITE_LLM_* env vars in a gitignored .env; those are a convenience default
 * only and are inlined at build time (do NOT set them for a public deploy).
 *
 * The endpoint is expected to be OpenAI-compatible (POST {baseUrl}/chat/completions
 * with { model, messages, tools, tool_choice }). seekai/DeepSeek, OpenAI, Groq,
 * together, etc. all match this shape.
 */

const LS_KEY = 'collabcanvas:llm'

export interface LlmConfig {
  baseUrl: string
  apiKey: string
  model: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  /** assistant messages may request tool calls */
  tool_calls?: ToolCall[]
  /** tool messages answer a specific call */
  tool_call_id?: string
  name?: string
}

export interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

/** A tool definition in OpenAI function-calling shape. */
export interface OpenAiTool {
  type: 'function'
  function: { name: string; description: string; parameters: unknown }
}

export interface ChatChoice {
  message: ChatMessage
  finish_reason: string
}

export interface ChatResponse {
  choices: ChatChoice[]
}

const ENV = (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env

/** Env-provided defaults for local dev only (inlined at build; empty in prod unless set). */
const ENV_DEFAULTS: Partial<LlmConfig> = {
  baseUrl: ENV.VITE_LLM_BASE_URL,
  apiKey: ENV.VITE_LLM_API_KEY,
  model: ENV.VITE_LLM_MODEL,
}

const FALLBACK_BASE_URL = 'https://api.openai.com/v1'
const FALLBACK_MODEL = 'gpt-4o-mini'

/** Read the effective config: user settings (localStorage) override env defaults. */
export function getLlmConfig(): LlmConfig {
  let saved: Partial<LlmConfig> = {}
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) saved = JSON.parse(raw) as Partial<LlmConfig>
  } catch {
    /* ignore malformed/absent storage */
  }
  return {
    baseUrl: (saved.baseUrl || ENV_DEFAULTS.baseUrl || FALLBACK_BASE_URL).replace(/\/+$/, ''),
    apiKey: saved.apiKey || ENV_DEFAULTS.apiKey || '',
    model: saved.model || ENV_DEFAULTS.model || FALLBACK_MODEL,
  }
}

/** Persist user-entered config. Pass an empty apiKey to clear it. */
export function setLlmConfig(patch: Partial<LlmConfig>): void {
  const next = { ...getLlmConfig(), ...patch }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next))
  } catch {
    /* private mode — settings won't persist, that's acceptable */
  }
}

/** True when we have enough config to actually call a model. */
export function isLlmConfigured(): boolean {
  return getLlmConfig().apiKey.trim().length > 0
}

/**
 * One round-trip to the chat completions endpoint. Throws on transport/HTTP
 * errors with a readable message (the caller decides whether to fall back).
 */
export async function chatCompletion(
  messages: ChatMessage[],
  tools?: OpenAiTool[],
  opts: { temperature?: number; signal?: AbortSignal } = {},
): Promise<ChatResponse> {
  const cfg = getLlmConfig()
  if (!cfg.apiKey) throw new Error('No API key configured for the AI agent.')

  const body: Record<string, unknown> = {
    model: cfg.model,
    messages,
    temperature: opts.temperature ?? 0.4,
  }
  if (tools && tools.length) {
    body.tools = tools
    body.tool_choice = 'auto'
  }

  let res: Response
  try {
    res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    })
  } catch (e) {
    throw new Error(`Could not reach the AI endpoint (${cfg.baseUrl}): ${(e as Error).message}`)
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`AI endpoint returned ${res.status}${text ? `: ${text.slice(0, 300)}` : ''}`)
  }

  return (await res.json()) as ChatResponse
}
