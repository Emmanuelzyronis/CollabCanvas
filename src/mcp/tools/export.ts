import type { CanvasStore } from '../../store/store'
import { asBool, asStrArr, err, ok, okJson } from '../helpers'
import { elementsToSvg } from '../svg'
import type { ToolDef } from './create'

type Store = () => CanvasStore

/** Resolve which elements to export: given ids (order-preserving) or the whole board. */
function pickElements(store: CanvasStore, ids: string[]) {
  const all = store.getElements()
  if (ids.length === 0) return all
  const wanted = new Set(store.expandGroups(ids))
  return all.filter((el) => wanted.has(el.id))
}

/** Trigger a browser download of a blob (best-effort; no-op outside a document). */
function downloadBlob(blob: Blob, filename: string): boolean {
  if (typeof document === 'undefined') return false
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}

export function exportTools(getStore: Store): ToolDef[] {
  return [
    {
      name: 'export_svg',
      description:
        'Export the board (or a subset by id) as a standalone SVG document. Returns the SVG markup as text; also downloads a .svg file in the browser.',
      inputSchema: {
        type: 'object',
        properties: {
          ids: { type: 'array', items: { type: 'string' }, description: 'Optional subset; omit for whole board' },
          download: { type: 'boolean', description: 'Also trigger a file download (default true)' },
        },
      },
      annotations: { readOnlyHint: true },
      execute: (a) => {
        const store = getStore()
        const els = pickElements(store, asStrArr(a.ids))
        if (els.length === 0) return err('Nothing to export.')
        const { svg, width, height } = elementsToSvg(els)
        if (asBool(a.download, true)) downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'collabcanvas.svg')
        store.logActivity('agent', 'export', `Exported ${els.length} element(s) to SVG`, [])
        return ok(`Exported ${els.length} element(s) as SVG (${Math.round(width)}×${Math.round(height)}).\n\n\`\`\`svg\n${svg}\n\`\`\``)
      },
    },
    {
      name: 'export_png',
      description:
        'Export the board (or a subset by id) as a PNG image and download it in the browser. Returns the pixel dimensions. Rendering happens client-side from the SVG.',
      inputSchema: {
        type: 'object',
        properties: {
          ids: { type: 'array', items: { type: 'string' } },
          scale: { type: 'number', description: 'Pixel density multiplier (default 2)' },
        },
      },
      annotations: { readOnlyHint: true },
      execute: async (a) => {
        const store = getStore()
        const els = pickElements(store, asStrArr(a.ids))
        if (els.length === 0) return err('Nothing to export.')
        if (typeof document === 'undefined' || typeof Image === 'undefined') return err('PNG export needs a browser environment.')
        const scale = typeof a.scale === 'number' && a.scale > 0 ? a.scale : 2
        const { svg, width, height } = elementsToSvg(els)
        try {
          const blob = await svgToPng(svg, width, height, scale)
          downloadBlob(blob, 'collabcanvas.png')
          store.logActivity('agent', 'export', `Exported ${els.length} element(s) to PNG`, [])
          return ok(`Exported ${els.length} element(s) as PNG (${Math.round(width * scale)}×${Math.round(height * scale)}px). Download started.`)
        } catch (e) {
          return err(`PNG render failed: ${(e as Error).message}`)
        }
      },
    },
    {
      name: 'export_json',
      description:
        'Export the board as a structured JSON snapshot (elements, draw order, comments). This is the canonical, reload-able board format. Returns the JSON.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: () => {
        const store = getStore()
        const snap = store.getSnapshot()
        store.logActivity('agent', 'export', `Exported board JSON (${snap.order.length} elements)`, [])
        return okJson(`Board snapshot: ${snap.order.length} element(s), ${snap.comments.length} comment(s).`, snap)
      },
    },
  ]
}

/** Rasterize an SVG string to a PNG Blob via an offscreen canvas. */
function svgToPng(svg: string, width: number, height: number, scale: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(width * scale))
      canvas.height = Math.max(1, Math.round(height * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('no 2d context'))
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))), 'image/png')
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image load failed'))
    }
    img.src = url
  })
}
