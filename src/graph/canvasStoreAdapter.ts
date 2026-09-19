import type { Author, BoardSnapshot } from '../types'
import type { CanvasStore } from '../store/store'
import type { DesignGraph } from '../../server/domain/contracts'
import type { CanvasProjection } from './canvasProjection'
import { graphToCanvasShell, type CanvasShellModel } from './canvasShell'

export type LoadCanvasSnapshot = CanvasStore['loadSnapshot']

export function canvasProjectionToSnapshot(projection: CanvasProjection): BoardSnapshot {
  const elements = Object.fromEntries(projection.elements.map((element) => [element.id, element]))
  return { version: 1, elements, order: [...projection.order], comments: [] }
}

export function canvasShellToSnapshot(shell: CanvasShellModel): BoardSnapshot {
  const elements = Object.fromEntries(shell.elements.map((element) => [element.id, structuredClone(element)]))
  return { version: 1, elements, order: [...shell.nodeOrder], comments: [] }
}

/** Apply a graph projection through the existing store lifecycle. */
export function loadGraphIntoCanvas(graph: DesignGraph, loadSnapshot: LoadCanvasSnapshot, author: Author = 'human'): CanvasProjection {
  const shell = graphToCanvasShell(graph)
  loadSnapshot(canvasShellToSnapshot(shell), author, { record: false })
  return {
    elements: shell.elements.map((element) => structuredClone(element) as CanvasProjection['elements'][number]),
    order: [...shell.nodeOrder],
    unsupportedNodeIds: [...shell.unsupportedNodeIds],
  }
}
