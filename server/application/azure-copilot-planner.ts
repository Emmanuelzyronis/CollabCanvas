import type { CopilotContext, CopilotPlan, CopilotPlanner } from '../domain/copilot-types.js'
import { NODE_TYPES, type JsonObject, type LayoutConstraints, type NodeSemantic, type NodeType } from '../domain/contracts.js'
import type { DesignChangeOperation, ProposedNode, ProposedNodeUpdate } from '../domain/version-types.js'
import { DeterministicCopilotPlanner } from './copilot-planner.js'

export type AzureOpenAiTransport = 'azure-deployment' | 'openai-v1'

/**
 * Reasoning deployments routinely take 10-30s to produce a small composition,
 * so the ceiling has to clear that comfortably while still failing fast enough
 * for a person to retry. The hosting platform's own function limit applies on
 * top of this.
 */
const REQUEST_TIMEOUT_MS = 45_000

export interface AzureOpenAiCopilotConfig {
  readonly endpoint: string
  readonly apiKey: string
  readonly deployment: string
  readonly apiVersion: string
  readonly transport: AzureOpenAiTransport
}

/**
 * Azure exposes two chat-completions surfaces. Classic resources use
 * `https://<resource>.openai.azure.com/openai/deployments/<deployment>` with an
 * `api-key` header and an `api-version` query. Azure AI Foundry resources expose
 * an OpenAI-compatible `.../openai/v1` surface that instead takes `model` in the
 * body and a bearer token, with no api-version.
 */
function transportFor(endpoint: string): AzureOpenAiTransport {
  try {
    return new URL(endpoint).pathname.replace(/\/+$/, '').endsWith('/openai/v1') ? 'openai-v1' : 'azure-deployment'
  } catch {
    return 'azure-deployment'
  }
}

/**
 * Azure OpenAI configuration for the server-side assistant.
 *
 * The key deliberately lives only in the server environment. It is never
 * exposed through a VITE_* variable, the manifest, or client state.
 */
export function azureOpenAiCopilotConfig(env: NodeJS.ProcessEnv = process.env): AzureOpenAiCopilotConfig | null {
  const endpoint = (env.AZURE_OPENAI_ENDPOINT ?? '').trim().replace(/\/+$/, '')
  const apiKey = (env.AZURE_OPENAI_API_KEY ?? '').trim()
  const deployment = (env.AZURE_OPENAI_DEPLOYMENT ?? env.AZURE_OPENAI_MODEL ?? '').trim()
  if (!endpoint || !apiKey || !deployment) return null
  return { endpoint, apiKey, deployment, apiVersion: (env.AZURE_OPENAI_API_VERSION ?? '2024-10-21').trim(), transport: transportFor(endpoint) }
}

export interface AssistantDescriptor {
  readonly provider: 'azure-openai' | 'builtin'
  readonly connected: boolean
  readonly supports: readonly string[]
}

/**
 * Product-level description of the active assistant. Deliberately carries no
 * endpoint, deployment name, or key material.
 */
export function assistantDescriptor(env: NodeJS.ProcessEnv = process.env): AssistantDescriptor {
  return { provider: azureOpenAiCopilotConfig(env) ? 'azure-openai' : 'builtin', connected: true, supports: ['create', 'rearrange', 'remove', 'refine'] }
}

/** Only the operations the proposal contract can execute today. */
const EXECUTABLE = new Set(['moveNode', 'deleteNode', 'createNode', 'updateNode'])

const CREATABLE = new Set<string>(NODE_TYPES)

/** A runaway plan is a malformed plan; no legitimate request needs more. */
const MAX_OPERATIONS = 24

const SYSTEM_PROMPT = `You translate a designer's plain-language request into structured design operations.
Reply with strict JSON only: {"operations": [...], "rationale": "..."}.

Allowed operations:
- {"type":"moveNode","nodeId":"<id>","parentId":"<id>|null","orderIndex":<non-negative integer>}
- {"type":"deleteNode","nodeId":"<id>"}
- {"type":"createNode","key":"<new-key>","parentKey":"<key defined earlier in this reply>","node":{"type":"${NODE_TYPES.join('|')}","name":"<designer-facing layer name>","layout":{"display":"block|flex|grid|stack","direction":"row|column","gap":<number>,"padding":{"top":<number>,"right":<number>,"bottom":<number>,"left":<number>},"align":"start|center|end|stretch","justify":"start|center|end|space-between|space-around|space-evenly","position":"absolute|flow","x":<number>,"y":<number>,"width":<number|"auto"|"fill">,"height":<number|"auto"|"fill">},"properties":{"text":"<copy>","fontSize":<number>,"fontWeight":<number>,"textAlign":"left|center|right","style":{"textColor":"<hex>","fill":"<hex>","stroke":"<hex>","strokeWidth":<number>,"borderRadius":<number>,"opacity":<number>,"lineHeight":<number>}},"semantic":{"role":"banner|button|cell|complementary|form|heading|img|list|main|region|table|textbox"}}}
- {"type":"updateNode","nodeId":"<id>","patch":{"layout":{"gap":<number>,"padding":{"top":<number>,"right":<number>,"bottom":<number>,"left":<number>}},"properties":{"text":"<copy>","style":{"fill":"<hex>","textColor":"<hex>"}},"name":"<designer-facing layer name>"}}

Rules:
- Use only nodeId values from the layer list you are given. Never invent ids. A createNode does not need an id.
- Use only the four operation types above. There are no others.
- To change something that already exists — spacing, padding, colour, alignment, or copy — use updateNode. Send only the fields you are changing; the application merges them into the layer.
- A new section belongs to the top level of the page: it needs no parent. Omit parentId and parentKey for the outermost node.
- "key" is local to your reply: never reuse a key, and a "parentKey" must name a key you already created earlier in the same list.
- Create a section, frame or card first when the request implies a group, then create its contents with "parentKey" pointing at it.
- A top-level section is placed on the page with "position":"absolute" and x/y. Its contents take part in its stack: give the section a "display" ("stack" for a column, "flex" for a row) with direction, gap, padding and align, and give each child "position":"flow". A "flow" child must omit x and y entirely — including 0 — because the layout engine positions it. Use "fill" width for text that should span the section.
- "lineHeight" is a multiplier ("1.2", "1.5"), never a pixel value. Width and height accept a number, "auto" (hug content) or "fill" (share the parent).
- If the layer list is empty, this is a new page: start at y=0. Never ask for a parent, a page or a nodeId in order to create something new.
- Place new content below what already exists: below the largest y+height in the layer list, or 0 when the list is empty. Never overlap existing layers.
- Choose sensible values yourself. Never ask the designer for hex colours, pixel sizes, fonts or copy: use standard sizes and short, plausible placeholder copy.
- Keep a plan to roughly 4-12 nodes. Prefer a small, complete composition over an exhaustive page.
- Reply with an empty operations list only when the request truly cannot be expressed: duplicating a layer, or a request you cannot understand. Never use it as a request for more information when a sensible default exists.
- "Make it more spacious" or "make it tighter" means updateNode on that section with a larger or smaller layout.gap and layout.padding. "Make it blue/red/green" means updateNode with a new layout/properties colour.
- Never describe internal architecture. Speak to the designer in design language.`

/** An empty layer list is meaningful context, not missing context. */
function layerListOrEmpty(context: CopilotContext): string {
  const listed = layerList(context)
  return listed.length > 0 ? listed : '(no layers yet — this page is empty, so start at y=0)'
}

function layerList(context: CopilotContext): string {
  return context.nodes
    .map((node) => `- ${node.name} (id: ${node.id}, parent: ${node.parentId ?? 'root'})`)
    .join('\n')
}

function resolveSelected(context: CopilotContext): string {
  if (context.selectedNodeIds.length === 0) return 'none'
  const names = context.selectedNodeIds.map((id) => context.nodes.find((node) => node.id === id)?.name ?? id)
  return names.join(', ')
}

function optionalObject(value: unknown): JsonObject | null {
  if (value === undefined) return {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as JsonObject
}

/**
 * A createNode entry is only accepted when it is fully specified: an unknown
 * node type, a missing name, a malformed layout block or a parent key the model
 * has not defined itself all invalidate the whole plan rather than producing a
 * half-built section.
 */
function parseCreatedNode(operation: Record<string, unknown>, createdKeys: Set<string>, knownIds: Set<string>): ProposedNode | null {
  const key = operation.key
  if (typeof key !== 'string' || key.trim().length === 0 || createdKeys.has(key)) return null
  const parentKey = operation.parentKey === undefined || operation.parentKey === null ? null : operation.parentKey
  if (parentKey !== null && (typeof parentKey !== 'string' || !createdKeys.has(parentKey))) return null
  const parentId = operation.parentId === undefined || operation.parentId === null ? null : operation.parentId
  if (parentId !== null && (typeof parentId !== 'string' || !knownIds.has(parentId))) return null
  const orderIndex = operation.orderIndex
  if (orderIndex !== undefined && (!Number.isInteger(orderIndex) || (orderIndex as number) < 0)) return null
  const raw = operation.node
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const spec = raw as Record<string, unknown>
  const type = spec.type
  if (typeof type !== 'string' || !CREATABLE.has(type)) return null
  const name = spec.name
  if (typeof name !== 'string' || name.trim().length === 0) return null
  const layout = optionalObject(spec.layout)
  const properties = optionalObject(spec.properties)
  const semantic = optionalObject(spec.semantic)
  if (layout === null || properties === null || semantic === null) return null
  createdKeys.add(key)
  return {
    key,
    ...(parentKey === null ? {} : { parentKey }),
    ...(parentId === null ? {} : { parentId }),
    ...(orderIndex === undefined ? {} : { orderIndex: orderIndex as number }),
    node: { type: type as NodeType, name: name.trim(), layout: layout as LayoutConstraints, properties, semantic: semantic as NodeSemantic },
  }
}

/**
 * A refinement patch is only accepted when every field it carries is
 * well-formed. Malformed refinements invalidate the plan rather than producing
 * a half-applied change.
 */
function parseNodeUpdate(raw: unknown): ProposedNodeUpdate | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const patch = raw as Record<string, unknown>
  const next: ProposedNodeUpdate = {}
  if (patch.name !== undefined) {
    if (typeof patch.name !== 'string' || patch.name.trim().length === 0) return null
    next.name = patch.name.trim()
  }
  if (patch.layout !== undefined) {
    const layout = optionalObject(patch.layout)
    if (layout === null) return null
    next.layout = layout as LayoutConstraints
  }
  if (patch.properties !== undefined) {
    const properties = optionalObject(patch.properties)
    if (properties === null) return null
    next.properties = properties
  }
  if (patch.semantic !== undefined) {
    const semantic = optionalObject(patch.semantic)
    if (semantic === null) return null
    next.semantic = semantic as NodeSemantic
  }
  return Object.keys(next).length > 0 ? next : null
}

/** Validate a model response into typed operations, dropping anything unsafe. */
export function parseCopilotPlan(raw: unknown, context: CopilotContext): CopilotPlan | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const candidate = raw as { operations?: unknown; rationale?: unknown }
  if (!Array.isArray(candidate.operations)) return null
  const rationale = typeof candidate.rationale === 'string' ? candidate.rationale.trim() : ''
  const known = new Set(context.nodes.map((node) => node.id))
  const createdKeys = new Set<string>()
  const operations: DesignChangeOperation[] = []
  for (const entry of candidate.operations) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null
    if (operations.length >= MAX_OPERATIONS) return null
    const operation = entry as Record<string, unknown>
    const type = operation.type
    if (typeof type !== 'string' || !EXECUTABLE.has(type)) return null
    if (type === 'createNode') {
      const created = parseCreatedNode(operation, createdKeys, known)
      if (!created) return null
      operations.push({ type: 'createNode', ...created })
      continue
    }
    const nodeId = operation.nodeId
    if (typeof nodeId !== 'string' || !known.has(nodeId)) return null
    if (type === 'deleteNode') {
      operations.push({ type: 'deleteNode', nodeId })
      continue
    }
    if (type === 'updateNode') {
      const patch = parseNodeUpdate(operation.patch)
      if (!patch) return null
      operations.push({ type: 'updateNode', nodeId, patch })
      continue
    }
    const parentId = operation.parentId === undefined ? null : operation.parentId
    if (parentId !== null && (typeof parentId !== 'string' || !known.has(parentId))) return null
    if (parentId === nodeId) return null
    const orderIndex = operation.orderIndex
    if (orderIndex !== undefined && (!Number.isInteger(orderIndex) || (orderIndex as number) < 0)) return null
    operations.push({ type: 'moveNode', nodeId, parentId, ...(orderIndex === undefined ? {} : { orderIndex: orderIndex as number }) })
  }
  return { operations, rationale }
}

/**
 * Azure OpenAI-backed planner for the design assistant.
 *
 * Grounding stays server-side: the context is the trusted approved version, and
 * every returned operation is re-validated against that same graph before it
 * can become a proposal. Unreachable or malformed model output degrades to a
 * clarification rather than an executable change.
 */
export class AzureOpenAiCopilotPlanner implements CopilotPlanner {
  readonly provider = 'azure-openai' as const

  constructor(
    private readonly config: AzureOpenAiCopilotConfig,
    private readonly request: typeof fetch = fetch,
  ) {}

  private requestInit(messages: Array<{ role: string; content: string }>): { url: string; init: RequestInit } {
    if (this.config.transport === 'openai-v1') {
      return {
        url: `${this.config.endpoint}/chat/completions`,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${this.config.apiKey}` },
          body: JSON.stringify({ model: this.config.deployment, max_completion_tokens: 4000, response_format: { type: 'json_object' }, messages }),
        },
      }
    }
    return {
      url: `${this.config.endpoint}/openai/deployments/${encodeURIComponent(this.config.deployment)}/chat/completions?api-version=${encodeURIComponent(this.config.apiVersion)}`,
      init: {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'api-key': this.config.apiKey },
        body: JSON.stringify({ temperature: 0, max_tokens: 4000, response_format: { type: 'json_object' }, messages }),
      },
    }
  }

  async plan(context: CopilotContext, instruction: string): Promise<CopilotPlan> {
    const user = [
      `Design: ${context.document.name} — page "${context.page.name}".`,
      `Layers:\n${layerListOrEmpty(context)}`,
      `Currently selected: ${resolveSelected(context)}`,
      `Request: ${instruction.trim()}`,
    ].join('\n\n')
    const { url, init } = this.requestInit([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: user },
    ])

    let response: Response
    try {
      response = await this.request(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
    } catch {
      return { operations: [], rationale: 'The assistant could not be reached. Check the connection and try again.' }
    }
    if (!response.ok) {
      return { operations: [], rationale: `The assistant is unavailable right now (status ${response.status}). Try again in a moment.` }
    }

    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      return { operations: [], rationale: 'The assistant returned an unreadable response. Try rephrasing the request.' }
    }
    const content = (payload as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content
    if (typeof content !== 'string') {
      return { operations: [], rationale: 'The assistant returned no plan. Try rephrasing the request.' }
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      return { operations: [], rationale: 'The assistant returned a plan that could not be read. Try rephrasing the request.' }
    }
    const plan = parseCopilotPlan(parsed, context)
    if (!plan) {
      return { operations: [], rationale: 'The assistant proposed a change that is not available yet. Try describing the change in terms of moving or removing a layer.' }
    }
    return plan
  }
}

/**
 * Use Azure OpenAI when configured; otherwise fall back to the deterministic
 * planner so the assistant still behaves predictably without credentials.
 */
/**
 * A model is better at open-ended composition, but it can also abstain on a
 * request the product already knows how to satisfy. When the model returns no
 * operations, the deterministic planner gets one chance to serve the request —
 * so a model hiccup never becomes a dead end in the human's workflow. The
 * fallback never overrides a model decision that produced real operations.
 */
export class ResilientCopilotPlanner implements CopilotPlanner {
  constructor(private readonly primary: CopilotPlanner, private readonly fallback: CopilotPlanner) {}

  get provider(): 'azure-openai' | 'builtin' {
    return this.primary.provider ?? 'builtin'
  }

  async plan(context: CopilotContext, instruction: string): Promise<CopilotPlan> {
    const primary = await this.primary.plan(context, instruction)
    if (primary.operations.length > 0) return primary
    const fallback = await this.fallback.plan(context, instruction)
    return fallback.operations.length > 0 ? fallback : primary
  }
}

export function createCopilotPlanner(env: NodeJS.ProcessEnv = process.env): CopilotPlanner {
  const config = azureOpenAiCopilotConfig(env)
  return config
    ? new ResilientCopilotPlanner(new AzureOpenAiCopilotPlanner(config), new DeterministicCopilotPlanner())
    : new DeterministicCopilotPlanner()
}
