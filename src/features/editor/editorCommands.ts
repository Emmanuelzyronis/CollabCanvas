import { nanoid } from 'nanoid'
import type { DesignGraph, JsonObject, LayoutConstraints } from '../../../server/domain/contracts'
import type { EditorToolKind } from './editorModel'
import { specFor } from './editorModel'

export interface InsertRect {
  x: number
  y: number
  width: number
  height: number
}

export type CreateNodePayload = {
  type: string
  name: string
  layout: { x: number; y: number; width: number; height: number }
  properties?: JsonObject
  semantic?: { role?: string }
  assetRef?: { id: string; kind: 'image'; name: string; source: string; altText?: string; width?: number; height?: number }
}

export const DEFAULT_IMAGE_SOURCE = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 800 520%22%3E%3Cdefs%3E%3ClinearGradient id=%22g%22 x1=%220%22 y1=%220%22 x2=%221%22 y2=%221%22%3E%3Cstop stop-color=%22%230f766e%22/%3E%3Cstop offset=%221%22 stop-color=%22%231e3a8a%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width=%22800%22 height=%22520%22 fill=%22url(%23g)%22/%3E%3Ccircle cx=%22620%22 cy=%22110%22 r=%2270%22 fill=%22%23fef3c7%22 opacity=%22.8%22/%3E%3Cpath d=%22M0 390 180 250 330 390 470 220 800 430V520H0Z%22 fill=%22%230f172a%22 opacity=%22.7%22/%3E%3C/svg%3E'

/** Intrinsic pixel dimensions of the bundled starter image. */
export const DEFAULT_IMAGE_SIZE = { width: 800, height: 520 } as const

/** Canonical graph asset reference for a newly inserted image node. */
export function imageAssetRef(
  source: string = DEFAULT_IMAGE_SOURCE,
  name = 'Image',
  size: { width?: number; height?: number } | null = source === DEFAULT_IMAGE_SOURCE ? DEFAULT_IMAGE_SIZE : null,
): NonNullable<CreateNodePayload['assetRef']> {
  return { id: `asset_${nanoid(10)}`, kind: 'image', name, source, ...(size?.width && size?.height ? { width: size.width, height: size.height } : {}) }
}

/** Keep only the selected nodes that are not descendants of another selected node. */
export function topLevelSelectedIds(graph: DesignGraph, ids: readonly string[]): string[] {
  const selected = new Set(ids)
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const hasSelectedAncestor = (nodeId: string): boolean => {
    let cursor = nodeById.get(nodeId)?.parentId ?? null
    while (cursor) {
      if (selected.has(cursor)) return true
      cursor = nodeById.get(cursor)?.parentId ?? null
    }
    return false
  }
  return ids.filter((id) => nodeById.has(id) && !hasSelectedAncestor(id))
}

/** A canonical update payload that moves one node to the given world position. */
export function positionLayoutPatch(graph: DesignGraph, nodeId: string, x: number, y: number): { nodeId: string; patch: { layout: LayoutConstraints } } | null {
  const node = graph.nodes.find((candidate) => candidate.id === nodeId)
  if (!node) return null
  // Moving an element by hand places it: the position becomes explicitly
  // absolute so a structural parent's flow cannot override the human's intent.
  const layout: LayoutConstraints = { ...(node.layout ?? {}), position: 'absolute', x, y }
  return { nodeId, patch: { layout } }
}

/** Canonical create payload for the human insert tools. */
export function createNodePayload(kind: EditorToolKind, rect: InsertRect): CreateNodePayload {
  const spec = specFor(kind)
  return {
    type: spec.nodeType,
    name: spec.name,
    layout: { x: Math.round(rect.x * 10) / 10, y: Math.round(rect.y * 10) / 10, width: Math.round(rect.width), height: Math.round(rect.height) },
    ...(spec.text ? { properties: { text: spec.text } } : {}),
    ...(kind === 'image' ? { properties: { style: { borderRadius: 14, stroke: '#ffffff', strokeWidth: 1, fill: '#e2e8f0' } }, assetRef: imageAssetRef() } : {}),
    ...(kind === 'heading' || kind === 'text' || kind === 'button'
      ? { semantic: { role: kind === 'heading' ? 'heading' : kind === 'button' ? 'button' : 'textbox' } }
      : kind === 'image' ? { semantic: { role: 'img' } } : {}),
  }
}
