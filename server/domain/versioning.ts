import { createHash } from 'node:crypto'
import type { DesignGraph, JsonValue } from './contracts'
import { deleteNode, moveNode } from './graph-operations'
import { GraphValidationError, validateDesignGraph } from './graph-validation'
import { serializeDesignGraph } from './serialization'
import type { DesignChangeOperation, ProposalValidation, SemanticChange, SemanticEntityType, VersionComparison } from './version-types'

export function hashDesignGraph(graph: DesignGraph): string {
  return createHash('sha256').update(serializeDesignGraph(graph)).digest('hex')
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(',')}}`
  }
  return JSON.stringify(value as JsonValue)
}

function collection(graph: DesignGraph, type: SemanticEntityType): { id: string; value: unknown }[] {
  switch (type) {
    case 'project': return [{ id: graph.project.id, value: graph.project }]
    case 'document': return [{ id: graph.document.id, value: graph.document }]
    case 'page': return [{ id: graph.page.id, value: graph.page }]
    case 'node': return graph.nodes.map((item) => ({ id: item.id, value: item }))
    case 'componentDefinition': return graph.componentDefinitions.map((item) => ({ id: item.id, value: item }))
    case 'componentInstance': return graph.componentInstances.map((item) => ({ id: item.id, value: item }))
    case 'token': return graph.tokens.map((item) => ({ id: item.id, value: item }))
    case 'typography': return graph.typography.map((item) => ({ id: item.id, value: item }))
    case 'asset': return graph.assets.map((item) => ({ id: item.id, value: item }))
    case 'intent': return graph.intents.map((item) => ({ id: item.id, value: item }))
  }
}

export function compareDesignGraphs(from: DesignGraph, to: DesignGraph, fromVersionId: string, toVersionId: string): VersionComparison {
  validateDesignGraph(from)
  validateDesignGraph(to)
  const changes: SemanticChange[] = []
  const types: SemanticEntityType[] = ['project', 'document', 'page', 'node', 'componentDefinition', 'componentInstance', 'token', 'typography', 'asset', 'intent']
  for (const entityType of types) {
    const before = new Map(collection(from, entityType).map((item) => [item.id, stable(item.value)]))
    const after = new Map(collection(to, entityType).map((item) => [item.id, stable(item.value)]))
    for (const id of [...new Set([...before.keys(), ...after.keys()])].sort()) {
      if (!before.has(id)) changes.push({ entityType, entityId: id, kind: 'added' })
      else if (!after.has(id)) changes.push({ entityType, entityId: id, kind: 'removed' })
      else if (before.get(id) !== after.get(id)) changes.push({ entityType, entityId: id, kind: 'updated' })
    }
  }
  const fromHash = hashDesignGraph(from)
  const toHash = hashDesignGraph(to)
  return { fromVersionId, toVersionId, fromHash, toHash, equivalent: fromHash === toHash, changes }
}

export function applyDesignChangeOperations(graph: DesignGraph, operations: readonly DesignChangeOperation[]): DesignGraph {
  let next = structuredClone(graph)
  for (const operation of operations) {
    next = operation.type === 'moveNode'
      ? moveNode(next, operation.nodeId, operation.parentId, operation.orderIndex)
      : deleteNode(next, operation.nodeId)
  }
  validateDesignGraph(next)
  return next
}

export function validateProposalOperations(graph: DesignGraph, operations: readonly DesignChangeOperation[]): ProposalValidation {
  try {
    applyDesignChangeOperations(graph, operations)
    return { valid: true, issues: [] }
  } catch (error) {
    if (error instanceof GraphValidationError) return { valid: false, issues: error.issues }
    return { valid: false, issues: [{ code: 'INVALID_OPERATION', path: 'operations', message: error instanceof Error ? error.message : 'Proposal operation is invalid.' }] }
  }
}
