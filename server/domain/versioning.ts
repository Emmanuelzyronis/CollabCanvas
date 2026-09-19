import { createHash } from 'node:crypto'
import type { DesignGraph, DesignNode, JsonObject, JsonValue } from './contracts.js'
import { createNode, deleteNode, moveNode, updateNode } from './graph-operations.js'
import { GraphValidationError, validateDesignGraph } from './graph-validation.js'
import { serializeDesignGraph } from './serialization.js'
import type { DesignChangeOperation, ProposedNode, ProposalValidation, SemanticChange, SemanticEntityType, SemanticFieldChange, VersionComparison } from './version-types.js'

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

function fieldChanges(
  entityType: SemanticEntityType,
  entityId: string,
  before: unknown,
  after: unknown,
  path = '',
): SemanticFieldChange[] {
  if (stable(before) === stable(after)) return []
  if (before && after && typeof before === 'object' && typeof after === 'object' && !Array.isArray(before) && !Array.isArray(after)) {
    const beforeRecord = before as Record<string, unknown>
    const afterRecord = after as Record<string, unknown>
    return [...new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)])]
      .sort()
      .flatMap((key) => fieldChanges(entityType, entityId, beforeRecord[key], afterRecord[key], path ? `${path}.${key}` : key))
  }
  return [{
    entityType,
    entityId,
    kind: before === undefined ? 'added' : after === undefined ? 'removed' : 'updated',
    path: path || '$',
    ...(before === undefined ? {} : { before: structuredClone(before) }),
    ...(after === undefined ? {} : { after: structuredClone(after) }),
  }]
}

export function compareDesignGraphs(from: DesignGraph, to: DesignGraph, fromVersionId: string, toVersionId: string): VersionComparison {
  validateDesignGraph(from)
  validateDesignGraph(to)
  const changes: SemanticChange[] = []
  const fieldChangeList: SemanticFieldChange[] = []
  const types: SemanticEntityType[] = ['project', 'document', 'page', 'node', 'componentDefinition', 'componentInstance', 'token', 'typography', 'asset', 'intent']
  for (const entityType of types) {
    const before = new Map(collection(from, entityType).map((item) => [item.id, stable(item.value)]))
    const after = new Map(collection(to, entityType).map((item) => [item.id, stable(item.value)]))
    const beforeValues = new Map(collection(from, entityType).map((item) => [item.id, item.value]))
    const afterValues = new Map(collection(to, entityType).map((item) => [item.id, item.value]))
    for (const id of [...new Set([...before.keys(), ...after.keys()])].sort()) {
      if (!before.has(id)) changes.push({ entityType, entityId: id, kind: 'added' })
      else if (!after.has(id)) changes.push({ entityType, entityId: id, kind: 'removed' })
      else if (before.get(id) !== after.get(id)) changes.push({ entityType, entityId: id, kind: 'updated' })
      fieldChangeList.push(...fieldChanges(entityType, id, beforeValues.get(id), afterValues.get(id)))
    }
  }
  const fromHash = hashDesignGraph(from)
  const toHash = hashDesignGraph(to)
  return { fromVersionId, toVersionId, fromHash, toHash, equivalent: fromHash === toHash, changes, fieldChanges: fieldChangeList }
}

export interface ProposalApplyOptions {
  /** Mints canonical identity for created nodes. Defaults to a collision-free local id. */
  mintNodeId?: (graph: DesignGraph) => string
  /** Defaults to the wall clock; proposals do not carry timestamps of their own. */
  now?: () => string
}

function localNodeId(graph: DesignGraph): string {
  const taken = new Set(graph.nodes.map((node) => node.id))
  let index = 1
  while (taken.has(`node_${index}`)) index += 1
  return `node_${index}`
}

/** Shallow JSON merge that also merges a nested `style` object one level deep. */
function mergeProperties(base: JsonObject, patch: JsonObject): JsonObject {
  const merged: JsonObject = { ...base, ...patch }
  const baseStyle = base.style
  const patchStyle = patch.style
  if (
    baseStyle && patchStyle &&
    typeof baseStyle === 'object' && !Array.isArray(baseStyle) &&
    typeof patchStyle === 'object' && !Array.isArray(patchStyle)
  ) {
    merged.style = { ...(baseStyle as JsonObject), ...(patchStyle as JsonObject) }
  }
  return merged
}

function nodeFromOperation(
  graph: DesignGraph,
  operation: ProposedNode,
  id: string,
  parentId: string | null,
  now: string,
): DesignNode {
  const spec = operation.node
  const siblingCount = graph.nodes.filter((node) => node.parentId === parentId).length
  return {
    id,
    pageId: graph.page.id,
    parentId,
    type: spec.type,
    name: spec.name,
    orderIndex: operation.orderIndex ?? siblingCount,
    semantic: spec.semantic ?? {},
    properties: spec.properties ?? {},
    layout: spec.layout ?? {},
    ...(spec.tokenRefs ? { tokenRefs: spec.tokenRefs } : {}),
    ...(spec.typographyId ? { typographyId: spec.typographyId } : {}),
    ...(spec.responsive ? { responsive: spec.responsive } : {}),
    ...(spec.interactions ? { interactions: spec.interactions } : {}),
    ...(spec.states ? { states: spec.states } : {}),
    ...(spec.accessibility ? { accessibility: spec.accessibility } : {}),
    ...(spec.assetRef ? { assetRef: spec.assetRef } : {}),
    ...(spec.componentInstanceId ? { componentInstanceId: spec.componentInstanceId } : {}),
    ...(spec.intentIds ? { intentIds: spec.intentIds } : {}),
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Apply a plan to a graph. Operations execute in order, so a create may use the
 * key of an earlier create in the same plan as its parent.
 */
export function applyDesignChangeOperations(graph: DesignGraph, operations: readonly DesignChangeOperation[], options: ProposalApplyOptions = {}): DesignGraph {
  const mintNodeId = options.mintNodeId ?? localNodeId
  const now = options.now ?? (() => new Date().toISOString())
  const createdKeys = new Map<string, string>()
  let next = structuredClone(graph)
  for (const operation of operations) {
    if (operation.type === 'moveNode') {
      next = moveNode(next, operation.nodeId, operation.parentId, operation.orderIndex)
      continue
    }
    if (operation.type === 'deleteNode') {
      next = deleteNode(next, operation.nodeId)
      continue
    }
    if (operation.type === 'updateNode') {
      // A refinement is partial by design: layout and properties merge over the
      // existing node so a proposal never has to restate state it is not changing.
      const existing = next.nodes.find((node) => node.id === operation.nodeId)
      if (!existing) {
        throw new GraphValidationError([{ code: 'DANGLING_PARENT', path: `operations.${operation.nodeId}`, message: `"${operation.nodeId}" does not exist in this design.` }])
      }
      const { layout, properties, ...rest } = operation.patch
      const merged = {
        ...rest,
        ...(layout ? { layout: { ...existing.layout, ...layout, ...(layout.padding ? { padding: { ...existing.layout.padding, ...layout.padding } } : {}) } } : {}),
        ...(properties ? { properties: mergeProperties(existing.properties, properties) } : {}),
      }
      next = updateNode(next, operation.nodeId, merged)
      continue
    }
    if (createdKeys.has(operation.key)) {
      throw new GraphValidationError([{ code: 'DUPLICATE_ID', path: `operations.${operation.key}`, message: `Two operations in this proposal both use the key "${operation.key}".` }])
    }
    let parentId: string | null = operation.parentId ?? null
    if (operation.parentKey !== undefined && operation.parentKey !== null) {
      const resolved = createdKeys.get(operation.parentKey)
      if (resolved === undefined) {
        throw new GraphValidationError([{ code: 'DANGLING_PARENT', path: `operations.${operation.key}`, message: `"${operation.key}" refers to a parent that does not exist in this proposal.` }])
      }
      parentId = resolved
    }
    const id = mintNodeId(next)
    next = createNode(next, nodeFromOperation(next, operation, id, parentId, now()))
    createdKeys.set(operation.key, id)
  }
  validateDesignGraph(next)
  return next
}

/**
 * The resources a plan touches, in stable order. A node that does not exist yet
 * cannot be an affected resource, so a creation is attributed to the parent it
 * lands in until the plan is applied.
 */
export function affectedResourceIds(operations: readonly DesignChangeOperation[]): string[] {
  const ids = new Set<string>()
  for (const operation of operations) {
    if (operation.type === 'deleteNode') { ids.add(operation.nodeId); continue }
    if (operation.type === 'moveNode') { ids.add(operation.nodeId); if (operation.parentId) ids.add(operation.parentId); continue }
    if (operation.type === 'updateNode') { ids.add(operation.nodeId); continue }
    if (operation.parentId) ids.add(operation.parentId)
  }
  return [...ids].sort()
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
