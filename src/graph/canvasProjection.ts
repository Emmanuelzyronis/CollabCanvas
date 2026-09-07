import type { DesignGraph, DesignNode, JsonObject, LayoutConstraints } from '../../server/domain/contracts'
import { attachChild, createNode, deleteNode, moveNode, reorderNode, updateNode } from '../../server/domain/graph-operations'
import type { CanvasElement, ElementInput, ElementType } from '../types'
import { projectDesignGraph } from './graphProjection'

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
  | { type: 'move'; nodeId: string; parentId: string | null; orderIndex?: number }
  | { type: 'reorder'; nodeId: string; orderIndex: number }
  | { type: 'delete'; nodeId: string }
  | { type: 'group'; nodeId: string; parentId: string; orderIndex?: number }

export type GraphOperation = (graph: DesignGraph) => DesignGraph

function numeric(value: number | string | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function dimension(value: LayoutConstraints['width'] | LayoutConstraints['height'], fallback: number): number {
  return typeof value === 'number' ? numeric(value, fallback) : fallback
}

function geometry(node: DesignNode): Pick<CanvasElement, 'x' | 'y' | 'width' | 'height'> {
  return {
    x: numeric(node.layout.x, 0),
    y: numeric(node.layout.y, 0),
    width: dimension(node.layout.width, 140),
    height: dimension(node.layout.height, 90),
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

function textValue(node: DesignNode): string {
  const text = node.properties.text
  return typeof text === 'string' ? text : node.name
}

function stringProperty(properties: JsonObject, key: string, fallback: string): string {
  const value = properties[key]
  return typeof value === 'string' ? value : fallback
}

function toCanvasElement(node: DesignNode, parentIds: Set<string>): CanvasElement {
  const bounds = geometry(node)
  const semanticText = textValue(node)
  const style = node.properties.style
  const styleObject = style && typeof style === 'object' && !Array.isArray(style) ? style as JsonObject : {}
  return {
    id: node.id,
    type: canvasType(node),
    ...bounds,
    rotation: numeric(node.properties.rotation as number | undefined, 0),
    fill: stringProperty(styleObject, 'fill', '#ffffff'),
    stroke: stringProperty(styleObject, 'stroke', '#0f172a'),
    strokeWidth: numeric(styleObject.strokeWidth as number | undefined, 2),
    opacity: numeric(styleObject.opacity as number | undefined, 1),
    dashed: styleObject.dashed === true,
    text: semanticText,
    fontSize: numeric(node.properties.fontSize as number | undefined, 16),
    fontWeight: numeric(node.properties.fontWeight as number | undefined, 400),
    textColor: stringProperty(styleObject, 'textColor', '#0f172a'),
    textAlign: node.properties.textAlign === 'left' || node.properties.textAlign === 'right' ? node.properties.textAlign : 'center',
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
export function graphToCanvasProjection(graph: DesignGraph): CanvasProjection {
  const structure = projectDesignGraph(graph)
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const parentIds = new Set(graph.nodes.map((node) => node.id))
  const nodes = structure.nodeOrder.map((nodeId) => nodeById.get(nodeId)!)
  return {
    elements: nodes.map((node) => toCanvasElement(node, parentIds)),
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
