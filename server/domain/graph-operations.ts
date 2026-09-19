import type {
  ComponentDefinition,
  ComponentInstance,
  DesignGraph,
  DesignIntent,
  DesignNode,
  DesignToken,
} from './contracts.js'
import { GraphValidationError, validateDesignGraph } from './graph-validation.js'

function copy(graph: DesignGraph): DesignGraph {
  return structuredClone(graph)
}

function assertNode(graph: DesignGraph, id: string): DesignNode {
  const node = graph.nodes.find((candidate) => candidate.id === id)
  if (!node) throw new GraphValidationError([{ code: 'INVALID_PAGE_REFERENCE', path: `nodes.${id}`, message: 'Node does not exist.' }])
  return node
}

function normalizeSiblings(nodes: DesignNode[], parentId: string | null): void {
  nodes
    .filter((node) => node.parentId === parentId)
    .sort((a, b) => a.orderIndex - b.orderIndex || a.id.localeCompare(b.id))
    .forEach((node, index) => { node.orderIndex = index })
}

function validateResult(graph: DesignGraph): DesignGraph {
  validateDesignGraph(graph)
  return graph
}

export function createNode(graph: DesignGraph, node: DesignNode): DesignGraph {
  const next = copy(graph)
  next.nodes.push(node)
  normalizeSiblings(next.nodes, node.parentId)
  return validateResult(next)
}

export function updateNode(graph: DesignGraph, id: string, patch: Partial<Omit<DesignNode, 'id' | 'pageId'>>): DesignGraph {
  const next = copy(graph)
  const node = assertNode(next, id)
  Object.assign(node, patch, { id, pageId: graph.page.id })
  return validateResult(next)
}

export function deleteNode(graph: DesignGraph, id: string): DesignGraph {
  const next = copy(graph)
  assertNode(next, id)
  const remove = new Set<string>([id])
  let changed = true
  while (changed) {
    changed = false
    for (const node of next.nodes) if (node.parentId && remove.has(node.parentId) && !remove.has(node.id)) { remove.add(node.id); changed = true }
  }
  next.nodes = next.nodes.filter((node) => !remove.has(node.id))
  next.componentInstances = next.componentInstances.filter((instance) => !remove.has(instance.nodeId))
  return validateResult(next)
}

export function moveNode(graph: DesignGraph, id: string, parentId: string | null, orderIndex?: number): DesignGraph {
  const next = copy(graph)
  const node = assertNode(next, id)
  if (parentId === id) throw new GraphValidationError([{ code: 'CYCLE', path: `nodes.${id}.parentId`, message: 'A node cannot be its own parent.' }])
  if (parentId) {
    const parent = assertNode(next, parentId)
    let cursor: DesignNode | undefined = parent
    while (cursor) {
      const ancestorId: string | null = cursor.parentId
      if (!ancestorId) break
      if (ancestorId === id) throw new GraphValidationError([{ code: 'CYCLE', path: `nodes.${id}.parentId`, message: 'Moving the node would create a cycle.' }])
      cursor = next.nodes.find((candidate) => candidate.id === ancestorId)
    }
  }
  const oldParent = node.parentId
  node.parentId = parentId
  node.orderIndex = orderIndex ?? next.nodes.filter((candidate) => candidate.parentId === parentId && candidate.id !== id).length
  normalizeSiblings(next.nodes, oldParent)
  normalizeSiblings(next.nodes, parentId)
  return validateResult(next)
}

export function reorderNode(graph: DesignGraph, id: string, orderIndex: number): DesignGraph {
  if (!Number.isInteger(orderIndex) || orderIndex < 0) throw new GraphValidationError([{ code: 'INVALID_ORDER', path: `nodes.${id}.orderIndex`, message: 'Order must be a non-negative integer.' }])
  const node = assertNode(graph, id)
  return moveNode(graph, id, node.parentId, orderIndex)
}

export const attachChild = moveNode
export function detachChild(graph: DesignGraph, id: string, orderIndex?: number): DesignGraph { return moveNode(graph, id, null, orderIndex) }

/**
 * Duplicates a node and its full descendant subtree. Identity is remapped
 * with the provided id factory; component instances owned by the subtree are
 * cloned so the graph remains valid.
 */
export function duplicateNode(graph: DesignGraph, id: string, nextId: (sourceId: string) => string): DesignGraph {
  const next = copy(graph)
  assertNode(next, id)

  const childrenByParent = new Map<string | null, DesignNode[]>()
  for (const node of next.nodes) {
    const key = node.parentId ?? null
    const group = childrenByParent.get(key) ?? []
    group.push(node)
    childrenByParent.set(key, group)
  }

  const remap = new Map<string, string>()
  const clones: DesignNode[] = []
  const cloneInstances: ComponentInstance[] = []
  const instanceRemap = new Map<string, string>()

  const duplicate = (nodeId: string, parentId: string | null, orderIndex: number): void => {
    const source = next.nodes.find((candidate) => candidate.id === nodeId)
    if (!source) return
    const cloneId = nextId(source.id)
    remap.set(source.id, cloneId)
    if (source.componentInstanceId) {
      const instance = next.componentInstances.find((candidate) => candidate.nodeId === source.id)
      if (instance) {
        const instanceCloneId = nextId(instance.id)
        instanceRemap.set(instance.id, instanceCloneId)
        cloneInstances.push({ ...structuredClone(instance), id: instanceCloneId, nodeId: cloneId })
      }
    }
    const clone: DesignNode = {
      ...structuredClone(source),
      id: cloneId,
      parentId,
      orderIndex,
      name: `${source.name} copy`,
    }
    clones.push(clone)
    ;(childrenByParent.get(source.id) ?? []).slice().sort((a, b) => a.orderIndex - b.orderIndex || a.id.localeCompare(b.id)).forEach((child, index) => duplicate(child.id, cloneId, index))
  }

  const parentId = next.nodes.find((candidate) => candidate.id === id)?.parentId ?? null
  const siblingCount = (childrenByParent.get(parentId) ?? []).filter((candidate) => candidate.id !== id).length
  duplicate(id, parentId, siblingCount)

  for (const clone of clones) {
    if (clone.componentInstanceId) clone.componentInstanceId = instanceRemap.get(clone.componentInstanceId) ?? clone.componentInstanceId
  }
  next.nodes.push(...clones)
  next.componentInstances.push(...cloneInstances)
  normalizeSiblings(next.nodes, parentId)
  return validateResult(next)
}

export function createComponentDefinition(graph: DesignGraph, definition: ComponentDefinition): DesignGraph {
  const next = copy(graph)
  next.componentDefinitions.push(definition)
  return validateResult(next)
}

export function createComponentInstance(graph: DesignGraph, instance: ComponentInstance): DesignGraph {
  const next = copy(graph)
  const node = assertNode(next, instance.nodeId)
  node.componentInstanceId = instance.id
  next.componentInstances.push(instance)
  return validateResult(next)
}

export function updateToken(graph: DesignGraph, id: string, patch: Partial<Omit<DesignToken, 'id'>>): DesignGraph {
  const next = copy(graph)
  const token = next.tokens.find((candidate) => candidate.id === id)
  if (!token) throw new GraphValidationError([{ code: 'INVALID_TOKEN_REFERENCE', path: `tokens.${id}`, message: 'Token does not exist.' }])
  Object.assign(token, patch, { id })
  return validateResult(next)
}

export function attachIntent(graph: DesignGraph, intent: DesignIntent): DesignGraph {
  const next = copy(graph)
  next.intents.push(intent)
  return validateResult(next)
}
