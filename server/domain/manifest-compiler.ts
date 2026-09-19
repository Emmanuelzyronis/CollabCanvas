import type { DesignGraph, DesignNode, JsonObject, JsonValue, LayoutConstraints } from './contracts.js'
import { validateDesignGraph } from './graph-validation.js'
import { DESIGN_MANIFEST_VERSION, type DesignManifest, type ManifestComponentInstance, type ManifestGeometry, type ManifestNode } from './manifest-types.js'

export { serializeDesignManifest } from './manifest-serialization.js'

export type ManifestCompilationCode = 'MISSING_GRAPH_CONTEXT' | 'GRAPH_CONTEXT_MISMATCH'

export class ManifestCompilationError extends Error {
  constructor(public readonly code: ManifestCompilationCode, message: string) {
    super(message)
    this.name = 'ManifestCompilationError'
  }
}

const BREAKPOINT_ORDER = ['mobile', 'tablet', 'desktop', 'wide'] as const
const SECRET_KEY = /(secret|password|credential|authorization|api[-_]?key|access[-_]?token)/i

function sanitize(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(sanitize)
  if (value === null || typeof value !== 'object') return value
  const result: JsonObject = {}
  for (const key of Object.keys(value)) {
    if (SECRET_KEY.test(key)) continue
    result[key] = sanitize(value[key])
  }
  return result
}

function sortStrings(values: string[] | undefined): string[] | undefined {
  return values ? [...values].sort((a, b) => a.localeCompare(b)) : undefined
}

function geometryOf(layout: LayoutConstraints): ManifestGeometry | undefined {
  const geometry: ManifestGeometry = {}
  if (typeof layout.x === 'number') geometry.x = layout.x
  if (typeof layout.y === 'number') geometry.y = layout.y
  if (typeof layout.width === 'number') geometry.width = layout.width
  if (typeof layout.height === 'number') geometry.height = layout.height
  return Object.keys(geometry).length ? geometry : undefined
}

function layoutOf(layout: LayoutConstraints): Omit<LayoutConstraints, 'x' | 'y'> {
  const { x: _x, y: _y, ...constraints } = layout
  return constraints
}

function nodeOrder(nodes: DesignNode[]): DesignNode[] {
  const siblings = new Map<string | null, DesignNode[]>()
  for (const node of nodes) {
    const values = siblings.get(node.parentId) ?? []
    values.push(node)
    siblings.set(node.parentId, values)
  }
  for (const values of siblings.values()) values.sort((a, b) => a.orderIndex - b.orderIndex || a.id.localeCompare(b.id))
  const ordered: DesignNode[] = []
  const visit = (parentId: string | null) => {
    for (const node of siblings.get(parentId) ?? []) {
      ordered.push(node)
      visit(node.id)
    }
  }
  visit(null)
  return ordered
}

function compileNode(node: DesignNode, children: string[]): ManifestNode {
  const responsive = node.responsive?.slice().sort((a, b) => BREAKPOINT_ORDER.indexOf(a.breakpoint) - BREAKPOINT_ORDER.indexOf(b.breakpoint))
  const interactions = node.interactions?.slice().sort((a, b) => `${a.type}:${a.targetId ?? ''}:${a.destination ?? ''}:${a.intent ?? ''}`.localeCompare(`${b.type}:${b.targetId ?? ''}:${b.destination ?? ''}:${b.intent ?? ''}`))
  const states = node.states?.slice().sort((a, b) => a.name.localeCompare(b.name)).map((state) => ({
    ...state,
    properties: state.properties ? sanitize(state.properties) as JsonObject : undefined,
  }))
  return {
    id: node.id,
    pageId: node.pageId,
    parentId: node.parentId,
    children,
    type: node.type,
    name: node.name,
    orderIndex: node.orderIndex,
    semantic: structuredClone(node.semantic),
    properties: sanitize(node.properties) as JsonObject,
    geometry: geometryOf(node.layout),
    layout: structuredClone(layoutOf(node.layout)),
    tokenRefs: node.tokenRefs ? { ...node.tokenRefs } : undefined,
    typographyId: node.typographyId,
    responsive: responsive ? structuredClone(responsive) : undefined,
    interactions: interactions ? structuredClone(interactions) : undefined,
    states: states ? structuredClone(states) : undefined,
    accessibility: node.accessibility ? structuredClone(node.accessibility) : undefined,
    assetRef: node.assetRef ? structuredClone(node.assetRef) : undefined,
    componentInstanceId: node.componentInstanceId,
    intentIds: sortStrings(node.intentIds),
  }
}

function compileInstance(instance: DesignGraph['componentInstances'][number]): ManifestComponentInstance {
  return {
    id: instance.id,
    definitionId: instance.definitionId,
    nodeId: instance.nodeId,
    props: sanitize(instance.props) as JsonObject,
    variant: instance.variant ? { ...instance.variant } : undefined,
    state: instance.state,
    contentOverrides: instance.contentOverrides ? sanitize(instance.contentOverrides) as JsonObject : undefined,
    layoutOverrides: instance.layoutOverrides ? structuredClone(instance.layoutOverrides) : undefined,
  }
}

function compileDefinition(definition: DesignGraph['componentDefinitions'][number]): DesignManifest['componentDefinitions'][number] {
  return {
    id: definition.id,
    name: definition.name,
    description: definition.description,
    anatomy: [...definition.anatomy],
    variants: structuredClone(definition.variants),
    props: [...definition.props],
    states: [...definition.states].sort(),
    tokenRefs: { ...definition.tokenRefs },
    accessibility: definition.accessibility ? structuredClone(definition.accessibility) : undefined,
    intentIds: sortStrings(definition.intentIds),
  }
}

/** Compile only from the canonical DesignGraph. No UI/runtime state is read. */
export function compileDesignManifest(graph: DesignGraph): DesignManifest {
  validateDesignGraph(graph)
  if (!graph.project || !graph.document) throw new ManifestCompilationError('MISSING_GRAPH_CONTEXT', 'DesignGraph must include project and document identities.')
  if (graph.document.projectId !== graph.project.id || graph.page.documentId !== graph.document.id) {
    throw new ManifestCompilationError('GRAPH_CONTEXT_MISMATCH', 'DesignGraph project, document, and page identities do not agree.')
  }

  const orderedNodes = nodeOrder(graph.nodes)
  const childrenByParent = new Map<string, string[]>()
  for (const node of orderedNodes) {
    if (node.parentId === null) continue
    const children = childrenByParent.get(node.parentId) ?? []
    children.push(node.id)
    childrenByParent.set(node.parentId, children)
  }

  return {
    manifestVersion: DESIGN_MANIFEST_VERSION,
    project: { id: graph.project.id, name: graph.project.name, slug: graph.project.slug },
    document: { id: graph.document.id, projectId: graph.document.projectId, name: graph.document.name },
    pages: [{ id: graph.page.id, documentId: graph.page.documentId, name: graph.page.name, routeHint: graph.page.routeHint, rootNodeIds: orderedNodes.filter((node) => node.parentId === null).map((node) => node.id) }],
    nodes: orderedNodes.map((node) => compileNode(node, childrenByParent.get(node.id) ?? [])),
    componentDefinitions: graph.componentDefinitions.slice().sort((a, b) => a.id.localeCompare(b.id)).map(compileDefinition),
    componentInstances: graph.componentInstances.slice().sort((a, b) => a.id.localeCompare(b.id)).map(compileInstance),
    tokens: graph.tokens.slice().sort((a, b) => a.id.localeCompare(b.id)).map((item) => ({ ...structuredClone(item), value: sanitize(item.value as JsonValue) as typeof item.value })),
    typography: graph.typography.slice().sort((a, b) => a.id.localeCompare(b.id)).map((item) => structuredClone(item)),
    assets: graph.assets.slice().sort((a, b) => a.id.localeCompare(b.id)).map((item) => structuredClone(item)),
    intents: graph.intents.slice().sort((a, b) => a.id.localeCompare(b.id)).map((item) => structuredClone(item)),
  }
}
