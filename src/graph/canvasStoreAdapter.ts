import type { Author, BoardSnapshot } from '../types'
import type { CanvasStore } from '../store/store'
import type { DesignGraph } from '../../server/domain/contracts'
import { graphToCanvasProjection, type CanvasProjection } from './canvasProjection'

export type LoadCanvasSnapshot = CanvasStore['loadSnapshot']

export function canvasProjectionToSnapshot(projection: CanvasProjection): BoardSnapshot {
  const elements = Object.fromEntries(projection.elements.map((element) => [element.id, element]))
  return { version: 1, elements, order: [...projection.order], comments: [] }
}

/** Apply a graph projection through the existing store lifecycle. */
export function loadGraphIntoCanvas(graph: DesignGraph, loadSnapshot: LoadCanvasSnapshot, author: Author = 'human'): CanvasProjection {
  const projection = graphToCanvasProjection(graph)
  loadSnapshot(canvasProjectionToSnapshot(projection), author)
  return projection
}
