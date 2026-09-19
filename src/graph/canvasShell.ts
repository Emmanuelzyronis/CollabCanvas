import type { CanvasElement } from '../types'
import type { DesignGraph } from '../../server/domain/contracts'
import type { CanvasProjection } from './canvasProjection'
import { graphToCanvasProjection } from './canvasProjection'
import type { DeepReadonly, DesignGraphProjection, ProjectedNodeMetadata, SelectionProjection } from './graphProjection'
import { projectDesignGraph } from './graphProjection'

export interface CanvasShellGeometry {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * Read-only integration model for the existing SVG runtime.
 *
 * Graph structure and metadata come from B8. CanvasElement remains a renderer
 * adapter only; it does not establish identity, hierarchy, or ordering.
 */
export interface CanvasShellNode {
  readonly id: string
  readonly type: ProjectedNodeMetadata['type']
  readonly renderIndex: number
  readonly orderIndex: number
  readonly parentId: string | null
  readonly metadata: DeepReadonly<ProjectedNodeMetadata>
  readonly geometry: CanvasShellGeometry
  readonly rendererElement: DeepReadonly<CanvasElement>
}

export interface CanvasShellModel {
  readonly identity: DeepReadonly<DesignGraphProjection['identity']>
  readonly selection: DeepReadonly<SelectionProjection>
  readonly nodeOrder: readonly string[]
  readonly nodes: readonly CanvasShellNode[]
  readonly elements: readonly DeepReadonly<CanvasElement>[]
  readonly unsupportedNodeIds: readonly string[]
}

function geometryOf(element: CanvasElement): CanvasShellGeometry {
  return { x: element.x, y: element.y, width: element.width, height: element.height }
}

function freezeDeep<T>(value: T): DeepReadonly<T> {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value as DeepReadonly<T>
  for (const nested of Object.values(value as Record<string, unknown>)) freezeDeep(nested)
  return Object.freeze(value) as DeepReadonly<T>
}

/**
 * Join B8's canonical projection to the temporary renderer projection.
 * No graph traversal or persistent state is performed here.
 */
export function createCanvasShellModel(
  projection: DeepReadonly<DesignGraphProjection>,
  renderer: CanvasProjection,
): DeepReadonly<CanvasShellModel> {
  const rendererById = new Map(renderer.elements.map((element) => [element.id, element]))
  const rendererOrder = renderer.elements.map((element) => element.id)

  const hasCanonicalOrder = renderer.order.length === projection.nodeOrder.length
    && renderer.order.every((id, index) => id === projection.nodeOrder[index])
  const elementsHaveCanonicalOrder = rendererOrder.length === projection.nodeOrder.length
    && rendererOrder.every((id, index) => id === projection.nodeOrder[index])
  if (!hasCanonicalOrder || !elementsHaveCanonicalOrder) {
    throw new Error('Canvas renderer projection does not match canonical graph order.')
  }

  const nodes = projection.nodeOrder.map((id, renderIndex) => {
    const metadata = projection.nodes[id]
    const rendererElement = rendererById.get(id)
    if (!metadata || !rendererElement) throw new Error(`Canvas renderer projection is missing graph node "${id}".`)
    const detachedRendererElement = structuredClone(rendererElement)
    return {
      id,
      type: metadata.type,
      renderIndex,
      orderIndex: metadata.orderIndex,
      parentId: metadata.parentId,
      metadata,
      geometry: geometryOf(detachedRendererElement),
      rendererElement: detachedRendererElement,
    }
  })

  return freezeDeep({
    identity: projection.identity,
    selection: projection.selection,
    nodeOrder: [...projection.nodeOrder],
    nodes,
    elements: nodes.map((node) => node.rendererElement),
    unsupportedNodeIds: [...renderer.unsupportedNodeIds],
  })
}

/** Project a canonical graph through B8 and into the B9 renderer boundary. */
export function graphToCanvasShell(graph: DesignGraph, selectedNodeIds: readonly string[] = []): DeepReadonly<CanvasShellModel> {
  const projection = projectDesignGraph(graph, selectedNodeIds)
  return createCanvasShellModel(projection, graphToCanvasProjection(graph, projection))
}
