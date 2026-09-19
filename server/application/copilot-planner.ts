import type { CopilotContext, CopilotPlan, CopilotPlanner } from '../domain/copilot-types.js'
import type { LayoutConstraints } from '../domain/contracts.js'
import { recipeForInstruction, recipeOperations } from '../domain/design-recipes.js'
import type { ProposedNodeUpdate } from '../domain/version-types.js'

const WHAT_I_CAN_DO = 'Right now I can add a section, change its spacing or colour, rearrange a layer, or remove one.'

/**
 * Instructions that change something that already exists. A recipe keyword must
 * never turn "make the hero more spacious" into a second hero.
 */
const EDIT_INTENT = /\b(spacious|spacing|space|bigger|smaller|larger|tighter|looser|more|less|move|remove|delete|rename|reword|restyle|recolor|recolour|color|colour|align|resize|shrink|grow|hide|show)\b/i

const SPACING_INTENT = /\b(spacious|spacing|space|breathing room|tighter|tighten|looser|loosen|closer|compact|roomier|roomy|spread)\b/i
/** Direction, not topic: "spacing" itself is neutral and must not imply looser. */
const TIGHTEN = /\b(tighter|tighten|closer|compact|snug|less space|reduce)\b/i
const LOOSEN = /\b(spacious|more space|looser|loosen|breathing room|spread|roomier|roomy)\b/i

/** Where new content starts when the page already has something on it. */
function nextFreeVerticalOffset(context: CopilotContext): number {
  let bottom = 0
  for (const node of context.nodes) {
    if (node.parentId !== null) continue
    const y = typeof node.layout.y === 'number' ? node.layout.y : 0
    const height = typeof node.layout.height === 'number' ? node.layout.height : 0
    bottom = Math.max(bottom, y + height)
  }
  return bottom
}

function matches(node: { id: string; name: string }, query: string) {
  const needle = query.trim().toLowerCase().replace(/^(?:the|a|an)\s+/, '').replace(/[.!?]+$/, '')
  return node.id.toLowerCase() === needle || node.name.trim().toLowerCase() === needle
}

function resolveOne(context: CopilotContext, query: string): { id?: string; error?: string } {
  const candidates = context.nodes.filter((node) => matches(node, query))
  if (candidates.length === 1) return { id: candidates[0].id }
  if (candidates.length > 1) return { error: `Several layers match "${query}". Select just one, then ask again.` }
  return { error: `I couldn't find a layer named "${query}" in this design.` }
}

/** The layer an instruction is talking about: the selection, or a named layer. */
function targetNode(context: CopilotContext, instruction: string): CopilotContext['nodes'][number] | undefined {
  if (context.selectedNodeIds.length === 1) {
    const selected = context.nodes.find((node) => node.id === context.selectedNodeIds[0])
    if (selected) return selected
  }
  const lower = instruction.toLowerCase()
  let best: CopilotContext['nodes'][number] | undefined
  for (const node of context.nodes) {
    const name = node.name.trim().toLowerCase()
    if (name.length < 3 || !lower.includes(name)) continue
    if (!best || name.length > best.name.trim().length) best = node
  }
  return best
}

function paddingOf(layout: LayoutConstraints): { top: number; right: number; bottom: number; left: number } {
  const value = (side: 'top' | 'right' | 'bottom' | 'left') => {
    const raw = layout.padding?.[side]
    const parsed = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number.parseFloat(raw) : 0
    return Number.isFinite(parsed) ? parsed : 0
  }
  return { top: value('top'), right: value('right'), bottom: value('bottom'), left: value('left') }
}

function numberValue(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

/** "more spacious" / "tighter" → a real gap and padding change on the container. */
function spacingRefinement(context: CopilotContext, instruction: string): CopilotPlan | null {
  if (!SPACING_INTENT.test(instruction)) return null
  const node = targetNode(context, instruction)
  if (!node) return { operations: [], rationale: 'Select the section you want to change, or name it — for example "make the hero more spacious".' }
  if (node.layout.display !== 'flex' && node.layout.display !== 'stack' && node.layout.display !== 'grid') {
    return { operations: [], rationale: `"${node.name}" isn't a section, so it has no internal spacing to change.` }
  }
  const looser = !TIGHTEN.test(instruction) || LOOSEN.test(instruction)
  const direction = looser ? 1 : -1
  const gap = Math.max(numberValue(node.layout.gap, 0) + direction * 12, 0)
  const padding = paddingOf(node.layout)
  const shift = direction * 16
  const nextPadding = {
    top: Math.max(padding.top + shift, 0),
    right: Math.max(padding.right + shift, 0),
    bottom: Math.max(padding.bottom + shift, 0),
    left: Math.max(padding.left + shift, 0),
  }
  const patch: ProposedNodeUpdate = { layout: { ...node.layout, gap, padding: nextPadding } }
  return {
    operations: [{ type: 'updateNode', nodeId: node.id, patch }],
    rationale: `${looser ? 'Open up' : 'Tighten'} the spacing inside "${node.name}" — more room between layers and around the edges.`,
  }
}

const COLOR_WORDS: Readonly<Record<string, string>> = {
  blue: '#2563eb',
  indigo: '#4f46e5',
  violet: '#7c3aed',
  purple: '#7c3aed',
  pink: '#db2777',
  red: '#dc2626',
  orange: '#ea580c',
  amber: '#d97706',
  yellow: '#eab308',
  green: '#16a34a',
  teal: '#0d9488',
  cyan: '#0891b2',
  slate: '#0f172a',
  grey: '#475569',
  gray: '#475569',
  black: '#0f172a',
  white: '#ffffff',
}

/** "make it blue" / "change the colour to green" → a real style change. */
function colorRefinement(context: CopilotContext, instruction: string): CopilotPlan | null {
  if (!/\b(colour|color|recolor|recolour|restyle|paint)\b/i.test(instruction) && !/\bmake it\b/i.test(instruction)) return null
  const lower = instruction.toLowerCase()
  let hex: string | undefined
  for (const [word, value] of Object.entries(COLOR_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(lower)) {
      hex = value
      break
    }
  }
  if (!hex) return null
  const node = targetNode(context, instruction)
  if (!node) return { operations: [], rationale: 'Select the layer you want to recolour, or name it — for example "make the hero blue".' }
  const style = node.properties.style && typeof node.properties.style === 'object' && !Array.isArray(node.properties.style) ? { ...(node.properties.style as Record<string, unknown>) } : {}
  const isText = node.type === 'text' || node.type === 'heading'
  const isButton = node.type === 'button'
  const nextStyle = isText
    ? { ...style, textColor: hex }
    : { ...style, fill: hex, ...(isButton ? { stroke: hex, textColor: '#ffffff' } : {}) }
  const patch: ProposedNodeUpdate = { properties: { ...node.properties, style: nextStyle } }
  return {
    operations: [{ type: 'updateNode', nodeId: node.id, patch }],
    rationale: `Recolour "${node.name}" to match the palette you asked for.`,
  }
}

export class DeterministicCopilotPlanner implements CopilotPlanner {
  readonly provider = 'builtin' as const

  async plan(context: CopilotContext, instruction: string): Promise<CopilotPlan> {
    const text = instruction.trim()
    const lower = text.toLowerCase()
    const selected = context.selectedNodeIds
    if (/\b(rename|change|set|update).+\b(name|title|text|label)\b/i.test(text)) return { operations: [], rationale: `I can't rewrite text yet. ${WHAT_I_CAN_DO}` }
    // Only treat duplicate/copy/clone as the leading verb; a layer may legitimately be named "... copy".
    if (/^\s*(?:please\s+)?(?:duplicate|copy|clone)\b/i.test(text)) return { operations: [], rationale: `I can't duplicate layers yet. ${WHAT_I_CAN_DO}` }

    // Composing a new part of the interface. Checked before move/delete so that
    // "add a hero section" is not mistaken for "move something into a section".
    const recipe = EDIT_INTENT.test(lower) ? undefined : recipeForInstruction(lower)
    if (recipe) {
      const operations = recipeOperations(recipe, nextFreeVerticalOffset(context))
      return { operations, rationale: `Add a ${recipe.label} below the existing content, as ${operations.length} new layers you can edit.` }
    }

    // Refinements of something that already exists: spacing and colour are the
    // two instructions the product promises, and they change real layout/style.
    const spacing = spacingRefinement(context, text)
    if (spacing) return spacing
    const recolour = colorRefinement(context, text)
    if (recolour) return recolour

    if (/\b(delete|remove)\b/i.test(lower)) {
      const target = selected.length === 1 ? { id: selected[0] } : resolveOne(context, text.replace(/^.*?\b(delete|remove)\b\s+/i, '').replace(/\s+(layer|node)\s*$/i, ''))
      if (!target.id) return { operations: [], rationale: target.error ?? 'Select exactly one layer to remove.' }
      const targetName = context.nodes.find((node) => node.id === target.id)?.name ?? 'the selected layer'
      return { operations: [{ type: 'deleteNode', nodeId: target.id }], rationale: `Remove "${targetName}" from the design.` }
    }

    if (/\b(move|reparent|make)\b/i.test(lower) && /\b(child|below|under|inside|into|section|parent)\b/i.test(lower)) {
      const source = selected.length === 1 ? { id: selected[0] } : resolveOne(context, text.match(/(?:move|reparent|make)\s+(.+?)\s+(?:below|under|inside|into|a child of|children of)/i)?.[1] ?? '')
      const parentQuery = text.match(/\b(?:below|under|inside|into|child(?:ren)? of)\s+(.+?)(?:\.|$)/i)?.[1]?.trim().replace(/\s+(section|frame|layer|node)$/i, '')
      if (!source.id) return { operations: [], rationale: source.error ?? 'Select one source layer or name it explicitly.' }
      if (!parentQuery) return { operations: [], rationale: 'Tell me which layer should contain it, for example "move Hero into Page".' }
      const parent = resolveOne(context, parentQuery)
      if (!parent.id) return { operations: [], rationale: parent.error! }
      if (parent.id === source.id) return { operations: [], rationale: 'A layer cannot be its own parent.' }
      const parentNode = context.nodes.find((node) => node.id === parent.id)
      const orderIndex = context.nodes.filter((node) => node.parentId === parent.id).length
      const sourceName = context.nodes.find((node) => node.id === source.id)?.name ?? 'the selected layer'
      return { operations: [{ type: 'moveNode', nodeId: source.id, parentId: parent.id, orderIndex }], rationale: `Move "${sourceName}" inside "${parentNode?.name ?? 'that layer'}".` }
    }

    return { operations: [], rationale: `I can't do that one yet. ${WHAT_I_CAN_DO} Try asking me to add a hero or navigation section, make a section more spacious, or remove a layer.` }
  }
}
