import { LAYOUT_KINDS, type LayoutKind } from '../mcp/layouts'

/**
 * A tiny rule-based natural-language interpreter. It turns a human sentence into
 * an ordered list of tool calls the Agent Console executes through the WebMCP
 * registry. This is intentionally deterministic and offline — a real LLM can be
 * dropped in behind the same `interpret()` signature (see agent/llm.ts slot).
 */

export interface PlannedCall {
  tool: string
  args: Record<string, unknown>
}

export interface Interpretation {
  calls: PlannedCall[]
  reply: string
}

const COLOR_WORDS = ['red', 'orange', 'amber', 'yellow', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'pink', 'rose', 'gray', 'grey', 'black', 'white', 'slate']

/** Pull a comma/and-separated list after a keyword like "with" or "columns". */
function extractList(text: string): string[] {
  const m = text.match(/(?:with|:|called|labeled|items?|steps?|cards?|columns?|fields?|branches?)\s+(.+)$/i)
  const src = m ? m[1] : ''
  if (!src) return []
  return src
    .split(/,|;|\band\b|\bthen\b/i)
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter((s) => s.length > 0 && s.length < 60)
    .slice(0, 12)
}

function findColor(text: string): string | null {
  for (const c of COLOR_WORDS) if (new RegExp(`\\b${c}\\b`, 'i').test(text)) return c
  const hex = text.match(/#[0-9a-f]{3,8}\b/i)
  return hex ? hex[0] : null
}

function findLayoutKind(text: string): LayoutKind | null {
  const t = text.toLowerCase()
  if (/\bkanban\b|\bboard\b/.test(t)) return 'kanban'
  if (/\bflow ?chart\b|\bflow\b|\bprocess\b/.test(t)) return 'flowchart'
  if (/\bmind ?map\b/.test(t)) return 'mindmap'
  if (/\borg ?chart\b|\borganization\b|\bhierarchy\b/.test(t)) return 'orgchart'
  if (/\bwire ?frame\b|\bmockup\b|\bscreen\b/.test(t)) return 'wireframe'
  if (/\bform\b|\bsignup\b|\bsign up\b/.test(t)) return 'form'
  for (const k of LAYOUT_KINDS) if (t.includes(k)) return k
  return null
}

export function interpret(input: string): Interpretation {
  const text = input.trim()
  const t = text.toLowerCase()
  if (!text) return { calls: [], reply: 'Tell me what to build or change on the board.' }

  // --- generate a layout ---
  const kind = findLayoutKind(t)
  if (kind && /\b(make|create|generate|build|draw|add|new|start)\b/.test(t)) {
    const list = extractList(text)
    const args: Record<string, unknown> = { kind }
    if (kind === 'kanban' && list.length) args.columns = list
    else if (list.length) args.items = list
    const titleMatch = text.match(/(?:titled|title|about|for|of)\s+["']?([^"',.]+)["']?/i)
    if (titleMatch && (kind === 'mindmap' || kind === 'orgchart' || kind === 'wireframe' || kind === 'form')) args.title = titleMatch[1].trim()
    return { calls: [{ tool: 'generate_layout', args }], reply: `Generating a ${kind}${list.length ? ` with ${list.length} item(s)` : ''}…` }
  }

  // --- sticky note ---
  if (/\bsticky\b|\bnote\b/.test(t) && /\b(add|create|make|new|drop)\b/.test(t)) {
    const noteText = text.replace(/.*?(?:note|sticky)\s*(?:that says|saying|:)?\s*/i, '').trim() || 'New note'
    const color = findColor(t)
    return { calls: [{ tool: 'create_sticky_note', args: { text: noteText, ...(color ? { color } : {}) } }], reply: `Adding a sticky note.` }
  }

  // --- restyle selection / everything ---
  if (/\b(color|colour|paint|style|make|turn)\b/.test(t)) {
    const color = findColor(t)
    if (color) {
      const scope = /\ball\b|\beverything\b|\bboard\b/.test(t) ? 'all' : 'selection'
      const prop = /\bstroke|border|outline\b/.test(t) ? 'stroke' : 'fill'
      return {
        calls: [{ tool: '__style_scope', args: { scope, patch: { [prop]: color } } }],
        reply: `Setting ${prop} to ${color} on the ${scope === 'all' ? 'whole board' : 'selection'}…`,
      }
    }
  }

  // --- arrange ---
  if (/\bgrid\b|\btidy\b|\barrange\b|\bclean up\b/.test(t)) {
    return { calls: [{ tool: '__arrange_scope', args: { scope: /\ball\b|\beverything\b/.test(t) ? 'all' : 'selection' } }], reply: 'Arranging into a grid…' }
  }
  if (/\balign\b/.test(t)) {
    const edge = /left/.test(t) ? 'left' : /right/.test(t) ? 'right' : /top/.test(t) ? 'top' : /bottom/.test(t) ? 'bottom' : /vertical|center\s*y/.test(t) ? 'centerY' : 'centerX'
    return { calls: [{ tool: '__align_scope', args: { scope: /\ball\b/.test(t) ? 'all' : 'selection', edge } }], reply: `Aligning ${edge}…` }
  }

  // --- fit / zoom ---
  if (/\bfit\b|\bzoom to fit\b|\bshow everything\b|\bzoom out\b/.test(t)) {
    return { calls: [{ tool: 'zoom_to_fit', args: {} }], reply: 'Fitting the board in view.' }
  }

  // --- export ---
  if (/\bexport\b|\bdownload\b|\bsave\b/.test(t)) {
    if (/\bpng\b|\bimage\b|\bpicture\b/.test(t)) return { calls: [{ tool: 'export_png', args: {} }], reply: 'Exporting a PNG…' }
    if (/\bjson\b/.test(t)) return { calls: [{ tool: 'export_json', args: {} }], reply: 'Exporting board JSON…' }
    return { calls: [{ tool: 'export_svg', args: {} }], reply: 'Exporting an SVG…' }
  }

  // --- clear ---
  if (/\bclear\b|\bwipe\b|\breset the board\b|\bdelete everything\b|\bstart over\b/.test(t)) {
    return { calls: [{ tool: 'clear_board', args: {} }], reply: 'Clearing the board (you can undo with Ctrl+Z).' }
  }

  // --- describe / summarize ---
  if (/\bsummar|describe|explain|tell me about\b/.test(t) || /what(?:'?s| is| are)?\b.*\b(on|board|here|there|this)\b/.test(t)) {
    return { calls: [{ tool: 'summarize_board', args: {} }], reply: '' }
  }

  // --- suggestions ---
  if (/\bsuggest|idea|what should|help|recommend|next\b/.test(t)) {
    return { calls: [{ tool: 'suggest_alternatives', args: {} }], reply: '' }
  }

  // Fallback: ask the board to describe itself so the reply is still useful.
  return {
    calls: [{ tool: 'summarize_board', args: {} }],
    reply: `I didn't catch a specific command. Here's what's on the board — try "generate a kanban with To Do, Doing, Done" or "make everything blue".`,
  }
}
