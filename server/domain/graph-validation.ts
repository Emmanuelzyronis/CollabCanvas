import type { DesignGraph, DesignNode } from './contracts.js'
import { NODE_TYPES, type NodeType } from './graph-types.js'

export type GraphValidationCode =
  | 'DUPLICATE_ID'
  | 'INVALID_NODE_TYPE'
  | 'INVALID_PAGE_REFERENCE'
  | 'DANGLING_PARENT'
  | 'CYCLE'
  | 'INVALID_ORDER'
  | 'INVALID_COMPONENT_REFERENCE'
  | 'INVALID_TOKEN_REFERENCE'
  | 'INVALID_TYPOGRAPHY_REFERENCE'
  | 'INVALID_ASSET_REFERENCE'
  | 'INVALID_INTENT_REFERENCE'

export interface GraphValidationIssue {
  code: GraphValidationCode
  path: string
  message: string
}

export class GraphValidationError extends Error {
  constructor(public readonly issues: GraphValidationIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '))
    this.name = 'GraphValidationError'
  }
}

export function validateDesignGraph(graph: DesignGraph): void {
  const issues: GraphValidationIssue[] = []
  const ids = new Map<string, string>()
  const addId = (id: string, path: string) => {
    const previous = ids.get(id)
    if (previous) issues.push({ code: 'DUPLICATE_ID', path, message: `ID is already used at ${previous}.` })
    else ids.set(id, path)
  }

  addId(graph.page.id, 'page.id')
  for (const node of graph.nodes) addId(node.id, `nodes.${node.id}.id`)
  for (const definition of graph.componentDefinitions) addId(definition.id, `componentDefinitions.${definition.id}.id`)
  for (const instance of graph.componentInstances) addId(instance.id, `componentInstances.${instance.id}.id`)
  for (const token of graph.tokens) addId(token.id, `tokens.${token.id}.id`)
  for (const typography of graph.typography) addId(typography.id, `typography.${typography.id}.id`)
  for (const asset of graph.assets) addId(asset.id, `assets.${asset.id}.id`)
  for (const intent of graph.intents) addId(intent.id, `intents.${intent.id}.id`)

  const nodes = new Map<string, DesignNode>()
  for (const node of graph.nodes) {
    if (!NODE_TYPES.includes(node.type as NodeType)) {
      issues.push({ code: 'INVALID_NODE_TYPE', path: `nodes.${node.id}.type`, message: `Unknown node type "${node.type}".` })
    }
    if (node.pageId !== graph.page.id) {
      issues.push({ code: 'INVALID_PAGE_REFERENCE', path: `nodes.${node.id}.pageId`, message: 'Node belongs to a different page.' })
    }
    if (!Number.isInteger(node.orderIndex) || node.orderIndex < 0) {
      issues.push({ code: 'INVALID_ORDER', path: `nodes.${node.id}.orderIndex`, message: 'Order must be a non-negative integer.' })
    }
    nodes.set(node.id, node)
  }

  const siblings = new Map<string, Set<number>>()
  for (const node of graph.nodes) {
    if (node.parentId !== null && !nodes.has(node.parentId)) {
      issues.push({ code: 'DANGLING_PARENT', path: `nodes.${node.id}.parentId`, message: `Parent "${node.parentId}" does not exist on this page.` })
    }
    const key = node.parentId ?? '__root__'
    const order = siblings.get(key) ?? new Set<number>()
    if (order.has(node.orderIndex)) issues.push({ code: 'INVALID_ORDER', path: `nodes.${node.id}.orderIndex`, message: 'Sibling order indexes must be unique.' })
    order.add(node.orderIndex)
    siblings.set(key, order)
  }

  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (id: string) => {
    if (visiting.has(id)) {
      issues.push({ code: 'CYCLE', path: `nodes.${id}.parentId`, message: 'Node hierarchy contains a cycle.' })
      return
    }
    if (visited.has(id)) return
    visiting.add(id)
    const parentId = nodes.get(id)?.parentId
    if (parentId && nodes.has(parentId)) visit(parentId)
    visiting.delete(id)
    visited.add(id)
  }
  for (const node of graph.nodes) visit(node.id)

  const definitions = new Set(graph.componentDefinitions.map((definition) => definition.id))
  const instances = new Map(graph.componentInstances.map((instance) => [instance.id, instance]))
  const tokens = new Set(graph.tokens.map((token) => token.id))
  const typography = new Set(graph.typography.map((item) => item.id))
  const assets = new Set(graph.assets.map((asset) => asset.id))
  const intents = new Set(graph.intents.map((intent) => intent.id))
  const checkTokens = (refs: Record<string, string> | undefined, path: string) => {
    for (const [slot, tokenId] of Object.entries(refs ?? {})) {
      if (!tokens.has(tokenId)) issues.push({ code: 'INVALID_TOKEN_REFERENCE', path: `${path}.${slot}`, message: `Token "${tokenId}" does not exist.` })
    }
  }

  for (const node of graph.nodes) {
    checkTokens(node.tokenRefs, `nodes.${node.id}.tokenRefs`)
    if (node.typographyId && !typography.has(node.typographyId)) issues.push({ code: 'INVALID_TYPOGRAPHY_REFERENCE', path: `nodes.${node.id}.typographyId`, message: `Typography "${node.typographyId}" does not exist.` })
    if (node.assetRef && !assets.has(node.assetRef.id)) issues.push({ code: 'INVALID_ASSET_REFERENCE', path: `nodes.${node.id}.assetRef`, message: `Asset "${node.assetRef.id}" does not exist.` })
    if (node.componentInstanceId) {
      const instance = instances.get(node.componentInstanceId)
      if (!instance || instance.nodeId !== node.id) issues.push({ code: 'INVALID_COMPONENT_REFERENCE', path: `nodes.${node.id}.componentInstanceId`, message: 'Component instance reference is invalid.' })
    }
    for (const intentId of node.intentIds ?? []) if (!intents.has(intentId)) issues.push({ code: 'INVALID_INTENT_REFERENCE', path: `nodes.${node.id}.intentIds`, message: `Intent "${intentId}" does not exist.` })
  }
  for (const definition of graph.componentDefinitions) {
    checkTokens(definition.tokenRefs, `componentDefinitions.${definition.id}.tokenRefs`)
    for (const intentId of definition.intentIds ?? []) if (!intents.has(intentId)) issues.push({ code: 'INVALID_INTENT_REFERENCE', path: `componentDefinitions.${definition.id}.intentIds`, message: `Intent "${intentId}" does not exist.` })
  }
  for (const instance of graph.componentInstances) {
    if (!definitions.has(instance.definitionId)) issues.push({ code: 'INVALID_COMPONENT_REFERENCE', path: `componentInstances.${instance.id}.definitionId`, message: `Component definition "${instance.definitionId}" does not exist.` })
    const node = nodes.get(instance.nodeId)
    if (!node || node.componentInstanceId !== instance.id || node.type !== 'component-instance') issues.push({ code: 'INVALID_COMPONENT_REFERENCE', path: `componentInstances.${instance.id}.nodeId`, message: 'Instance must reference a component-instance node.' })
  }
  for (const intent of graph.intents) {
    const validTarget = intent.targetType === 'page' ? intent.targetId === graph.page.id
      : intent.targetType === 'node' ? nodes.has(intent.targetId)
        : intent.targetType === 'component' ? definitions.has(intent.targetId)
          : true
    if (!validTarget) issues.push({ code: 'INVALID_INTENT_REFERENCE', path: `intents.${intent.id}.targetId`, message: 'Intent target does not exist in this graph.' })
  }

  if (issues.length) throw new GraphValidationError(issues)
}
