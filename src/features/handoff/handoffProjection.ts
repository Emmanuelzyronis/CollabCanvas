import type { DesignManifest, ManifestNode } from '../../../server/domain/manifest-types'

export type HandoffAvailability = 'HANDOFF_LOADING' | 'HANDOFF_READY' | 'HANDOFF_UNAVAILABLE' | 'HANDOFF_INVALID'

export interface HandoffCount {
  readonly label: string
  readonly value: number
}

export interface HandoffOutlineRow {
  readonly id: string
  readonly depth: number
  readonly name: string
  readonly kind: string
}

export interface HandoffTokenRow {
  readonly name: string
  readonly category: string
  readonly value: string
}

export interface HandoffSummary {
  readonly counts: readonly HandoffCount[]
  readonly outline: readonly HandoffOutlineRow[]
  readonly tokens: readonly HandoffTokenRow[]
  readonly components: readonly { name: string; variants: string[] }[]
  readonly brief: string
  readonly json: string
  readonly bytes: number
}

export interface HandoffState {
  readonly availability: HandoffAvailability
  readonly summary?: HandoffSummary
  readonly error?: { readonly code: string; readonly message: string }
}

/** Designer words for an element kind; never the internal node taxonomy. */
function kindLabel(type: ManifestNode['type']): string {
  switch (type) {
    case 'heading': return 'Heading'
    case 'text': return 'Text'
    case 'button': return 'Button'
    case 'image': return 'Image'
    case 'card': return 'Card'
    case 'section': return 'Section'
    case 'container': return 'Box'
    case 'frame': return 'Frame'
    case 'input': return 'Input'
    case 'icon': return 'Icon'
    case 'list': return 'List'
    case 'table': return 'Table'
    case 'component-instance': return 'Component'
    case 'page': return 'Page'
    default: return 'Element'
  }
}

function textOf(node: ManifestNode): string | null {
  const text = node.properties?.text
  return typeof text === 'string' && text.trim().length > 0 ? text.trim() : null
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

/** Depth-first, deterministic outline of the design as a person would read it. */
function outlineOf(manifest: DesignManifest): HandoffOutlineRow[] {
  const byId = new Map(manifest.nodes.map((node) => [node.id, node]))
  const rows: HandoffOutlineRow[] = []
  const visit = (id: string, depth: number) => {
    const node = byId.get(id)
    if (!node) return
    rows.push({ id: node.id, depth, name: node.name, kind: kindLabel(node.type) })
    const children = [...node.children].sort((a, b) => (byId.get(a)?.orderIndex ?? 0) - (byId.get(b)?.orderIndex ?? 0))
    for (const child of children) visit(child, depth + 1)
  }
  for (const page of manifest.pages) {
    for (const rootId of [...page.rootNodeIds].sort((a, b) => (byId.get(a)?.orderIndex ?? 0) - (byId.get(b)?.orderIndex ?? 0))) visit(rootId, 0)
  }
  return rows
}

/**
 * A plain-language implementation brief. This is what a coding agent (or the
 * person pasting into one) reads first: what to build, in what order, with what
 * styles and assets.
 */
export function buildAgentBrief(manifest: DesignManifest): string {
  const outline = outlineOf(manifest)
  const lines: string[] = []
  lines.push(`# ${manifest.project.name} — ${manifest.document.name}`)
  lines.push('')
  lines.push('Build this interface from the structured design below. Layout values are absolute pixels on the page canvas.')
  lines.push('')
  for (const page of manifest.pages) {
    lines.push(`## Page: ${page.name}${page.routeHint ? ` (${page.routeHint})` : ''}`)
    lines.push('')
    for (const row of outline) {
      const node = manifest.nodes.find((candidate) => candidate.id === row.id)
      if (!node || node.pageId !== page.id) continue
      const g = node.geometry
      const geometry = g && g.x !== undefined && g.y !== undefined && g.width !== undefined && g.height !== undefined
        ? ` at ${Math.round(g.x)},${Math.round(g.y)} sized ${Math.round(g.width)}×${Math.round(g.height)}`
        : ''
      const text = textOf(node)
      const details: string[] = []
      if (text) details.push(`text ${JSON.stringify(text)}`)
      if (node.assetRef) details.push(`image "${node.assetRef.name}"${node.assetRef.altText ? ` (alt: ${node.assetRef.altText})` : ''}`)
      if (node.responsive?.length) details.push(`${node.responsive.length} responsive rule(s)`)
      if (node.interactions?.length) details.push(`${node.interactions.length} interaction(s)`)
      if (node.accessibility) details.push('accessibility metadata')
      lines.push(`${'  '.repeat(row.depth)}- ${row.name} — ${row.kind}${geometry}${details.length ? `; ${details.join('; ')}` : ''}`)
    }
    lines.push('')
  }
  if (manifest.tokens.length > 0) {
    lines.push('## Design tokens')
    lines.push('')
    for (const token of [...manifest.tokens].sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(`- ${token.name} (${token.category}): ${formatValue(token.value)}`)
    }
    lines.push('')
  }
  if (manifest.typography.length > 0) {
    lines.push('## Text styles')
    lines.push('')
    for (const style of [...manifest.typography].sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(`- ${style.name}: ${style.fontFamily}, ${formatValue(style.fontSize)}, weight ${formatValue(style.fontWeight)}, line-height ${formatValue(style.lineHeight)}`)
    }
    lines.push('')
  }
  if (manifest.assets.length > 0) {
    lines.push('## Assets')
    lines.push('')
    for (const asset of [...manifest.assets].sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(`- ${asset.name} (${asset.kind})${asset.altText ? ` — alt: ${asset.altText}` : ''}`)
    }
    lines.push('')
  }
  return lines.join('\n').trim()
}

/** Project a canonical manifest into the handoff surface model. */
export function projectHandoff(manifest: DesignManifest): HandoffState {
  const json = JSON.stringify(manifest, null, 2)
  return {
    availability: 'HANDOFF_READY',
    summary: {
      counts: [
        { label: 'Pages', value: manifest.pages.length },
        { label: 'Layers', value: manifest.nodes.length },
        { label: 'Components', value: manifest.componentDefinitions.length },
        { label: 'Tokens', value: manifest.tokens.length },
        { label: 'Text styles', value: manifest.typography.length },
        { label: 'Assets', value: manifest.assets.length },
      ],
      outline: outlineOf(manifest),
      tokens: manifest.tokens.map((token) => ({ name: token.name, category: token.category, value: formatValue(token.value) })),
      components: manifest.componentDefinitions.map((definition) => ({
        name: definition.name,
        variants: Object.entries(definition.variants).map(([group, values]) => `${group}: ${values.join(', ')}`),
      })),
      brief: buildAgentBrief(manifest),
      json,
      bytes: json.length,
    },
  }
}

export function handoffLoading(): HandoffState {
  return { availability: 'HANDOFF_LOADING' }
}

export function handoffFailure(code: string, message: string): HandoffState {
  return { availability: code === 'INVALID_GRAPH' ? 'HANDOFF_INVALID' : 'HANDOFF_UNAVAILABLE', error: { code, message } }
}
