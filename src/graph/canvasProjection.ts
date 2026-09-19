import type { DesignGraph, DesignNode, JsonObject, LayoutConstraints, NodeType } from '../../server/domain/contracts'
import { attachChild, createNode, deleteNode, moveNode, reorderNode, updateNode } from '../../server/domain/graph-operations'
import type { CanvasElement, ElementInput, ElementType } from '../types'
import { projectDesignGraph, type DesignGraphProjection } from './graphProjection'
import { resolveLayout, type ResolvedBox } from './layoutResolver'
import { resolveLineHeight } from './textMetrics'

/**
 * Temporary rendering projection for the existing SVG canvas.
 *
 * The graph is the input and remains canonical. CanvasElement is only the
 * shape the current Zustand/SVG implementation understands. Unsupported graph
 * metadata is intentionally retained on the graph and is not flattened here.
 */
export interface CanvasProjection {
  elements: CanvasElement[]
  order: string[]
  unsupportedNodeIds: string[]
}

export type CanvasOperation =
  | { type: 'create'; node: DesignNode }
  | { type: 'update'; nodeId: string; patch: Partial<Omit<DesignNode, 'id' | 'pageId'>> }
  | { type: 'resize'; nodeId: string; width: number; height: number }
  | { type: 'move'; nodeId: string; parentId: string | null; orderIndex?: number }
  | { type: 'reorder'; nodeId: string; orderIndex: number }
  | { type: 'delete'; nodeId: string }
  | { type: 'group'; nodeId: string; parentId: string; orderIndex?: number }

export type GraphOperation = (graph: DesignGraph) => DesignGraph

/** Canonical appearance fallbacks for a node type, shared by canvas and inspector. */
export interface CanvasAppearanceDefaults {
  fill: string
  stroke: string
  strokeWidth: number
  borderRadius: number
  opacity: number
  lineHeight: number
  textColor: string
}

export function defaultAppearance(type: DesignNode['type']): CanvasAppearanceDefaults {
  return {
    fill: type === 'heading' ? '#dbeafe' : type === 'button' ? '#2563eb' : type === 'component-instance' ? '#ecfdf5' : type === 'container' || type === 'section' ? '#f8fafc' : '#ffffff',
    stroke: type === 'heading' ? '#2563eb' : type === 'component-instance' ? '#059669' : '#64748b',
    strokeWidth: 2,
    borderRadius: type === 'button' || type === 'card' ? 12 : 8,
    opacity: 1,
    lineHeight: 1.25,
    textColor: '#0f172a',
  }
}

function numeric(value: number | string | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function dimension(value: LayoutConstraints['width'] | LayoutConstraints['height'], fallback: number): number {
  return typeof value === 'number' ? numeric(value, fallback) : fallback
}

/**
 * Absolute box for a node. Structural layout is resolved by `resolveLayout`;
 * this fallback only covers a node the resolver has not seen (which should not
 * happen) so the projection can never crash on an incomplete graph.
 */
function geometry(node: DesignNode, resolved: ResolvedBox | undefined, index: number, depth: number): Pick<CanvasElement, 'x' | 'y' | 'width' | 'height'> {
  if (resolved) return { x: resolved.x, y: resolved.y, width: resolved.width, height: resolved.height }
  const fallbackWidth = node.type === 'heading' ? 280 : node.type === 'container' || node.type === 'section' ? 320 : node.type === 'component-instance' ? 220 : 160
  const fallbackHeight = node.type === 'heading' ? 64 : node.type === 'container' || node.type === 'section' ? 120 : 88
  return {
    x: numeric(node.layout.x, depth * 360 + (index % 2) * 24),
    y: numeric(node.layout.y, index * 150),
    width: dimension(node.layout.width, fallbackWidth),
    height: dimension(node.layout.height, fallbackHeight),
  }
}

function canvasType(node: DesignNode): ElementType {
  switch (node.type) {
    case 'text':
    case 'heading':
      return 'text'
    case 'frame':
      return 'frame'
    case 'container':
    case 'section':
    case 'button':
    case 'input':
    case 'image':
    case 'icon':
    case 'list':
    case 'table':
    case 'card':
    case 'component-instance':
    case 'page':
      return 'rectangle'
  }
}

/**
 * Types whose canvas representation is a text label, so the layer name is the
 * best available content. Every other type only draws text it was given.
 */
const NAME_LABEL_TYPES: ReadonlySet<NodeType> = new Set<NodeType>(['text', 'heading', 'button', 'frame', 'component-instance'])

function textValue(node: DesignNode): string {
  const text = node.properties.text
  if (typeof text === 'string') return text
  return NAME_LABEL_TYPES.has(node.type) ? node.name : ''
}

function stringProperty(properties: JsonObject, key: string, fallback: string): string {
  const value = properties[key]
  return typeof value === 'string' ? value : fallback
}

function toCanvasElement(node: DesignNode, parentIds: Set<string>, resolved: ResolvedBox | undefined, index: number, depth: number): CanvasElement {
  const bounds = geometry(node, resolved, index, depth)
  const semanticText = textValue(node)
  const appearance = defaultAppearance(node.type)
  const style = node.properties.style
  const styleObject = style && typeof style === 'object' && !Array.isArray(style) ? style as JsonObject : {}
  const source = node.assetRef?.source
  const fontSize = numeric(node.properties.fontSize as number | undefined, 16)
  const assetWidth = numeric(node.assetRef?.width as number | undefined, 0)
  const assetHeight = numeric(node.assetRef?.height as number | undefined, 0)
  return {
    id: node.id,
    type: canvasType(node),
    ...bounds,
    rotation: numeric(node.properties.rotation as number | undefined, 0),
    fill: stringProperty(styleObject, 'fill', appearance.fill),
    stroke: stringProperty(styleObject, 'stroke', appearance.stroke),
    strokeWidth: numeric(styleObject.strokeWidth as number | undefined, appearance.strokeWidth),
    opacity: numeric(styleObject.opacity as number | undefined, appearance.opacity),
    dashed: styleObject.dashed === true,
    text: semanticText,
    fontSize,
    fontWeight: numeric(node.properties.fontWeight as number | undefined, 400),
    textColor: stringProperty(styleObject, 'textColor', appearance.textColor),
    textAlign: node.properties.textAlign === 'left' || node.properties.textAlign === 'right' ? node.properties.textAlign : 'center',
    fontFamily: stringProperty(styleObject, 'fontFamily', 'Inter, ui-sans-serif, system-ui, sans-serif'),
    lineHeight: resolveLineHeight(styleObject.lineHeight, fontSize),
    borderRadius: numeric(styleObject.borderRadius as number | undefined, appearance.borderRadius),
    ...(typeof source === 'string' && source.length > 0
      ? {
          imageSrc: source,
          ...(assetWidth > 0 && assetHeight > 0 ? { imageWidth: assetWidth, imageHeight: assetHeight } : {}),
        }
      : {}),
    from: null,
    to: null,
    groupId: node.parentId && parentIds.has(node.parentId) ? node.parentId : null,
    author: 'human',
    locked: false,
    createdAt: Date.parse(node.createdAt),
    updatedAt: Date.parse(node.updatedAt),
  }
}

/** Project a canonical graph into the existing flat canvas element model. */
export function graphToCanvasProjection(graph: DesignGraph, structure: Pick<DesignGraphProjection, 'nodeOrder'> = projectDesignGraph(graph)): CanvasProjection {
  const layout = resolveLayout(graph)
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const parentIds = new Set(graph.nodes.map((node) => node.id))
  const nodes = structure.nodeOrder.map((nodeId) => nodeById.get(nodeId)!)
  const depthById = new Map<string, number>()
  const depthOf = (node: DesignNode): number => {
    if (!node.parentId) return 0
    if (depthById.has(node.parentId)) return depthById.get(node.parentId)!
    const parent = nodeById.get(node.parentId)
    const depth = parent ? depthOf(parent) + 1 : 0
    depthById.set(node.id, depth)
    return depth
  }
  return {
    elements: nodes.map((node, index) => toCanvasElement(node, parentIds, layout.boxes.get(node.id), index, depthOf(node))),
    order: nodes.map((node) => node.id),
    unsupportedNodeIds: nodes.filter((node) => node.interactions?.length || node.responsive?.length || node.accessibility).map((node) => node.id),
  }
}

/**
 * Translate a canvas-originated editing intent into a domain operation. The
 * current canvas can continue to execute its Zustand mutation while callers
 * progressively adopt this adapter as the migration boundary.
 */
export function canvasOperationToGraphOperation(operation: CanvasOperation): GraphOperation {
  switch (operation.type) {
    case 'create':
      return (graph) => createNode(graph, operation.node)
    case 'update':
      return (graph) => updateNode(graph, operation.nodeId, operation.patch)
    case 'resize':
      return (graph) => updateNode(graph, operation.nodeId, { layout: { width: operation.width, height: operation.height } })
    case 'move':
      return (graph) => moveNode(graph, operation.nodeId, operation.parentId, operation.orderIndex)
    case 'reorder':
      return (graph) => reorderNode(graph, operation.nodeId, operation.orderIndex)
    case 'delete':
      return (graph) => deleteNode(graph, operation.nodeId)
    case 'group':
      return (graph) => attachChild(graph, operation.nodeId, operation.parentId, operation.orderIndex)
  }
}

/** Convenience helper for consumers that already have a projection input. */
export function canvasElementInputToNode(input: ElementInput, pageId: string, id: string, now: string, parentId: string | null = null): DesignNode {
  const type = input.type === 'text' ? 'text' : input.type === 'frame' ? 'frame' : 'container'
  return {
    id,
    pageId,
    parentId,
    type,
    name: input.text || `${type} node`,
    orderIndex: 0,
    semantic: {},
    properties: { text: input.text ?? '' },
    layout: { x: input.x ?? 0, y: input.y ?? 0, width: input.width ?? 140, height: input.height ?? 90 },
    createdAt: now,
    updatedAt: now,
  }
}
