import type { DesignGraph } from '../domain/contracts.js'
import type { DesignGraphRepository, DesignGraphWriter } from './repository.js'

/** Test/development graph source; not a substitute for production persistence. */
export class MemoryDesignGraphRepository implements DesignGraphRepository, DesignGraphWriter {
  private readonly graphs = new Map<string, DesignGraph>()

  constructor(graphs: DesignGraph[] = []) {
    for (const graph of graphs) this.graphs.set(graph.document.id, structuredClone(graph))
  }

  register(graph: DesignGraph): void {
    this.graphs.set(graph.document.id, structuredClone(graph))
  }

  async getDesignGraph(documentId: string): Promise<DesignGraph | null> {
    const graph = this.graphs.get(documentId)
    return graph ? structuredClone(graph) : null
  }

  async saveDesignGraph(graph: DesignGraph): Promise<DesignGraph> {
    const stored = structuredClone(graph)
    this.graphs.set(graph.document.id, stored)
    return structuredClone(stored)
  }
}
