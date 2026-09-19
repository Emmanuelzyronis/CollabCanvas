import type { DesignGraph, DesignNode, JsonObject, LayoutConstraints, NodeType } from '../../server/domain/contracts'
import type { Dimension, SpacingConstraints } from '../../server/domain/graph-types'
import { DEFAULT_FONT_FAMILY, measureTextBlockHeight, measureTextWidth, resolveLineHeight, type TextMetricsStyle } from './textMetrics'

/**
 * Resolves structural layout (`display`/`direction`/`gap`/`padding`/`align`/
 * `justify`/`fill`) into absolute boxes for the flat SVG renderer.
 *
 * ## Participation
 *
 * A node keeps its own stored position when it declares `position: 'absolute'`
 * (or `'sticky'`) or carries an explicit `x`/`y`. That is true for the root
 * sections a person draws and for any element the human has dragged by hand.
 *
 * Every other node participates in its parent's flow when that parent is a flow
 * container (`display: 'flex' | 'stack' | 'grid'`). Dragging such a child writes
 * `x`/`y` to its layout, which promotes it to an absolutely placed element —
 * exactly what the draggable canvas has always meant.
 *
 * The resolver never invents semantic meaning, never mutates the graph, and is
 * deterministic: the same graph always produces the same boxes.
 */

export interface ResolvedBox {
  x: number
  y: number
  width: number
  height: number
}

export interface ResolvedLayout {
  boxes: ReadonlyMap<string, ResolvedBox>
}

type DimensionKind =
  | { kind: 'fixed'; px: number }
  | { kind: 'fill' }
  | { kind: 'auto' }

// 'block' stacks children vertically like the web default, so it is a flow
// container too; only a node with no display at all keeps its children placed.
const FLOW_DISPLAYS: ReadonlySet<NonNullable<LayoutConstraints['display']>> = new Set(['flex', 'stack', 'grid', 'block'])

const FALLBACK_WIDTH: Partial<Record<NodeType, number>> = {
  heading: 280,
  section: 320,
  container: 320,
  frame: 320,
  card: 300,
  'component-instance': 220,
}
const FALLBACK_HEIGHT: Partial<Record<NodeType, number>> = {
  heading: 64,
  section: 120,
  container: 120,
  frame: 120,
  card: 160,
  'component-instance': 88,
}
const DEFAULT_WIDTH = 160
const DEFAULT_HEIGHT = 88

function numberValue(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function styleObject(properties: JsonObject): JsonObject {
  const style = properties.style
  return style && typeof style === 'object' && !Array.isArray(style) ? (style as JsonObject) : {}
}

function textStyle(node: DesignNode): TextMetricsStyle {
  const style = styleObject(node.properties)
  const fontSize = numberValue(node.properties.fontSize, 16)
  return {
    fontSize,
    fontWeight: numberValue(node.properties.fontWeight, 400),
    fontFamily: typeof style.fontFamily === 'string' ? style.fontFamily : DEFAULT_FONT_FAMILY,
    lineHeight: resolveLineHeight(style.lineHeight, fontSize),
  }
}

export function nodeText(node: DesignNode): string {
  return typeof node.properties.text === 'string' ? node.properties.text : ''
}

/** Spacing shorthand → per-side pixels. Strings such as `'24px'` are accepted. */
export function paddingOf(padding: SpacingConstraints | undefined): { top: number; right: number; bottom: number; left: number } {
  return {
    top: numberValue(padding?.top, 0),
    right: numberValue(padding?.right, 0),
    bottom: numberValue(padding?.bottom, 0),
    left: numberValue(padding?.left, 0),
  }
}

function gapOf(value: LayoutConstraints['gap']): number {
  return numberValue(value, 0)
}

function dimensionKind(value: Dimension | undefined): DimensionKind {
  if (value === 'fill') return { kind: 'fill' }
  if (value === 'auto' || value === undefined) return { kind: 'auto' }
  if (typeof value === 'number' && Number.isFinite(value)) return { kind: 'fixed', px: value }
  if (typeof value === 'object' && value !== null && typeof value.min === 'number') return { kind: 'fixed', px: value.min }
  return { kind: 'auto' }
}

function fixedPx(value: Dimension | undefined): number | null {
  const kind = dimensionKind(value)
  return kind.kind === 'fixed' ? kind.px : null
}

export function isFlowContainer(node: DesignNode): boolean {
  return node.layout.display !== undefined && FLOW_DISPLAYS.has(node.layout.display)
}

/**
 * A node participates in the parent's flow when it is not explicitly placed.
 *
 * An explicit `position: 'flow'` wins even if stray x/y are present, so a plan
 * that restates coordinates cannot accidentally scatter a stack. Absence of a
 * position plus stored x/y is the legacy form of a hand-placed element.
 */
export function participatesInFlow(node: DesignNode): boolean {
  const position = node.layout.position
  if (position === 'flow') return true
  if (position === 'absolute' || position === 'sticky') return false
  return typeof node.layout.x !== 'number' && typeof node.layout.y !== 'number'
}

/** Natural width of a node when its layout says `auto`. */
export function intrinsicWidth(node: DesignNode, available = Number.POSITIVE_INFINITY): number {
  const text = nodeText(node)
  if (text && (node.type === 'text' || node.type === 'heading' || node.type === 'button')) {
    const measured = measureTextWidth(text, textStyle(node))
    return Math.min(Math.max(measured, 40), Number.isFinite(available) ? available : measured)
  }
  const fallback = FALLBACK_WIDTH[node.type] ?? DEFAULT_WIDTH
  return Number.isFinite(available) ? Math.min(fallback, available) : fallback
}

/** Natural height of a node for a given resolved width. */
export function intrinsicHeight(node: DesignNode, width: number): number {
  const text = nodeText(node)
  if (text && (node.type === 'text' || node.type === 'heading')) {
    return Math.max(measureTextBlockHeight(text, Math.max(width, 20), textStyle(node)), FALLBACK_HEIGHT[node.type] ?? 24)
  }
  return FALLBACK_HEIGHT[node.type] ?? DEFAULT_HEIGHT
}

function childrenByParent(graph: DesignGraph): Map<string | null, DesignNode[]> {
  const map = new Map<string | null, DesignNode[]>()
  for (const node of graph.nodes) {
    const list = map.get(node.parentId)
    if (list) list.push(node)
    else map.set(node.parentId, [node])
  }
  for (const list of map.values()) list.sort((a, b) => a.orderIndex - b.orderIndex || a.id.localeCompare(b.id))
  return map
}

interface FlowEntry {
  node: DesignNode
  width: number
  height: number
  widthKind: DimensionKind
  heightKind: DimensionKind
}

/**
 * Resolve every node in the graph to an absolute box.
 *
 * Deterministic: the same graph always produces the same boxes.
 */
export function resolveLayout(graph: DesignGraph): ResolvedLayout {
  const childLists = childrenByParent(graph)
  const boxes = new Map<string, ResolvedBox>()

  const ownBox = (node: DesignNode): ResolvedBox => {
    const width = fixedPx(node.layout.width) ?? intrinsicWidth(node)
    const height = fixedPx(node.layout.height) ?? intrinsicHeight(node, width)
    return {
      x: numberValue(node.layout.x, 0),
      y: numberValue(node.layout.y, 0),
      width: Math.max(width, 0),
      height: Math.max(height, 0),
    }
  }

  /**
   * Height a node takes when its layout says `auto`. A nested stack measures
   * its own children, so a row of buttons is as tall as the buttons.
   */
  const measureHeight = (node: DesignNode, available: number): number => {
    const fixed = fixedPx(node.layout.height)
    if (fixed !== null) return fixed
    const width = fixedPx(node.layout.width) ?? available
    if (isFlowContainer(node)) {
      const pad = paddingOf(node.layout.padding)
      const gap = gapOf(node.layout.gap)
      const inner = Math.max(width - pad.left - pad.right, 0)
      const kids = (childLists.get(node.id) ?? []).filter(participatesInFlow)
      const sizes = kids.map((kid) => measureHeight(kid, inner))
      const content = node.layout.direction === 'row'
        ? (sizes.length ? Math.max(...sizes) : 0)
        : sizes.reduce((sum, size) => sum + size, 0) + gap * Math.max(sizes.length - 1, 0)
      return content + pad.top + pad.bottom
    }
    return intrinsicHeight(node, width)
  }

  const placeChildren = (parent: DesignNode, parentBox: ResolvedBox): void => {
    const kids = childLists.get(parent.id)
    if (!kids || kids.length === 0) return
    if (!isFlowContainer(parent)) {
      for (const kid of kids) visit(kid)
      return
    }

    const layout = parent.layout
    const padding = paddingOf(layout.padding)
    const isColumn = layout.direction !== 'row'
    const gap = gapOf(layout.gap)
    const align = layout.align ?? 'start'
    const justify = layout.justify ?? 'start'

    const mainDim: 'width' | 'height' = isColumn ? 'height' : 'width'
    const crossDim: 'width' | 'height' = isColumn ? 'width' : 'height'
    const mainFixed = fixedPx(layout[mainDim]) !== null
    const crossFixed = fixedPx(layout[crossDim]) !== null

    let contentWidth = Math.max(parentBox.width - padding.left - padding.right, 0)
    let contentHeight = Math.max(parentBox.height - padding.top - padding.bottom, 0)
    const contentX = parentBox.x + padding.left
    const contentY = parentBox.y + padding.top
    const contentMain = isColumn ? contentHeight : contentWidth
    const contentCross = isColumn ? contentWidth : contentHeight

    const flow: FlowEntry[] = []
    for (const kid of kids) {
      if (!participatesInFlow(kid)) {
        visit(kid)
        continue
      }
      const widthKind = dimensionKind(kid.layout.width)
      const heightKind = dimensionKind(kid.layout.height)
      const entry: FlowEntry = { node: kid, width: 0, height: 0, widthKind, heightKind }
      // Cross axis first: a column needs a width before it can measure text height.
      if (isColumn) {
        entry.width = crossAxisSize(widthKind, contentWidth, crossFixed, align, () => intrinsicWidth(kid, contentWidth))
        entry.height = mainAxisSize(heightKind, contentMain, mainFixed, () => measureHeight(kid, entry.width))
      } else {
        entry.width = mainAxisSize(widthKind, contentMain, mainFixed, () => intrinsicWidth(kid))
        entry.height = crossAxisSize(heightKind, contentHeight, crossFixed, align, () => measureHeight(kid, entry.width))
      }
      flow.push(entry)
    }

    // `align: stretch` equalises cross sizes. With a fixed cross dimension the
    // children fill it; with an auto dimension the container hugs the tallest.
    if (align === 'stretch' && !crossFixed && flow.length > 0) {
      const tallest = Math.max(...flow.map((entry) => (isColumn ? entry.width : entry.height)))
      for (const entry of flow) {
        if (isColumn) entry.width = tallest
        else entry.height = tallest
      }
      if (isColumn) {
        parentBox = { ...parentBox, width: tallest + padding.left + padding.right }
        contentWidth = tallest
      } else {
        parentBox = { ...parentBox, height: tallest + padding.top + padding.bottom }
        contentHeight = tallest
      }
      boxes.set(parent.id, parentBox)
    }

    const gapTotal = gap * Math.max(flow.length - 1, 0)
    const mainSizeOf = (entry: FlowEntry) => (isColumn ? entry.height : entry.width)
    const isMainFill = (entry: FlowEntry) => (isColumn ? entry.heightKind : entry.widthKind).kind === 'fill'
    const fixedMain = flow.reduce((sum, entry) => sum + (isMainFill(entry) ? 0 : mainSizeOf(entry)), 0)
    const fillEntries = flow.filter(isMainFill)

    if (fillEntries.length > 0) {
      if (mainFixed) {
        const size = Math.max(((isColumn ? contentHeight : contentWidth) - fixedMain - gapTotal) / fillEntries.length, 0)
        for (const entry of fillEntries) {
          if (isColumn) entry.height = size
          else entry.width = size
        }
      } else {
        for (const entry of fillEntries) {
          if (isColumn) entry.height = measureHeight(entry.node, entry.width)
          else entry.width = intrinsicWidth(entry.node)
        }
      }
    }

    const totalMain = flow.reduce((sum, entry) => sum + mainSizeOf(entry), 0) + gapTotal
    let containerMain = isColumn ? contentHeight : contentWidth
    if (!mainFixed) {
      containerMain = totalMain
      parentBox = isColumn
        ? { ...parentBox, height: totalMain + padding.top + padding.bottom }
        : { ...parentBox, width: totalMain + padding.left + padding.right }
      boxes.set(parent.id, parentBox)
    }

    const leftover = Math.max(containerMain - totalMain, 0)
    let cursor = 0
    let extraGap = 0
    if (justify === 'center') cursor = leftover / 2
    else if (justify === 'end') cursor = leftover
    else if (justify === 'space-between' && flow.length > 1) extraGap = leftover / (flow.length - 1)
    else if (justify === 'space-around' || justify === 'space-evenly') {
      const slots = justify === 'space-evenly' ? flow.length + 1 : flow.length
      extraGap = leftover / slots
      cursor = justify === 'space-evenly' ? extraGap : extraGap / 2
    }

    const mainStart = isColumn ? contentY : contentX
    const crossStart = isColumn ? contentX : contentY
    for (const entry of flow) {
      const main = mainSizeOf(entry)
      const cross = isColumn ? entry.width : entry.height
      let crossOffset = 0
      if (cross < contentCross) {
        if (align === 'center') crossOffset = (contentCross - cross) / 2
        else if (align === 'end') crossOffset = contentCross - cross
      }
      const box: ResolvedBox = isColumn
        ? { x: crossStart + crossOffset, y: mainStart + cursor, width: cross, height: main }
        : { x: mainStart + cursor, y: crossStart + crossOffset, width: main, height: cross }
      boxes.set(entry.node.id, box)
      cursor += main + gap + extraGap
      placeChildren(entry.node, box)
    }
  }

  const mainAxisSize = (kind: DimensionKind, available: number, fixed: boolean, intrinsic: () => number): number => {
    if (kind.kind === 'fixed') return kind.px
    if (kind.kind === 'fill') return fixed ? available : 0
    return intrinsic()
  }

  const crossAxisSize = (kind: DimensionKind, available: number, fixed: boolean, align: string, intrinsic: () => number): number => {
    if (kind.kind === 'fixed') return kind.px
    if (kind.kind === 'fill') return fixed ? available : intrinsic()
    if (align === 'stretch' && fixed) return available
    return intrinsic()
  }

  const visit = (node: DesignNode): ResolvedBox => {
    const existing = boxes.get(node.id)
    if (existing) return existing
    const box = ownBox(node)
    boxes.set(node.id, box)
    placeChildren(node, box)
    return box
  }

  for (const root of childLists.get(null) ?? []) visit(root)
  for (const node of graph.nodes) if (!boxes.has(node.id)) visit(node)
  return { boxes }
}

/** Convenience accessor for consumers that only need one box. */
export function boxFor(layout: ResolvedLayout, nodeId: string): ResolvedBox | undefined {
  return layout.boxes.get(nodeId)
}
