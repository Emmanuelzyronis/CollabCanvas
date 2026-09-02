import type { CanvasElement } from '../types'
import { boundsOf, clipToBox, elementRect, SVG_ANCHOR } from '../store/geometry'

/** Escape text for safe embedding in SVG/XML. */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Word-wrap mirroring ElementView so exported text matches the canvas. */
function wrapText(text: string, widthPx: number, fontSize: number): string[] {
  const maxChars = Math.max(1, Math.floor(widthPx / (fontSize * 0.56)))
  const out: string[] = []
  for (const para of text.split('\n')) {
    if (para.length === 0) {
      out.push('')
      continue
    }
    let line = ''
    for (const word of para.split(' ')) {
      const candidate = line ? `${line} ${word}` : word
      if (candidate.length <= maxChars) {
        line = candidate
      } else {
        if (line) out.push(line)
        if (word.length > maxChars) {
          let w = word
          while (w.length > maxChars) {
            out.push(w.slice(0, maxChars))
            w = w.slice(maxChars)
          }
          line = w
        } else {
          line = word
        }
      }
    }
    out.push(line)
  }
  return out
}

const FONT = 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif'

function textMarkup(el: CanvasElement): string {
  if (!el.text) return ''
  const r = elementRect(el)
  const pad = el.type === 'sticky' ? 14 : el.type === 'text' ? 2 : 10
  const anchor = SVG_ANCHOR[el.textAlign]
  const x = el.textAlign === 'left' ? r.minX + pad : el.textAlign === 'right' ? r.maxX - pad : r.cx
  const lines = wrapText(el.text, Math.max(r.width - pad * 2, 20), el.fontSize)
  const lineHeight = el.fontSize * 1.25
  const middle = el.type !== 'text'
  const totalH = lines.length * lineHeight
  const startY = middle ? r.cy - totalH / 2 + lineHeight / 2 : r.minY + pad + el.fontSize / 2
  const tspans = lines
    .map((ln, i) => `<tspan x="${x}" y="${startY + i * lineHeight}" dominant-baseline="middle">${esc(ln || ' ')}</tspan>`)
    .join('')
  return `<text font-size="${el.fontSize}" font-weight="${el.fontWeight}" fill="${el.textColor}" text-anchor="${anchor}" font-family="${FONT}">${tspans}</text>`
}

function dashArray(el: CanvasElement): string {
  return el.dashed ? ` stroke-dasharray="${Math.max(el.strokeWidth * 3, 6)} ${Math.max(el.strokeWidth * 2, 4)}"` : ''
}

function shapeMarkup(el: CanvasElement, elements: Record<string, CanvasElement>): string {
  const r = elementRect(el)
  const dash = dashArray(el)
  const style = `fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" opacity="${el.opacity}"${dash}`
  switch (el.type) {
    case 'rectangle':
      return `<rect x="${r.minX}" y="${r.minY}" width="${r.width}" height="${r.height}" rx="8" ${style}/>${textMarkup(el)}`
    case 'text':
      return textMarkup(el)
    case 'sticky':
      return `<rect x="${r.minX}" y="${r.minY}" width="${r.width}" height="${r.height}" rx="4" fill="${el.fill}" opacity="${el.opacity}"/>${textMarkup(el)}`
    case 'ellipse':
      return `<ellipse cx="${r.cx}" cy="${r.cy}" rx="${r.width / 2}" ry="${r.height / 2}" ${style}/>${textMarkup(el)}`
    case 'diamond':
      return `<polygon points="${r.cx},${r.minY} ${r.maxX},${r.cy} ${r.cx},${r.maxY} ${r.minX},${r.cy}" ${style}/>${textMarkup(el)}`
    case 'frame': {
      const label = el.text ? `<text x="${r.minX + 12}" y="${r.minY + 20}" font-size="13" font-weight="600" fill="#64748b" font-family="${FONT}">${esc(el.text)}</text>` : ''
      return `<rect x="${r.minX}" y="${r.minY}" width="${r.width}" height="${r.height}" rx="10" ${style}/>${label}`
    }
    case 'connector':
    case 'line':
      return connectorMarkup(el, elements)
    default:
      return ''
  }
}

function connectorMarkup(el: CanvasElement, elements: Record<string, CanvasElement>): string {
  let p1: { x: number; y: number }
  let p2: { x: number; y: number }
  const a = el.from ? elements[el.from] : undefined
  const b = el.to ? elements[el.to] : undefined
  if (a && b) {
    const ra = elementRect(a)
    const rb = elementRect(b)
    p1 = clipToBox({ x: rb.cx, y: rb.cy }, ra)
    p2 = clipToBox({ x: ra.cx, y: ra.cy }, rb)
  } else {
    const r = elementRect(el)
    p1 = { x: r.minX, y: r.minY }
    p2 = { x: r.maxX, y: r.maxY }
  }
  const dash = dashArray(el)
  const line = `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" stroke-linecap="round"${dash} marker-end="url(#arrow)"/>`
  if (!el.text) return `<g opacity="${el.opacity}">${line}</g>`
  const mx = (p1.x + p2.x) / 2
  const my = (p1.y + p2.y) / 2
  const label = `<rect x="${mx - el.text.length * 3.6 - 6}" y="${my - 11}" width="${el.text.length * 7.2 + 12}" height="22" rx="6" fill="#ffffff" stroke="#e2e8f0"/><text x="${mx}" y="${my}" font-size="12" fill="#334155" text-anchor="middle" dominant-baseline="middle" font-family="${FONT}">${esc(el.text)}</text>`
  return `<g opacity="${el.opacity}">${line}${label}</g>`
}

export interface SvgOptions {
  padding?: number
  background?: string
}

/** Serialize elements (in draw order) to a standalone SVG document string. */
export function elementsToSvg(els: CanvasElement[], opts: SvgOptions = {}): { svg: string; width: number; height: number } {
  const pad = opts.padding ?? 40
  const b = boundsOf(els)
  const minX = (b?.minX ?? 0) - pad
  const minY = (b?.minY ?? 0) - pad
  const width = (b?.width ?? 100) + pad * 2
  const height = (b?.height ?? 100) + pad * 2
  const bg = opts.background ?? '#ffffff'
  // Connectors first so arrows sit under shapes; then everything else in order.
  const connectors = els.filter((e) => e.type === 'connector' || e.type === 'line')
  const shapes = els.filter((e) => e.type !== 'connector' && e.type !== 'line')
  const elementMap: Record<string, CanvasElement> = {}
  for (const el of els) elementMap[el.id] = el
  const body = [...connectors, ...shapes].map((el) => shapeMarkup(el, elementMap)).join('\n  ')
  const defs = `<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="context-stroke"/></marker></defs>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${minX} ${minY} ${width} ${height}">\n  ${defs}\n  <rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="${bg}"/>\n  ${body}\n</svg>`
  return { svg, width, height }
}
