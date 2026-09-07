import type { DesignGraph } from '../../server/domain/contracts'
import type { Author } from '../types'
import { loadGraphIntoCanvas, type LoadCanvasSnapshot } from './canvasStoreAdapter'

export interface CanvasGraphApplicationClient {
  getDocumentGraph(documentId: string): Promise<DesignGraph>
  moveNode(documentId: string, nodeId: string, parentId: string | null, orderIndex?: number): Promise<DesignGraph>
  deleteNode(documentId: string, nodeId: string): Promise<DesignGraph>
}

/**
 * Thin editor adapter: application services own graph mutations; this class
 * only turns their returned canonical graph into the existing canvas snapshot.
 */
export class CanvasGraphController {
  private graph: DesignGraph | null = null

  constructor(
    private readonly application: CanvasGraphApplicationClient,
    private readonly loadSnapshot: LoadCanvasSnapshot,
  ) {}

  get currentGraph(): DesignGraph | null {
    return this.graph ? structuredClone(this.graph) : null
  }

  async load(documentId: string, author: Author = 'human'): Promise<DesignGraph> {
    return this.apply(await this.application.getDocumentGraph(documentId), author)
  }

  async moveNode(documentId: string, nodeId: string, parentId: string | null, orderIndex?: number, author: Author = 'human'): Promise<DesignGraph> {
    return this.apply(await this.application.moveNode(documentId, nodeId, parentId, orderIndex), author)
  }

  async deleteNode(documentId: string, nodeId: string, author: Author = 'human'): Promise<DesignGraph> {
    return this.apply(await this.application.deleteNode(documentId, nodeId), author)
  }

  private apply(graph: DesignGraph, author: Author): DesignGraph {
    this.graph = structuredClone(graph)
    loadGraphIntoCanvas(graph, this.loadSnapshot, author)
    return structuredClone(graph)
  }
}
