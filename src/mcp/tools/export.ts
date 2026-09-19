import type { CanvasStore } from '../../store/store'
import type { DesignGraph } from '../../../server/domain/contracts'
import { getCanonicalGraph } from '../../graph/canonicalGraph'
import { graphToCanvasProjection } from '../../graph/canvasProjection'
import { asBool, asStrArr, err, ok, okJson } from '../helpers'
import { elementsToSvg } from '../svg'
import type { ToolDef } from './create'

type Store = () => CanvasStore

/** Every node in the subtree of `ids` (a node always exports with its children). */
function withDescendants(graph: DesignGraph, ids: readonly string[]): Set<string> {
  const childrenOf = new Map<string, string[]>()
  for (const node of graph.nodes) {
    if (!node.parentId) continue
    const list = childrenOf.get(node.parentId)
    if (list) list.push(node.id)
    else childrenOf.set(node.parentId, [node.id])
  }
  const wanted = new Set<string>()
  const walk = (id: string) => {
    if (wanted.has(id)) return
    wanted.add(id)
    for (const child of childrenOf.get(id) ?? []) walk(child)
  }
  for (const id of ids) walk(id)
  return wanted
}

/**
 * Resolve which elements to export from the *canonical* design — the same
 * source of truth every other surface uses — rather than the runtime canvas
 * projection. Given ids export those subtrees; no ids export the whole design.
 */
function pickElements(graph: DesignGraph, ids: string[]) {
  const projection = graphToCanvasProjection(graph)
  if (ids.length === 0) return projection.elements
  const wanted = withDescendants(graph, ids)
  return projection.elements.filter((el) => wanted.has(el.id))
}

/** The canonical design, or a product-level explanation when none is loaded. */
function canonicalGraph(): DesignGraph | { error: string } {
  const graph = getCanonicalGraph()
  return graph ?? { error: 'No design is open. Open a design, then export it.' }
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
        const graph = canonicalGraph()
        if ('error' in graph) return err(graph.error)
        const store = getStore()
        const els = pickElements(graph, asStrArr(a.ids))
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
        const graph = canonicalGraph()
        if ('error' in graph) return err(graph.error)
        const store = getStore()
        const els = pickElements(graph, asStrArr(a.ids))
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
        'Export the canonical design as structured JSON (nodes, layout, tokens, components, intent). This is the design a coding agent should build from. Returns the JSON.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: () => {
        const graph = canonicalGraph()
        if ('error' in graph) return err(graph.error)
        const store = getStore()
        store.logActivity('agent', 'export', `Exported design JSON (${graph.nodes.length} nodes)`, [])
        return okJson(`Canonical design: ${graph.nodes.length} node(s), ${graph.tokens.length} token(s), ${graph.componentDefinitions.length} component definition(s).`, graph)
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
