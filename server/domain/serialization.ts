import type { DesignGraph, DesignNode, JsonObject, JsonValue, PageGraph } from './contracts'

function sortKeys(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value === null || typeof value !== 'object') return value

  const output: JsonObject = {}
  for (const key of Object.keys(value).sort()) output[key] = sortKeys(value[key])
  return output
}

function nodeSort(a: DesignNode, b: DesignNode): number {
  const parent = (a.parentId ?? '').localeCompare(b.parentId ?? '')
  if (parent !== 0) return parent
  if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex
  return a.id.localeCompare(b.id)
}

/**
 * Serialize a page graph canonically. Object keys and node ordering are stable,
 * so equivalent graphs produce byte-for-byte identical JSON.
 */
export function serializePageGraph(graph: PageGraph): string {
  const normalized = {
    page: graph.page,
    nodes: [...graph.nodes].sort(nodeSort),
  }
  return JSON.stringify(sortKeys(normalized as unknown as JsonValue))
}

/** Serialize the complete graph contract while excluding transient editor state. */
export function serializeDesignGraph(graph: DesignGraph): string {
  const normalized = {
    project: graph.project,
    document: graph.document,
    page: graph.page,
    nodes: [...graph.nodes].sort(nodeSort),
    componentDefinitions: [...graph.componentDefinitions].sort((a, b) => a.id.localeCompare(b.id)),
    componentInstances: [...graph.componentInstances].sort((a, b) => a.id.localeCompare(b.id)),
    tokens: [...graph.tokens].sort((a, b) => a.id.localeCompare(b.id)),
    typography: [...graph.typography].sort((a, b) => a.id.localeCompare(b.id)),
    assets: [...graph.assets].sort((a, b) => a.id.localeCompare(b.id)),
    intents: [...graph.intents].sort((a, b) => a.id.localeCompare(b.id)),
  }
  return JSON.stringify(sortKeys(normalized as unknown as JsonValue))
}
