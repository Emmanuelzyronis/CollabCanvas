import type { CanvasElement, TextAlign } from '../types'

export interface Rect {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
  cx: number
  cy: number
}

export function elementRect(el: CanvasElement): Rect {
  const minX = Math.min(el.x, el.x + el.width)
  const minY = Math.min(el.y, el.y + el.height)
  const maxX = Math.max(el.x, el.x + el.width)
  const maxY = Math.max(el.y, el.y + el.height)
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  }
}

export function boundsOf(els: CanvasElement[]): Rect | null {
  if (els.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const el of els) {
    const r = elementRect(el)
    minX = Math.min(minX, r.minX)
    minY = Math.min(minY, r.minY)
    maxX = Math.max(maxX, r.maxX)
    maxY = Math.max(maxY, r.maxY)
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 }
}

/** Hit test a world point against an element (with a little padding for thin shapes). */
export function hitTest(el: CanvasElement, wx: number, wy: number, pad = 6): boolean {
  const r = elementRect(el)
  if (el.type === 'connector' || el.type === 'line') {
    return wx >= r.minX - pad && wx <= r.maxX + pad && wy >= r.minY - pad && wy <= r.maxY + pad
  }
  if (el.type === 'ellipse') {
    const rx = Math.max(r.width / 2, 1)
    const ry = Math.max(r.height / 2, 1)
    const nx = (wx - r.cx) / rx
    const ny = (wy - r.cy) / ry
    return nx * nx + ny * ny <= 1.15
  }
  return wx >= r.minX - pad && wx <= r.maxX + pad && wy >= r.minY - pad && wy <= r.maxY + pad
}

export function rectIntersects(a: Rect, b: Rect): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY
}

/**
 * Intersection of the segment from an outside point toward a box center, with the box edge.
 * Used to make connectors touch element borders instead of centers.
 */
export function clipToBox(from: { x: number; y: number }, box: Rect): { x: number; y: number } {
  const dx = box.cx - from.x
  const dy = box.cy - from.y
  if (dx === 0 && dy === 0) return { x: box.cx, y: box.cy }
  const hw = box.width / 2 || 1
  const hh = box.height / 2 || 1
  const scale = 1 / Math.max(Math.abs(dx) / hw, Math.abs(dy) / hh)
  return { x: box.cx - dx * scale, y: box.cy - dy * scale }
}

export type AlignEdge = 'left' | 'right' | 'top' | 'bottom' | 'centerX' | 'centerY'

/** Compute position patches to align the given elements to a shared edge. */
export function computeAlign(els: CanvasElement[], edge: AlignEdge): Record<string, { x?: number; y?: number }> {
  const b = boundsOf(els)
  if (!b) return {}
  const patches: Record<string, { x?: number; y?: number }> = {}
  for (const el of els) {
    const r = elementRect(el)
    switch (edge) {
      case 'left':
        patches[el.id] = { x: b.minX }
        break
      case 'right':
        patches[el.id] = { x: b.maxX - r.width }
        break
      case 'top':
        patches[el.id] = { y: b.minY }
        break
      case 'bottom':
        patches[el.id] = { y: b.maxY - r.height }
        break
      case 'centerX':
        patches[el.id] = { x: b.cx - r.width / 2 }
        break
      case 'centerY':
        patches[el.id] = { y: b.cy - r.height / 2 }
        break
    }
  }
  return patches
}

/** Evenly distribute spacing between elements along an axis. */
export function computeDistribute(els: CanvasElement[], axis: 'horizontal' | 'vertical'): Record<string, { x?: number; y?: number }> {
  if (els.length < 3) return {}
  const sorted = [...els].sort((a, b) => (axis === 'horizontal' ? elementRect(a).cx - elementRect(b).cx : elementRect(a).cy - elementRect(b).cy))
  const patches: Record<string, { x?: number; y?: number }> = {}
  if (axis === 'horizontal') {
    const first = elementRect(sorted[0])
    const last = elementRect(sorted[sorted.length - 1])
    const totalW = sorted.reduce((s, el) => s + elementRect(el).width, 0)
    const gap = (last.maxX - first.minX - totalW) / (sorted.length - 1)
    let cursor = first.minX
    for (const el of sorted) {
      const r = elementRect(el)
      patches[el.id] = { x: cursor }
      cursor += r.width + gap
    }
  } else {
    const first = elementRect(sorted[0])
    const last = elementRect(sorted[sorted.length - 1])
    const totalH = sorted.reduce((s, el) => s + elementRect(el).height, 0)
    const gap = (last.maxY - first.minY - totalH) / (sorted.length - 1)
    let cursor = first.minY
    for (const el of sorted) {
      const r = elementRect(el)
      patches[el.id] = { y: cursor }
      cursor += r.height + gap
    }
  }
  return patches
}

/** Lay elements out on a grid starting from the top-left of their combined bounds. */
export function computeGrid(
  els: CanvasElement[],
  opts: { columns?: number; gap?: number; originX?: number; originY?: number },
): Record<string, { x: number; y: number }> {
  if (els.length === 0) return {}
  const gap = opts.gap ?? 32
  const columns = Math.max(1, opts.columns ?? Math.ceil(Math.sqrt(els.length)))
  const b = boundsOf(els)!
  const originX = opts.originX ?? b.minX
  const originY = opts.originY ?? b.minY
  const colWidth = Math.max(...els.map((e) => elementRect(e).width))
  const rowHeight = Math.max(...els.map((e) => elementRect(e).height))
  const patches: Record<string, { x: number; y: number }> = {}
  els.forEach((el, i) => {
    const col = i % columns
    const row = Math.floor(i / columns)
    patches[el.id] = { x: originX + col * (colWidth + gap), y: originY + row * (rowHeight + gap) }
  })
  return patches
}

export const SVG_ANCHOR: Record<TextAlign, 'start' | 'middle' | 'end'> = {
  left: 'start',
  center: 'middle',
  right: 'end',
}
