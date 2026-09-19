import type { DesignGraph } from '../../../server/domain/contracts'
import { projectDesignGraph, type DeepReadonly, type DesignGraphProjection } from '../../graph/graphProjection'
import type { GraphAvailability, WorkspaceIdentifiers } from '../../workspace/WorkspaceContext'

export type IntelligenceTrustState = 'TRUSTED' | 'GRAPH_LOADING' | 'GRAPH_UNAVAILABLE' | 'GRAPH_INVALID'

export interface IntelligenceContext {
  readonly state: IntelligenceTrustState
  readonly scope: WorkspaceIdentifiers
  readonly graph: DeepReadonly<DesignGraph> | null
  readonly projection: DeepReadonly<DesignGraphProjection> | null
  readonly selectedNodeIds: readonly string[]
  readonly nodeRelationships: Readonly<Record<string, { parentId: string | null; childIds: readonly string[] }>>
  readonly error?: string
}

function stateFor(availability: GraphAvailability, graph: DesignGraph | null): IntelligenceTrustState {
  if (availability === 'GRAPH_AVAILABLE' && graph) return 'TRUSTED'
  if (availability === 'GRAPH_LOADING') return 'GRAPH_LOADING'
  if (availability === 'GRAPH_INVALID') return 'GRAPH_INVALID'
  return 'GRAPH_UNAVAILABLE'
}

/**
 * Build the only context intelligence/agent-facing UI may consume.
 * Invalid, missing, or out-of-scope graphs produce no graph context.
 */
export function buildIntelligenceContext(input: {
  readonly availability: GraphAvailability
  readonly identifiers: WorkspaceIdentifiers
  readonly graph: DesignGraph | null
  readonly selectedNodeIds?: readonly string[]
  readonly error?: string
}): IntelligenceContext {
  const state = stateFor(input.availability, input.graph)
  if (state !== 'TRUSTED' || !input.graph) {
    return { state, scope: input.identifiers, graph: null, projection: null, selectedNodeIds: [], nodeRelationships: {}, ...(input.error ? { error: input.error } : {}) }
  }

  if (input.graph.project.id !== input.identifiers.projectId || input.graph.document.id !== input.identifiers.documentId || input.graph.page.id !== input.identifiers.pageId) {
    return { state: 'GRAPH_INVALID', scope: input.identifiers, graph: null, projection: null, selectedNodeIds: [], nodeRelationships: {}, error: 'The canonical graph does not match the requested project, document, and page.' }
  }

  try {
    const projection = projectDesignGraph(input.graph, input.selectedNodeIds ?? [])
    const nodeRelationships: Record<string, { parentId: string | null; childIds: readonly string[] }> = {}
    for (const node of Object.values(projection.nodes)) nodeRelationships[node.id] = { parentId: node.parentId, childIds: node.childIds }
    return {
      state: 'TRUSTED',
      scope: input.identifiers,
      graph: input.graph,
      projection,
      selectedNodeIds: projection.selection.selectedIds,
      nodeRelationships: Object.freeze(nodeRelationships),
    }
  } catch (error) {
    return { state: 'GRAPH_INVALID', scope: input.identifiers, graph: null, projection: null, selectedNodeIds: [], nodeRelationships: {}, error: error instanceof Error ? error.message : 'The canonical Design Graph failed validation.' }
  }
}

export function canUseIntelligence(context: IntelligenceContext): context is IntelligenceContext & { readonly state: 'TRUSTED'; readonly graph: DeepReadonly<DesignGraph>; readonly projection: DeepReadonly<DesignGraphProjection> } {
  return context.state === 'TRUSTED' && context.graph !== null && context.projection !== null
}
