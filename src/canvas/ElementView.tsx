import { memo } from 'react'
import type { CanvasElement } from '../types'
import { clipToBox, elementRect, SVG_ANCHOR } from '../store/geometry'

/** Rough word-wrap so multi-line text renders with native <tspan> (PNG-export safe). */
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

function TextContent({ el }: { el: CanvasElement }) {
  if (!el.text) return null
  const r = elementRect(el)
  const pad = el.type === 'sticky' ? 14 : el.type === 'text' ? 2 : 10
  const anchor = SVG_ANCHOR[el.textAlign]
  const x = el.textAlign === 'left' ? r.minX + pad : el.textAlign === 'right' ? r.maxX - pad : r.cx
  const lines = wrapText(el.text, Math.max(r.width - pad * 2, 20), el.fontSize)
  const lineHeight = el.fontSize * 1.25
  const middle = el.type !== 'text'
  const totalH = lines.length * lineHeight
  const startY = middle ? r.cy - totalH / 2 + lineHeight / 2 : r.minY + pad + el.fontSize / 2
  return (
    <text
      fontSize={el.fontSize}
      fontWeight={el.fontWeight}
      fill={el.textColor}
      textAnchor={anchor}
      style={{ userSelect: 'none', pointerEvents: 'none', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
    >
      {lines.map((ln, i) => (
        <tspan key={i} x={x} y={startY + i * lineHeight} dominantBaseline="middle">
          {ln || ' '}
        </tspan>
      ))}
    </text>
  )
}

export const ShapeView = memo(function ShapeView({ el }: { el: CanvasElement }) {
  const r = elementRect(el)
  const dash = el.dashed ? `${Math.max(el.strokeWidth * 3, 6)} ${Math.max(el.strokeWidth * 2, 4)}` : undefined
  const common = {
    fill: el.fill,
    stroke: el.stroke,
    strokeWidth: el.strokeWidth,
    strokeDasharray: dash,
    opacity: el.opacity,
  }

  switch (el.type) {
    case 'rectangle':
    case 'text':
      return (
        <g>
          {el.type === 'rectangle' && <rect x={r.minX} y={r.minY} width={r.width} height={r.height} rx={8} {...common} />}
          <TextContent el={el} />
        </g>
      )
    case 'sticky':
      return (
        <g opacity={el.opacity}>
          <rect x={r.minX} y={r.minY} width={r.width} height={r.height} rx={4} fill={el.fill} filter="url(#stickyShadow)" />
          <TextContent el={el} />
        </g>
      )
    case 'ellipse':
      return (
        <g>
          <ellipse cx={r.cx} cy={r.cy} rx={r.width / 2} ry={r.height / 2} {...common} />
          <TextContent el={el} />
        </g>
      )
    case 'diamond':
      return (
        <g>
          <polygon points={`${r.cx},${r.minY} ${r.maxX},${r.cy} ${r.cx},${r.maxY} ${r.minX},${r.cy}`} {...common} />
          <TextContent el={el} />
        </g>
      )
    case 'frame':
      return (
        <g>
          <rect x={r.minX} y={r.minY} width={r.width} height={r.height} rx={10} {...common} />
          {el.text && (
            <text
              x={r.minX + 12}
              y={r.minY + 20}
              fontSize={13}
              fontWeight={600}
              fill="#64748b"
              style={{ userSelect: 'none', pointerEvents: 'none', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
            >
              {el.text}
            </text>
          )}
        </g>
      )
    default:
      return null
  }
})

export const ConnectorView = memo(function ConnectorView({
  el,
  elements,
}: {
  el: CanvasElement
  elements: Record<string, CanvasElement>
}) {
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
  const mx = (p1.x + p2.x) / 2
  const my = (p1.y + p2.y) / 2
  const dash = el.dashed ? `${Math.max(el.strokeWidth * 3, 6)} ${Math.max(el.strokeWidth * 2, 4)}` : undefined
  return (
    <g opacity={el.opacity}>
      <line
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        stroke={el.stroke}
        strokeWidth={el.strokeWidth}
        strokeDasharray={dash}
        strokeLinecap="round"
        markerEnd="url(#arrow)"
      />
      {el.text && (
        <g>
          <rect x={mx - el.text.length * 3.6 - 6} y={my - 11} width={el.text.length * 7.2 + 12} height={22} rx={6} fill="#ffffff" stroke="#e2e8f0" />
          <text x={mx} y={my} fontSize={12} fill="#334155" textAnchor="middle" dominantBaseline="middle" style={{ userSelect: 'none', pointerEvents: 'none' }}>
            {el.text}
          </text>
        </g>
      )}
    </g>
  )
})
