import type { DesignGraph } from '../domain/contracts'
import { DomainError } from '../domain/errors'
import { deleteNode, moveNode } from '../domain/graph-operations'
import type { DesignGraphRepository, DesignGraphWriter, DesignRepository } from '../persistence/repository'

export interface CanvasMutationGuard {
  assertMutable(documentId: string): Promise<void>
  recordDraftGraph(graph: DesignGraph): Promise<void>
}

export interface CanvasGraphApplication {
  getDocumentGraph(documentId: string): Promise<DesignGraph>
  moveNode(documentId: string, nodeId: string, parentId: string | null, orderIndex?: number): Promise<DesignGraph>
  deleteNode(documentId: string, nodeId: string): Promise<DesignGraph>
}

type GraphStore = DesignGraphRepository & DesignGraphWriter

function requiredId(value: string, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new DomainError('VALIDATION_ERROR', `${field} must be a non-empty string.`)
  return value.trim()
}

/**
 * Application boundary for the first graph-backed canvas workflow.
 * The editor receives a graph, submits domain mutations, and only then
 * receives the updated graph for projection. It never writes storage itself.
 */
export class CanvasGraphApplicationService implements CanvasGraphApplication {
  constructor(
    private readonly resources: Pick<DesignRepository, 'getDocument'>,
    private readonly graphs: GraphStore,
    private readonly mutationGuard?: CanvasMutationGuard,
  ) {}

  async getDocumentGraph(documentId: string): Promise<DesignGraph> {
    const id = requiredId(documentId, 'documentId')
    const document = await this.resources.getDocument(id)
    if (!document) throw new DomainError('NOT_FOUND', `Design document "${id}" was not found.`)
    const graph = await this.graphs.getDesignGraph(id)
    if (!graph) throw new DomainError('GRAPH_UNAVAILABLE', `The canonical design graph for document "${id}" is unavailable.`)
    if (graph.document.id !== document.id || graph.document.projectId !== document.projectId) {
      throw new DomainError('GRAPH_UNAVAILABLE', 'The canonical design graph does not match the requested document.')
    }
    return graph
  }

  async moveNode(documentId: string, nodeId: string, parentId: string | null, orderIndex?: number): Promise<DesignGraph> {
    return this.mutate(documentId, (graph) => moveNode(graph, requiredId(nodeId, 'nodeId'), parentId, orderIndex))
  }

  async deleteNode(documentId: string, nodeId: string): Promise<DesignGraph> {
    return this.mutate(documentId, (graph) => deleteNode(graph, requiredId(nodeId, 'nodeId')))
  }

  private async mutate(documentId: string, operation: (graph: DesignGraph) => DesignGraph): Promise<DesignGraph> {
    await this.mutationGuard?.assertMutable(documentId)
    const current = await this.getDocumentGraph(documentId)
    const next = operation(current)
    const saved = await this.graphs.saveDesignGraph(next)
    await this.mutationGuard?.recordDraftGraph(saved)
    return saved
  }
}
