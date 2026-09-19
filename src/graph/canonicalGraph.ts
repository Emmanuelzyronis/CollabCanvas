import type { DesignGraph } from '../../server/domain/contracts'

/**
 * The canonical graph the workspace is currently editing.
 *
 * This is a publication point, not a store: the workspace owns the graph and
 * pushes the latest canonical snapshot here so non-React consumers (the WebMCP
 * tools) can read canonical design state instead of the runtime canvas
 * projection. It holds no mutation semantics and is never written from a tool.
 */

let current: DesignGraph | null = null

export function publishCanonicalGraph(graph: DesignGraph | null): void {
  current = graph ? structuredClone(graph) : null
}

/** The canonical graph, or null when no design is loaded. */
export function getCanonicalGraph(): DesignGraph | null {
  return current ? structuredClone(current) : null
}
