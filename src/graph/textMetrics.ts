/**
 * One text-measurement authority for the canvas projection and the renderer.
 *
 * The browser can measure real glyphs with a 2D canvas context; anywhere that
 * is unavailable (server rendering, unit tests) the module falls back to a
 * deterministic per-character estimate. Both paths share the same wrapping
 * rules, so projected geometry and painted text agree about where lines break.
 */

export interface TextMetricsStyle {
  fontSize: number
  fontWeight?: number
  fontFamily?: string
  lineHeight?: number
}

export const DEFAULT_FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, sans-serif'
export const DEFAULT_LINE_HEIGHT = 1.25

/** Fallback advance width as a fraction of font size, used without a canvas. */
const FALLBACK_CHAR_FACTOR = 0.56
const WIDTH_CACHE_LIMIT = 5000

const widthCache = new Map<string, number>()

/** Structural subset of the 2D context, so OffscreenCanvas and DOM agree. */
interface TextMeasureContext {
  font: string
  measureText(text: string): { width: number }
}

let measureContext: TextMeasureContext | null | undefined

function context(): TextMeasureContext | null {
  if (measureContext !== undefined) return measureContext
  let resolved: TextMeasureContext | null = null
  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      resolved = new OffscreenCanvas(1, 1).getContext('2d') as TextMeasureContext | null
    } else if (typeof document !== 'undefined') {
      resolved = document.createElement('canvas').getContext('2d')
    }
  } catch {
    resolved = null
  }
  measureContext = resolved
  return resolved
}

/** Deterministic estimate used when no canvas measurement backend exists. */
export function estimateTextWidth(text: string, style: TextMetricsStyle): number {
  return text.length * style.fontSize * FALLBACK_CHAR_FACTOR
}

/** Width of `text` on a single line, measured with real glyphs when possible. */
export function measureTextWidth(text: string, style: TextMetricsStyle): number {
  if (!text) return 0
  const ctx = context()
  if (!ctx) return estimateTextWidth(text, style)
  const key = `${style.fontWeight ?? 400}|${style.fontSize}|${style.fontFamily ?? DEFAULT_FONT_FAMILY}|${text}`
  const cached = widthCache.get(key)
  if (cached !== undefined) return cached
  ctx.font = `${style.fontWeight ?? 400} ${style.fontSize}px ${style.fontFamily ?? DEFAULT_FONT_FAMILY}`
  const width = ctx.measureText(text).width
  if (widthCache.size >= WIDTH_CACHE_LIMIT) widthCache.clear()
  widthCache.set(key, width)
  return width
}

/**
 * Greedy word wrap at a pixel width. Explicit newlines are preserved and words
 * wider than the line are hard-broken, matching how the SVG renderer emits
 * `<tspan>` lines.
 */
export function wrapTextToWidth(text: string, maxWidth: number, style: TextMetricsStyle): string[] {
  const limit = Math.max(maxWidth, 1)
  const out: string[] = []
  const fits = (candidate: string) => measureTextWidth(candidate, style) <= limit
  for (const paragraph of text.split('\n')) {
    if (paragraph.length === 0) {
      out.push('')
      continue
    }
    let line = ''
    for (const word of paragraph.split(' ')) {
      const candidate = line ? `${line} ${word}` : word
      if (fits(candidate)) {
        line = candidate
        continue
      }
      if (line) out.push(line)
      if (!fits(word)) {
        let remainder = word
        while (remainder.length > 1 && !fits(remainder)) {
          let cut = remainder.length - 1
          while (cut > 1 && !fits(remainder.slice(0, cut))) cut -= 1
          out.push(remainder.slice(0, cut))
          remainder = remainder.slice(cut)
        }
        line = remainder
      } else {
        line = word
      }
    }
    out.push(line)
  }
  return out
}

/** Block height of wrapped text, in pixels. */
export function measureTextBlockHeight(text: string, maxWidth: number, style: TextMetricsStyle): number {
  const lines = wrapTextToWidth(text, maxWidth, style)
  const lineHeight = style.fontSize * (style.lineHeight ?? DEFAULT_LINE_HEIGHT)
  return lines.length * lineHeight
}

/**
 * Line height is authored either as a multiplier (`1.5`) or as an absolute
 * pixel value (`24`). Both are legitimate design-tool conventions; normalise to
 * a multiplier so measurement and rendering agree.
 */
export function resolveLineHeight(value: unknown, fontSize: number): number {
  const raw = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : Number.NaN
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_LINE_HEIGHT
  return raw >= 4 ? raw / Math.max(fontSize, 1) : raw
}

/** Test seam: drop cached glyph widths. */
export function resetTextMetricsCache(): void {
  widthCache.clear()
}
