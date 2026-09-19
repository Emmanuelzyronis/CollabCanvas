import type {
  ComponentDefinition,
  ComponentInstance,
  DesignGraph,
  DesignIntent,
  DesignNode,
  DesignToken,
  NodeType,
  TypographyDefinition,
} from '../../server/domain/contracts'
import {
  GraphValidationError,
  validateDesignGraph,
  type GraphValidationCode,
} from '../../server/domain/graph-validation'

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T

export type GraphProjectionIssueCode =
  | GraphValidationCode
  | 'MISSING_GRAPH_CONTEXT'
  | 'GRAPH_CONTEXT_MISMATCH'

export interface GraphProjectionIssue {
  readonly code: GraphProjectionIssueCode
  readonly path: string
  readonly message: string
}

export class GraphProjectionError extends Error {
  readonly code = 'INVALID_GRAPH' as const

  constructor(public readonly issues: readonly GraphProjectionIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '))
    this.name = 'GraphProjectionError'
  }
}

export interface GraphProjectionIdentity {
  readonly projectId: string
  readonly documentId: string
  readonly pageId: string
}

export interface ProjectedComponentReference {
  readonly instanceId: string
  readonly definitionId: string
  readonly definitionName: string
  readonly state: ComponentInstance['state'] | null
  readonly variant: DeepReadonly<NonNullable<ComponentInstance['variant']>> | null
}

export interface ProjectedNodeMetadata {
  readonly id: string
  readonly pageId: string
  readonly parentId: string | null
  readonly childIds: readonly string[]
  readonly orderIndex: number
  readonly type: NodeType
  readonly name: string
  readonly semanticRole: DesignNode['semantic']['role'] | null
  readonly accessibleName: string | null
  readonly component: ProjectedComponentReference | null
  readonly hasResponsiveConstraints: boolean
  readonly interactionCount: number
  readonly stateNames: readonly string[]
  readonly createdAt: string
  readonly updatedAt: string
}

export interface SelectionProjection {
  readonly requestedIds: readonly string[]
  readonly selectedIds: readonly string[]
  readonly missingNodeIds: readonly string[]
  readonly primaryNodeId: string | null
  readonly nodes: readonly ProjectedNodeMetadata[]
}

export interface LayerNodeProjection extends ProjectedNodeMetadata {
  readonly depth: number
  readonly path: readonly string[]
  readonly selected: boolean
  readonly selectionIndex: number | null
  readonly children: readonly LayerNodeProjection[]
}

export interface LayersProjection {
  readonly roots: readonly LayerNodeProjection[]
  readonly nodeOrder: readonly string[]
}

export interface ProjectedTokenReference {
  readonly slot: string
  readonly tokenId: string
  readonly token: DeepReadonly<DesignToken>
}

export interface InspectorNodeProjection {
  readonly metadata: ProjectedNodeMetadata
  readonly ancestry: readonly ProjectedNodeMetadata[]
  readonly semantic: DeepReadonly<DesignNode['semantic']>
  readonly properties: DeepReadonly<DesignNode['properties']>
  readonly layout: DeepReadonly<DesignNode['layout']>
  readonly tokenReferences: readonly ProjectedTokenReference[]
  readonly availableTokens: readonly DeepReadonly<DesignToken>[]
  readonly typography: DeepReadonly<TypographyDefinition> | null
  readonly responsive: DeepReadonly<NonNullable<DesignNode['responsive']>>
  readonly accessibility: DeepReadonly<DesignNode['accessibility']> | null
  readonly interactions: DeepReadonly<NonNullable<DesignNode['interactions']>>
  readonly states: DeepReadonly<NonNullable<DesignNode['states']>>
  readonly intents: readonly DeepReadonly<DesignIntent>[]
  readonly componentDefinition: DeepReadonly<ComponentDefinition> | null
  readonly asset: DeepReadonly<DesignNode['assetRef']> | null
}

export interface InspectorProjection {
  readonly mode: 'none' | 'single' | 'multiple'
  readonly count: number
  readonly primaryNodeId: string | null
  readonly nodes: readonly InspectorNodeProjection[]
}

export interface DesignGraphProjection {
  readonly identity: GraphProjectionIdentity
  readonly nodeOrder: readonly string[]
  readonly nodes: Readonly<Record<string, ProjectedNodeMetadata>>
  readonly layers: LayersProjection
  readonly selection: SelectionProjection
  readonly inspector: InspectorProjection
}

interface ProjectionContext {
  readonly graph: DesignGraph
  readonly nodeById: Map<string, DesignNode>
  readonly childIdsByParent: Map<string | null, string[]>
  readonly nodeOrder: string[]
  readonly metadataById: Map<string, ProjectedNodeMetadata>
  readonly componentByNodeId: Map<string, { instance: ComponentInstance; definition: ComponentDefinition }>
  readonly tokenById: Map<string, DesignToken>
  readonly typographyById: Map<string, TypographyDefinition>
  readonly intentById: Map<string, DesignIntent>
}

function freezeDeep<T>(value: T): DeepReadonly<T> {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value as DeepReadonly<T>
  for (const nested of Object.values(value as Record<string, unknown>)) freezeDeep(nested)
  return Object.freeze(value) as DeepReadonly<T>
}

function cloneFrozen<T>(value: T): DeepReadonly<T> {
  return freezeDeep(structuredClone(value))
}

function validateProjectionInput(graph: DesignGraph): void {
  const issues: GraphProjectionIssue[] = []

  if (!graph || typeof graph !== 'object') {
    issues.push({ code: 'MISSING_GRAPH_CONTEXT', path: 'graph', message: 'Project, document, and page identities are required.' })
  } else if (!graph.project || !graph.document || !graph.page) {
    issues.push({ code: 'MISSING_GRAPH_CONTEXT', path: 'graph', message: 'Project, document, and page identities are required.' })
  } else if (!Array.isArray(graph.nodes) || !Array.isArray(graph.componentDefinitions) || !Array.isArray(graph.componentInstances) || !Array.isArray(graph.tokens) || !Array.isArray(graph.typography) || !Array.isArray(graph.assets) || !Array.isArray(graph.intents)) {
    issues.push({ code: 'MISSING_GRAPH_CONTEXT', path: 'graph', message: 'Graph collections must be present as arrays.' })
  } else {
    if (graph.document.projectId !== graph.project.id) {
      issues.push({ code: 'GRAPH_CONTEXT_MISMATCH', path: 'document.projectId', message: 'Document does not belong to the projected project.' })
    }
    if (graph.page.documentId !== graph.document.id) {
      issues.push({ code: 'GRAPH_CONTEXT_MISMATCH', path: 'page.documentId', message: 'Page does not belong to the projected document.' })
    }
  }

  if (issues.length === 0) {
    try {
      validateDesignGraph(graph)
    } catch (error) {
      if (!(error instanceof GraphValidationError)) throw error
      issues.push(...error.issues)
    }
  }

  if (issues.length) throw new GraphProjectionError(issues)
}

function sortedSiblings(nodes: readonly DesignNode[]): DesignNode[] {
  return [...nodes].sort((left, right) => left.orderIndex - right.orderIndex || left.id.localeCompare(right.id))
}

function buildContext(graph: DesignGraph): ProjectionContext {
  validateProjectionInput(graph)

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const childIdsByParent = new Map<string | null, string[]>()
  for (const node of graph.nodes) {
    const siblings = childIdsByParent.get(node.parentId) ?? []
    siblings.push(node.id)
    childIdsByParent.set(node.parentId, siblings)
  }
  for (const [parentId, childIds] of childIdsByParent) {
    childIdsByParent.set(parentId, sortedSiblings(childIds.map((id) => nodeById.get(id)!)).map((node) => node.id))
  }

  const nodeOrder: string[] = []
  const visit = (parentId: string | null) => {
    for (const nodeId of childIdsByParent.get(parentId) ?? []) {
      nodeOrder.push(nodeId)
      visit(nodeId)
    }
  }
  visit(null)

  const definitionById = new Map(graph.componentDefinitions.map((definition) => [definition.id, definition]))
  const componentByNodeId = new Map<string, { instance: ComponentInstance; definition: ComponentDefinition }>()
  for (const instance of graph.componentInstances) {
    const definition = definitionById.get(instance.definitionId)
    if (definition) componentByNodeId.set(instance.nodeId, { instance, definition })
  }

  const metadataById = new Map<string, ProjectedNodeMetadata>()
  for (const nodeId of nodeOrder) {
    const node = nodeById.get(nodeId)!
    const component = componentByNodeId.get(node.id)
    metadataById.set(node.id, {
      id: node.id,
      pageId: node.pageId,
      parentId: node.parentId,
      childIds: [...(childIdsByParent.get(node.id) ?? [])],
      orderIndex: node.orderIndex,
      type: node.type,
      name: node.name,
      semanticRole: node.semantic.role ?? node.accessibility?.role ?? null,
      accessibleName: node.semantic.accessibleName ?? node.accessibility?.accessibleName ?? node.semantic.label ?? null,
      component: component ? {
        instanceId: component.instance.id,
        definitionId: component.definition.id,
        definitionName: component.definition.name,
        state: component.instance.state ?? null,
        variant: component.instance.variant ? structuredClone(component.instance.variant) : null,
      } : null,
      hasResponsiveConstraints: Boolean(node.responsive?.length),
      interactionCount: node.interactions?.length ?? 0,
      stateNames: (node.states ?? []).map((state) => state.name),
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
    })
  }

  return {
    graph,
    nodeById,
    childIdsByParent,
    nodeOrder,
    metadataById,
    componentByNodeId,
    tokenById: new Map(graph.tokens.map((token) => [token.id, token])),
    typographyById: new Map(graph.typography.map((typography) => [typography.id, typography])),
    intentById: new Map(graph.intents.map((intent) => [intent.id, intent])),
  }
}

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)]
}

function selectionFromContext(context: ProjectionContext, selectedNodeIds: readonly string[]): SelectionProjection {
  const requestedIds = uniqueIds(selectedNodeIds)
  const selectedIds = requestedIds.filter((id) => context.nodeById.has(id))
  const missingNodeIds = requestedIds.filter((id) => !context.nodeById.has(id))
  return {
    requestedIds,
    selectedIds,
    missingNodeIds,
    primaryNodeId: selectedIds[0] ?? null,
    nodes: selectedIds.map((id) => context.metadataById.get(id)!),
  }
}

function layersFromContext(context: ProjectionContext, selection: SelectionProjection): LayersProjection {
  const selectionIndex = new Map(selection.selectedIds.map((id, index) => [id, index]))
  const projectNode = (nodeId: string, depth: number, parentPath: readonly string[]): LayerNodeProjection => {
    const metadata = context.metadataById.get(nodeId)!
    const path = [...parentPath, nodeId]
    return {
      ...metadata,
      depth,
      path,
      selected: selectionIndex.has(nodeId),
      selectionIndex: selectionIndex.get(nodeId) ?? null,
      children: metadata.childIds.map((childId) => projectNode(childId, depth + 1, path)),
    }
  }
  return {
    roots: (context.childIdsByParent.get(null) ?? []).map((nodeId) => projectNode(nodeId, 0, [])),
    nodeOrder: [...context.nodeOrder],
  }
}

function inspectorNodeFromContext(context: ProjectionContext, nodeId: string): InspectorNodeProjection {
  const node = context.nodeById.get(nodeId)!
  const metadata = context.metadataById.get(nodeId)!
  const ancestry: ProjectedNodeMetadata[] = []
  let parentId = node.parentId
  while (parentId) {
    ancestry.unshift(context.metadataById.get(parentId)!)
    parentId = context.nodeById.get(parentId)?.parentId ?? null
  }

  const component = context.componentByNodeId.get(node.id)
  const intentIds = new Set(node.intentIds ?? [])
  for (const intent of context.graph.intents) {
    if (intent.targetType === 'node' && intent.targetId === node.id) intentIds.add(intent.id)
    if (component && intent.targetType === 'component' && intent.targetId === component.definition.id) intentIds.add(intent.id)
  }
  for (const intentId of component?.definition.intentIds ?? []) intentIds.add(intentId)

  return {
    metadata,
    ancestry,
    semantic: structuredClone(node.semantic),
    properties: structuredClone(node.properties),
    layout: structuredClone(node.layout),
    tokenReferences: Object.entries(node.tokenRefs ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([slot, tokenId]) => ({ slot, tokenId, token: structuredClone(context.tokenById.get(tokenId)!) })),
    availableTokens: [...context.tokenById.values()]
      .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id))
      .map((token) => structuredClone(token)),
    typography: node.typographyId ? structuredClone(context.typographyById.get(node.typographyId)!) : null,
    responsive: structuredClone(node.responsive ?? []),
    accessibility: node.accessibility ? structuredClone(node.accessibility) : null,
    interactions: structuredClone(node.interactions ?? []),
    states: structuredClone(node.states ?? []),
    intents: [...intentIds].sort().map((intentId) => structuredClone(context.intentById.get(intentId)!)),
    componentDefinition: component ? structuredClone(component.definition) : null,
    asset: node.assetRef ? structuredClone(node.assetRef) : null,
  }
}

function inspectorFromContext(context: ProjectionContext, selection: SelectionProjection): InspectorProjection {
  return {
    mode: selection.selectedIds.length === 0 ? 'none' : selection.selectedIds.length === 1 ? 'single' : 'multiple',
    count: selection.selectedIds.length,
    primaryNodeId: selection.primaryNodeId,
    nodes: selection.selectedIds.map((id) => inspectorNodeFromContext(context, id)),
  }
}

/** Project canonical graph identity, hierarchy, selection, and inspector-readable data. */
export function projectDesignGraph(graph: DesignGraph, selectedNodeIds: readonly string[] = []): DeepReadonly<DesignGraphProjection> {
  const context = buildContext(graph)
  const selection = selectionFromContext(context, selectedNodeIds)
  const nodes = Object.fromEntries(context.nodeOrder.map((id) => [id, context.metadataById.get(id)!]))
  const projection: DesignGraphProjection = {
    identity: { projectId: graph.project.id, documentId: graph.document.id, pageId: graph.page.id },
    nodeOrder: [...context.nodeOrder],
    nodes,
    layers: layersFromContext(context, selection),
    selection,
    inspector: inspectorFromContext(context, selection),
  }
  return cloneFrozen(projection)
}

export function projectSelection(graph: DesignGraph, selectedNodeIds: readonly string[]): DeepReadonly<SelectionProjection> {
  const context = buildContext(graph)
  return cloneFrozen(selectionFromContext(context, selectedNodeIds))
}

export function projectLayers(graph: DesignGraph, selectedNodeIds: readonly string[] = []): DeepReadonly<LayersProjection> {
  const context = buildContext(graph)
  const selection = selectionFromContext(context, selectedNodeIds)
  return cloneFrozen(layersFromContext(context, selection))
}

export function projectInspector(graph: DesignGraph, selectedNodeIds: readonly string[] = []): DeepReadonly<InspectorProjection> {
  const context = buildContext(graph)
  const selection = selectionFromContext(context, selectedNodeIds)
  return cloneFrozen(inspectorFromContext(context, selection))
}
