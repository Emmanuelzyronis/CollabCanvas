import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { InspectorNodeProjection, InspectorProjection } from '../../graph/graphProjection'
import { defaultAppearance } from '../../graph/canvasProjection'
import type { DesignNode, JsonObject, TokenReferenceMap } from '../../../server/domain/contracts'
import type { Alignment, Dimension, Justify, LayoutDirection, LayoutDisplay, LayoutPosition } from '../../../server/domain/graph-types'

export interface InspectorPanelProps {
  projection?: InspectorProjection
  onUpdateNode?: (nodeId: string, patch: Partial<Omit<DesignNode, 'id' | 'pageId'>>) => Promise<void>
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not set'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number' || typeof value === 'string') return String(value)
  if (Array.isArray(value)) return value.length === 0 ? 'None' : `${value.length} item${value.length === 1 ? '' : 's'}`
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${key}: ${formatValue(nested)}`)
    return entries.length > 0 ? entries.join(', ') : 'None'
  }
  return String(value)
}

function DefinitionList({ entries }: { entries: readonly (readonly [string, unknown])[] }) {
  const visibleEntries = entries.filter(([, value]) => value !== undefined && value !== null && value !== '')
  if (visibleEntries.length === 0) return <p className="text-xs text-text-muted">No data available.</p>
  return (
    <dl className="grid gap-2">
      {visibleEntries.map(([label, value]) => (
        <div key={label} className="grid min-w-0 grid-cols-[minmax(5rem,7rem)_minmax(0,1fr)] gap-2 text-xs">
          <dt className="text-text-muted">{label}</dt>
          <dd className="min-w-0 break-words text-text-secondary">{formatValue(value)}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Presentation-only keys that are surfaced as dedicated design controls. */
const INTERNAL_PROPERTY_KEYS = new Set(['style', 'src'])

function humanProperties(properties: Readonly<Record<string, unknown>>): JsonObject | undefined {
  const visible = Object.entries(properties).filter(([key]) => !INTERNAL_PROPERTY_KEYS.has(key))
  return visible.length > 0 ? Object.fromEntries(visible) as JsonObject : undefined
}

function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('The image could not be read.'))
    reader.onerror = () => reject(new Error('The image could not be read.'))
    reader.readAsDataURL(file)
  })
}

/** Intrinsic pixel size of an image source, so the canvas can fill the frame without distortion. */
function probeImageSize(source: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const probe = new Image()
    probe.onload = () => resolve({ width: probe.naturalWidth, height: probe.naturalHeight })
    probe.onerror = () => resolve(null)
    probe.src = source
  })
}

function InspectorSection({ title, children }: { title: string; children: ReactNode }) {
  const headingId = `inspector-section-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <section aria-labelledby={headingId} className="border-b border-border-subtle pb-4 last:border-b-0 last:pb-0">
      <h3 id={headingId} className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">{title}</h3>
      {children}
    </section>
  )
}

/** Designer-facing words for an element kind; never the internal node taxonomy. */
function elementKindLabel(type: string): string {
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

function NodeSummary({ node }: { node: InspectorNodeProjection }) {
  return (
    <div className="rounded-card border border-border-subtle bg-surface p-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text-primary">{node.metadata.name}</p>
        </div>
        <span className="shrink-0 text-[10px] uppercase text-text-muted">{elementKindLabel(node.metadata.type)}</span>
      </div>
    </div>
  )
}

function SingleNodeInspector({ node, onUpdateNode }: { node: InspectorNodeProjection; onUpdateNode?: InspectorPanelProps['onUpdateNode'] }) {
  const component = node.componentDefinition
  const [name, setName] = useState(node.metadata.name)
  const [accessibleName, setAccessibleName] = useState(node.semantic.accessibleName ?? '')
  const [label, setLabel] = useState(node.semantic.label ?? '')
  const numericLayout = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null
  const [layoutX, setLayoutX] = useState(() => String(numericLayout(node.layout.x) ?? ''))
  const [layoutY, setLayoutY] = useState(() => String(numericLayout(node.layout.y) ?? ''))
  const [layoutWidth, setLayoutWidth] = useState(() => String(numericLayout(node.layout.width) ?? ''))
  const [layoutHeight, setLayoutHeight] = useState(() => String(numericLayout(node.layout.height) ?? ''))

  // --- sizing mode ---
  const dimensionMode = (d: Dimension | undefined): 'fixed' | 'fill' | 'hug' =>
    d === 'fill' ? 'fill' : (d === 'auto' || d === undefined) ? 'hug' : typeof d === 'number' ? 'fixed' : 'hug'
  const [widthMode, setWidthMode] = useState<'fixed' | 'fill' | 'hug'>(() => dimensionMode(node.layout.width))
  const [heightMode, setHeightMode] = useState<'fixed' | 'fill' | 'hug'>(() => dimensionMode(node.layout.height))

  // --- stack controls ---
  const CONTAINER_TYPES = new Set(['frame', 'section', 'container', 'card'])
  const isContainer = CONTAINER_TYPES.has(node.metadata.type)
  const [display, setDisplay] = useState<LayoutDisplay | 'none'>(() => node.layout.display ?? 'none')
  const isStack = display === 'flex' || display === 'stack'
  const [direction, setDirection] = useState<LayoutDirection>(() => node.layout.direction ?? 'column')
  const [gap, setGap] = useState(() => String(typeof node.layout.gap === 'number' ? node.layout.gap : typeof node.layout.gap === 'string' ? node.layout.gap : 0))
  const [padTop, setPadTop] = useState(() => String(node.layout.padding?.top ?? 0))
  const [padRight, setPadRight] = useState(() => String(node.layout.padding?.right ?? 0))
  const [padBottom, setPadBottom] = useState(() => String(node.layout.padding?.bottom ?? 0))
  const [padLeft, setPadLeft] = useState(() => String(node.layout.padding?.left ?? 0))
  const [align, setAlign] = useState<Alignment>(() => node.layout.align ?? 'start')
  const [justify, setJustify] = useState<Justify>(() => node.layout.justify ?? 'start')
  const [position, setPosition] = useState<LayoutPosition | 'flow'>(() => node.layout.position ?? 'flow')
  const initialText = typeof node.properties.text === 'string' ? node.properties.text : ''
  const style = node.properties.style && typeof node.properties.style === 'object' && !Array.isArray(node.properties.style) ? node.properties.style as Record<string, unknown> : {}
  const appearance = useMemo(() => defaultAppearance(node.metadata.type), [node.metadata.type])
  const [fontFamily, setFontFamily] = useState(String(style.fontFamily ?? 'Inter, ui-sans-serif, system-ui, sans-serif'))
  const [fontSize, setFontSize] = useState(String(node.properties.fontSize ?? 16))
  const [fontWeight, setFontWeight] = useState(String(node.properties.fontWeight ?? 400))
  const [lineHeight, setLineHeight] = useState(String(style.lineHeight ?? appearance.lineHeight))
  const [textAlign, setTextAlign] = useState(String(node.properties.textAlign ?? 'center'))
  const [textColor, setTextColor] = useState(String(style.textColor ?? appearance.textColor))
  const [fill, setFill] = useState(String(style.fill ?? appearance.fill))
  const [stroke, setStroke] = useState(String(style.stroke ?? appearance.stroke))
  const [strokeWidth, setStrokeWidth] = useState(String(style.strokeWidth ?? appearance.strokeWidth))
  const [borderRadius, setBorderRadius] = useState(String(style.borderRadius ?? appearance.borderRadius))
  const [opacity, setOpacity] = useState(String(style.opacity ?? appearance.opacity))
  const [text, setText] = useState(initialText)
  const asset = node.asset
  const [altText, setAltText] = useState(asset?.altText ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setName(node.metadata.name)
    setAccessibleName(node.semantic.accessibleName ?? '')
    setLabel(node.semantic.label ?? '')
    setLayoutX(String(numericLayout(node.layout.x) ?? ''))
    setLayoutY(String(numericLayout(node.layout.y) ?? ''))
    setLayoutWidth(String(numericLayout(node.layout.width) ?? ''))
    setLayoutHeight(String(numericLayout(node.layout.height) ?? ''))
    setWidthMode(dimensionMode(node.layout.width))
    setHeightMode(dimensionMode(node.layout.height))
    setDisplay(node.layout.display ?? 'none')
    setDirection(node.layout.direction ?? 'column')
    setGap(String(typeof node.layout.gap === 'number' ? node.layout.gap : typeof node.layout.gap === 'string' ? node.layout.gap : 0))
    setPadTop(String(node.layout.padding?.top ?? 0))
    setPadRight(String(node.layout.padding?.right ?? 0))
    setPadBottom(String(node.layout.padding?.bottom ?? 0))
    setPadLeft(String(node.layout.padding?.left ?? 0))
    setAlign(node.layout.align ?? 'start')
    setJustify(node.layout.justify ?? 'start')
    setPosition(node.layout.position ?? 'flow')
    setText(typeof node.properties.text === 'string' ? node.properties.text : '')
    const nextStyle = node.properties.style && typeof node.properties.style === 'object' && !Array.isArray(node.properties.style) ? node.properties.style as Record<string, unknown> : {}
    setFontFamily(String(nextStyle.fontFamily ?? 'Inter, ui-sans-serif, system-ui, sans-serif'))
    setFontSize(String(node.properties.fontSize ?? 16)); setFontWeight(String(node.properties.fontWeight ?? 400)); setLineHeight(String(nextStyle.lineHeight ?? appearance.lineHeight)); setTextAlign(String(node.properties.textAlign ?? 'center')); setTextColor(String(nextStyle.textColor ?? appearance.textColor))
    setFill(String(nextStyle.fill ?? appearance.fill)); setStroke(String(nextStyle.stroke ?? appearance.stroke)); setStrokeWidth(String(nextStyle.strokeWidth ?? appearance.strokeWidth)); setBorderRadius(String(nextStyle.borderRadius ?? appearance.borderRadius)); setOpacity(String(nextStyle.opacity ?? appearance.opacity))
    setAltText(node.asset?.altText ?? '')
  }, [node.metadata.id, node.metadata.name, node.semantic.accessibleName, node.semantic.label, node.layout, node.properties, node.properties.text, node.asset, appearance])
  const commit = async (patch: Partial<Omit<DesignNode, 'id' | 'pageId'>>) => {
    if (!onUpdateNode) return
    setSaving(true); setError(null)
    try { await onUpdateNode(node.metadata.id, patch) } catch (cause) { setError(cause instanceof Error ? cause.message : 'The property could not be saved.') } finally { setSaving(false) }
  }
  const commitLayoutNumber = (field: 'x' | 'y' | 'width' | 'height', value: string) => {
    const next = Number(value)
    if (value.trim() === '' || !Number.isFinite(next)) return
    void commit({ layout: { ...node.layout, [field]: next } })
  }

  const commitWidthMode = (mode: 'fixed' | 'fill' | 'hug') => {
    setWidthMode(mode)
    const width: Dimension = mode === 'fill' ? 'fill' : mode === 'hug' ? 'auto' : (numericLayout(node.layout.width) ?? 160)
    void commit({ layout: { ...node.layout, width } })
  }

  const commitHeightMode = (mode: 'fixed' | 'fill' | 'hug') => {
    setHeightMode(mode)
    const height: Dimension = mode === 'fill' ? 'fill' : mode === 'hug' ? 'auto' : (numericLayout(node.layout.height) ?? 80)
    void commit({ layout: { ...node.layout, height } })
  }

  const commitDisplay = (next: LayoutDisplay | 'none') => {
    setDisplay(next)
    void commit({ layout: { ...node.layout, display: next === 'none' ? undefined : next } })
  }

  const commitLayoutField = <K extends keyof DesignNode['layout']>(field: K, value: DesignNode['layout'][K]) => {
    void commit({ layout: { ...node.layout, [field]: value } })
  }

  const commitGap = (value: string) => {
    const next = Number(value)
    if (!Number.isFinite(next)) return
    void commit({ layout: { ...node.layout, gap: next } })
  }

  const commitPadding = (top: string, right: string, bottom: string, left: string) => {
    const n = (s: string) => { const v = Number(s); return Number.isFinite(v) ? v : 0 }
    void commit({ layout: { ...node.layout, padding: { top: n(top), right: n(right), bottom: n(bottom), left: n(left) } } })
  }

  const commitZOrder = (delta: number) => {
    const siblings = node.ancestry.length === 0 ? [] : []
    void commit({ orderIndex: Math.max(0, node.metadata.orderIndex + delta) })
  }
  const textNodeType = node.metadata.type === 'text' || node.metadata.type === 'heading' || node.metadata.type === 'button'
  /** Any element that renders text can be edited as text, not only the text tools. */
  const showsTextControls = textNodeType || initialText.length > 0
  const visualStyle = (overrides: Record<string, unknown>): { properties: JsonObject } => ({ properties: { ...node.properties, style: { ...style, ...overrides } as JsonObject } })
  const commitNumber = (field: string, value: string, target: 'properties' | 'style' = 'style') => {
    const next = Number(value)
    if (!Number.isFinite(next)) return
    const source = target === 'properties' ? node.properties : style
    const fallback = target === 'properties'
      ? field === 'fontSize' ? 16 : field === 'fontWeight' ? 400 : undefined
      : (appearance as unknown as Record<string, number>)[field]
    const current = typeof source[field] === 'number' ? source[field] as number : fallback
    if (current === next) return
    void commit(target === 'properties' ? { properties: { ...node.properties, [field]: next } as JsonObject } : visualStyle({ [field]: next }))
  }
  const updateTokenReference = (slot: string, tokenId: string) => {
    const tokenRefs: TokenReferenceMap = { ...node.tokenReferences.reduce<TokenReferenceMap>((refs, reference) => ({ ...refs, [reference.slot]: reference.tokenId }), {}) }
    if (tokenId) tokenRefs[slot as keyof TokenReferenceMap] = tokenId
    else delete tokenRefs[slot as keyof TokenReferenceMap]
    void commit({ tokenRefs })
  }
  return (
    <div className="grid gap-4">
      <InspectorSection title="Name">
        <label className="mb-3 grid gap-1 text-xs text-text-secondary">Name<input aria-label="Node name" className="min-h-9 w-full min-w-0 rounded-control border border-border-default bg-panel px-3 text-sm text-text-primary" value={name} disabled={!onUpdateNode || saving} onChange={(event) => setName(event.target.value)} onBlur={() => { if (name.trim() && name !== node.metadata.name) void commit({ name: name.trim() }) }} /></label>
        <DefinitionList entries={[
          ['Type', node.metadata.type],
          ['Ancestry', node.ancestry.map((ancestor) => ancestor.name).join(' / ') || 'Root'],
        ]} />
      </InspectorSection>

      {node.metadata.type === 'image' ? <InspectorSection title="Image">
        <div className="grid min-w-0 gap-3">
          {asset?.source
            ? <img src={asset.source} alt="" data-inspector-image-preview="true" className="h-24 w-full rounded-control border border-border-subtle object-cover" />
            : <p className="text-xs text-text-muted">No image source is set.</p>}
          <label className="grid min-w-0 gap-1 text-xs text-text-secondary">Alt text<input aria-label="Image alt text" className="min-h-9 w-full min-w-0 rounded-control border border-border-default bg-panel px-3 text-sm text-text-primary" value={altText} disabled={!onUpdateNode || saving || !asset} onChange={(event) => setAltText(event.target.value)} onBlur={() => { if (asset && altText.trim() !== (asset.altText ?? '')) void commit({ assetRef: { ...asset, altText: altText.trim() || undefined } }) }} /></label>
          <label className="grid min-w-0 gap-1 text-xs text-text-secondary">Replace image
            <input aria-label="Replace image" type="file" accept="image/*" disabled={!onUpdateNode || saving || !asset} className="text-xs text-text-secondary" onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file || !asset) return
              if (!file.type.startsWith('image/')) { setError('Choose an image file.'); return }
              if (file.size > 2_000_000) { setError('Choose an image smaller than 2 MB.'); return }
              void readImageFile(file)
                .then(async (source) => {
                  const size = await probeImageSize(source)
                  await commit({ assetRef: { ...asset, source, name: file.name, width: size?.width, height: size?.height } })
                })
                .catch((cause) => setError(cause instanceof Error ? cause.message : 'The image could not be read.'))
            }} />
          </label>
        </div>
      </InspectorSection> : null}
      {showsTextControls ? <InspectorSection title="Text">
        <label className="grid min-w-0 gap-1 text-xs text-text-secondary">Content
          <textarea aria-label="Text content" rows={3} className="w-full min-w-0 resize-y rounded-control border border-border-default bg-panel px-3 py-2 text-sm text-text-primary" value={text} disabled={!onUpdateNode || saving} onChange={(event) => setText(event.target.value)} onBlur={() => { if (text !== initialText) void commit({ properties: { ...node.properties, text } }) }} />
        </label>
      </InspectorSection> : null}
      {showsTextControls ? <InspectorSection title="Typography">
        <div className="grid gap-3">
          <label className="grid min-w-0 gap-1 text-xs text-text-secondary">Font<select aria-label="Font" className="min-h-9 w-full min-w-0 rounded-control border border-border-default bg-panel px-3 text-sm text-text-primary" value={fontFamily} disabled={!onUpdateNode || saving} onChange={(event) => { setFontFamily(event.target.value); void commit(visualStyle({ fontFamily: event.target.value })) }}><option>Inter, ui-sans-serif, system-ui, sans-serif</option><option>Georgia, serif</option><option>Arial, sans-serif</option><option>ui-monospace, SFMono-Regular, monospace</option></select></label>
          <div className="grid min-w-0 grid-cols-2 gap-2"><label className="grid min-w-0 gap-1 text-xs text-text-secondary">Size<input aria-label="Font size" inputMode="decimal" className="min-h-9 w-full min-w-0 rounded-control border border-border-default bg-panel px-3 text-sm" value={fontSize} disabled={!onUpdateNode || saving} onChange={(e) => setFontSize(e.target.value)} onBlur={() => commitNumber('fontSize', fontSize, 'properties')} /></label><label className="grid min-w-0 gap-1 text-xs text-text-secondary">Weight<select aria-label="Font weight" className="min-h-9 w-full min-w-0 rounded-control border border-border-default bg-panel px-3 text-sm" value={fontWeight} disabled={!onUpdateNode || saving} onChange={(e) => { setFontWeight(e.target.value); void commit({ properties: { ...node.properties, fontWeight: Number(e.target.value) } }) }}><option value="400">Regular</option><option value="500">Medium</option><option value="600">Semibold</option><option value="700">Bold</option><option value="800">Extra bold</option></select></label></div>
          <div className="grid min-w-0 grid-cols-2 gap-2"><label className="grid min-w-0 gap-1 text-xs text-text-secondary">Line height<input aria-label="Line height" inputMode="decimal" className="min-h-9 w-full min-w-0 rounded-control border border-border-default bg-panel px-3 text-sm" value={lineHeight} disabled={!onUpdateNode || saving} onChange={(e) => setLineHeight(e.target.value)} onBlur={() => commitNumber('lineHeight', lineHeight)} /></label><label className="grid min-w-0 gap-1 text-xs text-text-secondary">Alignment<select aria-label="Text alignment" className="min-h-9 w-full min-w-0 rounded-control border border-border-default bg-panel px-3 text-sm" value={textAlign} disabled={!onUpdateNode || saving} onChange={(e) => { setTextAlign(e.target.value); void commit({ properties: { ...node.properties, textAlign: e.target.value as 'left' | 'center' | 'right' } }) }}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label></div>
          <label className="flex min-w-0 items-center justify-between gap-3 text-xs text-text-secondary">Color<input aria-label="Text color" type="color" className="h-9 w-14 rounded border border-border-default bg-panel" value={textColor.startsWith('#') ? textColor : '#0f172a'} disabled={!onUpdateNode || saving} onChange={(e) => { setTextColor(e.target.value); void commit(visualStyle({ textColor: e.target.value })) }} /></label>
        </div>
      </InspectorSection> : null}

      {node.metadata.type !== 'text' && node.metadata.type !== 'heading' ? <InspectorSection title="Appearance">
        <div className="grid gap-3"><label className="flex min-w-0 items-center justify-between gap-3 text-xs text-text-secondary">Fill<input aria-label="Fill" type="color" className="h-9 w-14 rounded border border-border-default bg-panel" value={fill.startsWith('#') ? fill : '#ffffff'} disabled={!onUpdateNode || saving} onChange={(e) => { setFill(e.target.value); void commit(visualStyle({ fill: e.target.value })) }} /></label><label className="flex min-w-0 items-center justify-between gap-3 text-xs text-text-secondary">Border<input aria-label="Border" type="color" className="h-9 w-14 rounded border border-border-default bg-panel" value={stroke.startsWith('#') ? stroke : '#64748b'} disabled={!onUpdateNode || saving} onChange={(e) => { setStroke(e.target.value); void commit(visualStyle({ stroke: e.target.value })) }} /></label><div className="grid min-w-0 grid-cols-3 gap-2"><label className="grid min-w-0 gap-1 text-xs text-text-secondary">Width<input aria-label="Border width" inputMode="decimal" className="min-h-9 w-full min-w-0 rounded-control border border-border-default bg-panel px-2 text-sm" value={strokeWidth} onChange={(e) => setStrokeWidth(e.target.value)} onBlur={() => commitNumber('strokeWidth', strokeWidth)} /></label><label className="grid min-w-0 gap-1 text-xs text-text-secondary">Radius<input aria-label="Radius" inputMode="decimal" className="min-h-9 w-full min-w-0 rounded-control border border-border-default bg-panel px-2 text-sm" value={borderRadius} onChange={(e) => setBorderRadius(e.target.value)} onBlur={() => commitNumber('borderRadius', borderRadius)} /></label><label className="grid min-w-0 gap-1 text-xs text-text-secondary">Opacity<input aria-label="Opacity" inputMode="decimal" min="0" max="1" step="0.05" className="min-h-9 w-full min-w-0 rounded-control border border-border-default bg-panel px-2 text-sm" value={opacity} onChange={(e) => setOpacity(e.target.value)} onBlur={() => commitNumber('opacity', opacity)} /></label></div></div>
      </InspectorSection> : null}

      <InspectorSection title="Layout">
        <div className="grid gap-3">
          {/* Sizing */}
          <div className="grid grid-cols-2 gap-2">
            <div className="grid min-w-0 gap-1">
              <span className="text-xs text-text-secondary">Width</span>
              <div className="flex gap-1">
                <select aria-label="Width sizing" className="min-h-8 min-w-0 flex-1 rounded-control border border-border-default bg-panel px-1 text-xs text-text-primary" value={widthMode} disabled={!onUpdateNode || saving} onChange={(e) => commitWidthMode(e.target.value as 'fixed' | 'fill' | 'hug')}>
                  <option value="fixed">Fixed</option>
                  <option value="fill">Fill</option>
                  <option value="hug">Hug</option>
                </select>
                {widthMode === 'fixed' && <input aria-label="Width value" inputMode="decimal" className="min-h-8 w-16 min-w-0 rounded-control border border-border-default bg-panel px-2 text-xs text-text-primary" value={layoutWidth} disabled={!onUpdateNode || saving} placeholder="auto" onChange={(e) => setLayoutWidth(e.target.value)} onBlur={() => commitLayoutNumber('width', layoutWidth)} />}
              </div>
            </div>
            <div className="grid min-w-0 gap-1">
              <span className="text-xs text-text-secondary">Height</span>
              <div className="flex gap-1">
                <select aria-label="Height sizing" className="min-h-8 min-w-0 flex-1 rounded-control border border-border-default bg-panel px-1 text-xs text-text-primary" value={heightMode} disabled={!onUpdateNode || saving} onChange={(e) => commitHeightMode(e.target.value as 'fixed' | 'fill' | 'hug')}>
                  <option value="fixed">Fixed</option>
                  <option value="fill">Fill</option>
                  <option value="hug">Hug</option>
                </select>
                {heightMode === 'fixed' && <input aria-label="Height value" inputMode="decimal" className="min-h-8 w-16 min-w-0 rounded-control border border-border-default bg-panel px-2 text-xs text-text-primary" value={layoutHeight} disabled={!onUpdateNode || saving} placeholder="auto" onChange={(e) => setLayoutHeight(e.target.value)} onBlur={() => commitLayoutNumber('height', layoutHeight)} />}
              </div>
            </div>
          </div>

          {/* Position + XY */}
          <label className="grid gap-1 text-xs text-text-secondary">Position
            <select aria-label="Position type" className="min-h-8 w-full rounded-control border border-border-default bg-panel px-2 text-xs text-text-primary" value={position} disabled={!onUpdateNode || saving} onChange={(e) => { setPosition(e.target.value as LayoutPosition); commitLayoutField('position', e.target.value as LayoutPosition) }}>
              <option value="flow">Flow (auto)</option>
              <option value="absolute">Absolute</option>
              <option value="sticky">Sticky</option>
            </select>
          </label>
          {position !== 'flow' && <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-xs text-text-secondary">X
              <input aria-label="Position X" inputMode="decimal" className="min-h-8 w-full min-w-0 rounded-control border border-border-default bg-panel px-2 text-xs text-text-primary" value={layoutX} disabled={!onUpdateNode || saving} placeholder="auto" onChange={(e) => setLayoutX(e.target.value)} onBlur={() => commitLayoutNumber('x', layoutX)} />
            </label>
            <label className="grid gap-1 text-xs text-text-secondary">Y
              <input aria-label="Position Y" inputMode="decimal" className="min-h-8 w-full min-w-0 rounded-control border border-border-default bg-panel px-2 text-xs text-text-primary" value={layoutY} disabled={!onUpdateNode || saving} placeholder="auto" onChange={(e) => setLayoutY(e.target.value)} onBlur={() => commitLayoutNumber('y', layoutY)} />
            </label>
          </div>}

          {/* Stack controls (container nodes only) */}
          {isContainer && <>
            <label className="grid gap-1 text-xs text-text-secondary">Arrange children
              <select aria-label="Stack layout" className="min-h-8 w-full rounded-control border border-border-default bg-panel px-2 text-xs text-text-primary" value={display} disabled={!onUpdateNode || saving} onChange={(e) => commitDisplay(e.target.value as LayoutDisplay | 'none')}>
                <option value="none">None (absolute)</option>
                <option value="stack">Stack</option>
                <option value="flex">Flex</option>
              </select>
            </label>

            {isStack && <>
              <div className="grid grid-cols-3 gap-2">
                <label className="grid gap-1 text-xs text-text-secondary">Direction
                  <select aria-label="Stack direction" className="min-h-8 w-full rounded-control border border-border-default bg-panel px-2 text-xs text-text-primary" value={direction} disabled={!onUpdateNode || saving} onChange={(e) => { setDirection(e.target.value as LayoutDirection); commitLayoutField('direction', e.target.value as LayoutDirection) }}>
                    <option value="column">↕ Column</option>
                    <option value="row">↔ Row</option>
                  </select>
                </label>
                <label className="grid gap-1 text-xs text-text-secondary">Align
                  <select aria-label="Align items" className="min-h-8 w-full rounded-control border border-border-default bg-panel px-2 text-xs text-text-primary" value={align} disabled={!onUpdateNode || saving} onChange={(e) => { setAlign(e.target.value as Alignment); commitLayoutField('align', e.target.value as Alignment) }}>
                    <option value="start">Start</option>
                    <option value="center">Center</option>
                    <option value="end">End</option>
                    <option value="stretch">Stretch</option>
                  </select>
                </label>
                <label className="grid gap-1 text-xs text-text-secondary">Justify
                  <select aria-label="Justify content" className="min-h-8 w-full rounded-control border border-border-default bg-panel px-2 text-xs text-text-primary" value={justify} disabled={!onUpdateNode || saving} onChange={(e) => { setJustify(e.target.value as Justify); commitLayoutField('justify', e.target.value as Justify) }}>
                    <option value="start">Start</option>
                    <option value="center">Center</option>
                    <option value="end">End</option>
                    <option value="space-between">Space between</option>
                    <option value="space-around">Space around</option>
                    <option value="space-evenly">Space evenly</option>
                  </select>
                </label>
              </div>

              <label className="grid gap-1 text-xs text-text-secondary">Gap
                <input aria-label="Gap" inputMode="decimal" className="min-h-8 w-full rounded-control border border-border-default bg-panel px-2 text-xs text-text-primary" value={gap} disabled={!onUpdateNode || saving} onChange={(e) => setGap(e.target.value)} onBlur={() => commitGap(gap)} />
              </label>

              <div className="grid gap-1 text-xs text-text-secondary">
                <span>Padding</span>
                <div className="grid grid-cols-4 gap-1">
                  {([['Top', padTop, setPadTop], ['Right', padRight, setPadRight], ['Bottom', padBottom, setPadBottom], ['Left', padLeft, setPadLeft]] as const).map(([label, val, setter]) => (
                    <label key={label} className="grid gap-0.5 text-xs text-text-secondary">{label}
                      <input aria-label={`Padding ${label}`} inputMode="decimal" className="min-h-8 w-full rounded-control border border-border-default bg-panel px-1 text-center text-xs text-text-primary" value={val} disabled={!onUpdateNode || saving} onChange={(e) => (setter as (v: string) => void)(e.target.value)} onBlur={() => commitPadding(padTop, padRight, padBottom, padLeft)} />
                    </label>
                  ))}
                </div>
              </div>
            </>}
          </>}

          {/* Z-order */}
          <div className="grid gap-1 text-xs text-text-secondary">
            <span>Order</span>
            <div className="flex gap-2">
              <button type="button" aria-label="Bring forward" disabled={!onUpdateNode || saving} className="min-h-8 flex-1 rounded-control border border-border-default bg-panel px-2 text-xs text-text-secondary hover:bg-hover disabled:opacity-40" onClick={() => commitZOrder(-1)}>↑ Forward</button>
              <button type="button" aria-label="Send backward" disabled={!onUpdateNode || saving} className="min-h-8 flex-1 rounded-control border border-border-default bg-panel px-2 text-xs text-text-secondary hover:bg-hover disabled:opacity-40" onClick={() => commitZOrder(1)}>↓ Backward</button>
            </div>
          </div>
        </div>
      </InspectorSection>
      <InspectorSection title="Role">
        <div className="mb-3 grid gap-2">
          <label className="grid min-w-0 gap-1 text-xs text-text-secondary">Accessible name<input aria-label="Accessible name" className="min-h-9 w-full min-w-0 rounded-control border border-border-default bg-panel px-3 text-sm text-text-primary" value={accessibleName} disabled={!onUpdateNode || saving} onChange={(event) => setAccessibleName(event.target.value)} onBlur={() => { if (accessibleName.trim() !== (node.semantic.accessibleName ?? '')) void commit({ semantic: { ...node.semantic, accessibleName: accessibleName.trim() || undefined } }) }} /></label>
          <label className="grid min-w-0 gap-1 text-xs text-text-secondary">Label<input aria-label="Semantic label" className="min-h-9 w-full min-w-0 rounded-control border border-border-default bg-panel px-3 text-sm text-text-primary" value={label} disabled={!onUpdateNode || saving} onChange={(event) => setLabel(event.target.value)} onBlur={() => { if (label.trim() !== (node.semantic.label ?? '')) void commit({ semantic: { ...node.semantic, label: label.trim() || undefined } }) }} /></label>
          {saving ? <p role="status" className="text-xs text-text-muted">Saving…</p> : null}
          {error ? <p role="alert" className="text-xs text-error">{error}</p> : null}
        </div>
        <DefinitionList entries={[
          ['Role', node.semantic.role],
          ['Accessible name', node.semantic.accessibleName],
          ['Label', node.semantic.label],
          ['Description', node.semantic.description],
          ['Heading level', node.semantic.level],
        ]} />
      </InspectorSection>

      <InspectorSection title="Content">
        <DefinitionList entries={[
          ['Properties', humanProperties(node.properties)],
          ['Component', component?.name ?? node.metadata.component?.definitionName],
          ['Component ID', component?.id],
          ['Component description', component?.description],
          ['Anatomy', component?.anatomy.join(', ')],
          ['Component props', component?.props.join(', ')],
          ['Variant', node.metadata.component?.variant],
          ['Component state', node.metadata.component?.state],
        ]} />
      </InspectorSection>

      <InspectorSection title="Tokens">
        <div className="grid gap-3">
          {node.tokenReferences.length === 0 ? <p className="text-xs text-text-muted">No token references defined.</p> : node.tokenReferences.map((reference) => (
            <label key={reference.slot} className="grid min-w-0 gap-1 text-xs text-text-secondary">
              <span className="capitalize">{reference.slot} token</span>
              <select
                aria-label={`Token ${reference.slot}`}
                className="min-h-9 w-full min-w-0 rounded-control border border-border-default bg-panel px-3 text-sm text-text-primary"
                value={reference.tokenId}
                disabled={!onUpdateNode || saving}
                onChange={(event) => updateTokenReference(reference.slot, event.target.value)}
              >
                <option value="">No token</option>
                {node.availableTokens.map((token) => <option key={token.id} value={token.id}>{token.name}</option>)}
              </select>
              <span className="text-[11px] text-text-muted">{formatValue(reference.token.value)}</span>
            </label>
          ))}
          <DefinitionList entries={[
            ['Typography', node.typography ? `${node.typography.name} (${node.typography.fontFamily}, ${formatValue(node.typography.fontSize)})` : undefined],
          ]} />
        </div>
      </InspectorSection>

      <InspectorSection title="Responsive">
        {node.responsive.length === 0 ? <p className="text-xs text-text-muted">No responsive constraints defined.</p> : (
          <ul className="grid gap-2" aria-label="Responsive constraints">
            {node.responsive.map((constraint) => (
              <li key={constraint.breakpoint} className="rounded-card border border-border-subtle bg-surface p-2">
                <p className="text-xs font-medium text-text-primary">{constraint.breakpoint}</p>
                <DefinitionList entries={[
                  ['Hidden', constraint.hidden],
                  ['Order', constraint.orderIndex],
                  ['Layout', constraint.layout],
                ]} />
              </li>
            ))}
          </ul>
        )}
      </InspectorSection>

      <InspectorSection title="Accessibility">
        <DefinitionList entries={node.accessibility ? Object.entries(node.accessibility) : []} />
      </InspectorSection>

      <InspectorSection title="Interactions">
        <DefinitionList entries={[
          ['Interactions', node.interactions.map((interaction) => formatValue(interaction)).join('; ')],
          ['States', node.states.map((state) => state.name).join(', ')],
        ]} />
      </InspectorSection>

      <InspectorSection title="Design intent">
        {node.intents.length === 0 ? <p className="text-xs text-text-muted">No design intent linked.</p> : (
          <ul className="grid gap-2" aria-label="Design intent">
            {node.intents.map((intent) => <li key={intent.id} className="text-xs text-text-secondary"><span className="font-medium text-text-primary">{intent.statement}</span>{intent.priority ? ` (${intent.priority} priority)` : ''}</li>)}
          </ul>
        )}
      </InspectorSection>

      <InspectorSection title="Details">
        <DefinitionList entries={[
          ['Created', node.metadata.createdAt],
          ['Updated', node.metadata.updatedAt],
          ['Asset', node.asset?.name ?? node.asset?.id],
          ['Child count', node.metadata.childIds.length],
        ]} />
      </InspectorSection>
    </div>
  )
}

/** Designer-facing inspector. Persistent edits are emitted as application/domain commands. */
export default function InspectorPanel({ projection, onUpdateNode }: InspectorPanelProps) {
  if (!projection) {
    return <div className="rounded-card border border-dashed border-border-strong px-3 py-4" data-inspector-state="unavailable"><p className="text-xs text-text-muted">Select an element on the canvas to edit it.</p></div>
  }

  if (projection.mode === 'none') {
    return <div className="rounded-card border border-dashed border-border-strong px-3 py-4" data-inspector-state="empty"><p className="text-xs text-text-muted">Select an element on the canvas to edit it.</p></div>
  }

  if (projection.mode === 'multiple') {
    return (
      <div className="grid gap-4" data-inspector-state="multiple">
        <div className="rounded-card border border-border-subtle bg-surface p-3">
          <p className="text-sm font-medium text-text-primary">{projection.count} elements selected</p>
          <p className="mt-1 text-xs text-text-muted">Editing several elements at once is not available yet.</p>
        </div>
        <div className="grid gap-2" aria-label="Selected elements">
          {projection.nodes.map((node) => <NodeSummary key={node.metadata.id} node={node} />)}
        </div>
      </div>
    )
  }

  const node = projection.nodes[0]
  if (!node) return <div className="rounded-card border border-dashed border-border-strong px-3 py-4" data-inspector-state="empty"><p className="text-xs text-text-muted">Nothing is selected.</p></div>
  return <div data-inspector-state="single"><SingleNodeInspector node={node} onUpdateNode={onUpdateNode} /></div>
}
