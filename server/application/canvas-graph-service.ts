import { nanoid } from 'nanoid'
import type { CreateNodeInput, DesignGraph, DesignNode, NodeType } from '../domain/contracts.js'
import type { DesignToken, TypographyDefinition } from '../domain/graph-types.js'
import { DomainError } from '../domain/errors.js'
import { createNode, deleteNode, duplicateNode, moveNode, updateNode } from '../domain/graph-operations.js'
import { GraphValidationError, validateDesignGraph } from '../domain/graph-validation.js'
import { NODE_TYPES } from '../domain/graph-types.js'
import type { DesignGraphRepository, DesignGraphWriter, DesignRepository } from '../persistence/repository.js'

export interface CanvasMutationGuard {
  assertMutable(documentId: string): Promise<void>
  recordDraftGraph(graph: DesignGraph): Promise<void>
}

export interface CanvasGraphApplication {
  getDocumentGraph(documentId: string): Promise<DesignGraph>
  getWorkspaceGraph(projectId: string, documentId: string, pageId: string): Promise<DesignGraph>
  createNode(documentId: string, input: CreateNodeInput): Promise<DesignGraph>
  moveNode(documentId: string, nodeId: string, parentId: string | null, orderIndex?: number): Promise<DesignGraph>
  updateNode(documentId: string, nodeId: string, patch: Partial<Omit<DesignNode, 'id' | 'pageId'>>): Promise<DesignGraph>
  resizeNode(documentId: string, nodeId: string, width: number, height: number, x?: number, y?: number): Promise<DesignGraph>
  deleteNode(documentId: string, nodeId: string): Promise<DesignGraph>
  duplicateNode(documentId: string, nodeId: string): Promise<DesignGraph>
  /** Restore a previously observed graph state through the guarded mutation path (undo/redo). */
  restoreDesignGraph(documentId: string, graph: DesignGraph): Promise<DesignGraph>
  /** Design-system token CRUD */
  upsertToken(documentId: string, token: DesignToken): Promise<DesignGraph>
  deleteToken(documentId: string, tokenId: string): Promise<DesignGraph>
  /** Typography CRUD */
  upsertTypography(documentId: string, def: TypographyDefinition): Promise<DesignGraph>
  deleteTypography(documentId: string, typographyId: string): Promise<DesignGraph>
  /** Batch import: merge tokens + typography into the graph */
  importDesignSystem(documentId: string, patch: { tokens?: DesignToken[]; typography?: TypographyDefinition[] }): Promise<DesignGraph>
}

type GraphStore = DesignGraphRepository & DesignGraphWriter

export interface CanvasGraphServiceDeps {
  id?: () => string
  now?: () => string
}

function requiredId(value: string, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new DomainError('VALIDATION_ERROR', `${field} must be a non-empty string.`)
  return value.trim()
}

function requiredText(value: string, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new DomainError('VALIDATION_ERROR', `${field} must be a non-empty string.`)
  return value.trim()
}

function objectOrEmpty<T extends object>(value: unknown, field: string): T {
  if (value === undefined) return {} as unknown as T
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DomainError('VALIDATION_ERROR', `${field} must be a JSON object.`)
  }
  return value as unknown as T
}

/**
 * Keep the document asset catalog and the node's asset reference in sync so a
 * projected image always resolves to a canonical, validated asset.
 */
function withRegisteredAsset(graph: DesignGraph, asset: DesignNode['assetRef']): DesignGraph {
  if (!asset || typeof asset.id !== 'string' || asset.id.trim().length === 0) return graph
  const assets = Array.isArray(graph.assets) ? graph.assets : []
  const index = assets.findIndex((candidate) => candidate.id === asset.id)
  const nextAssets = index >= 0
    ? assets.map((candidate, position) => position === index ? { ...candidate, ...asset } : candidate)
    : [...assets, asset]
  return { ...graph, assets: nextAssets }
}

/**
 * Application boundary for the first graph-backed canvas workflow.
 * The editor receives a graph, submits domain mutations, and only then
 * receives the updated graph for projection. It never writes storage itself.
 */
export class CanvasGraphApplicationService implements CanvasGraphApplication {
  private readonly resources: Pick<DesignRepository, 'getProject' | 'getDocument' | 'getPage'>
  private readonly graphs: GraphStore
  private readonly mutationGuard?: CanvasMutationGuard
  private readonly makeId: () => string
  private readonly timestamp: () => string

  constructor(
    resources: Pick<DesignRepository, 'getProject' | 'getDocument' | 'getPage'>,
    graphs: GraphStore,
    mutationGuard?: CanvasMutationGuard,
    deps: CanvasGraphServiceDeps = {},
  ) {
    this.resources = resources
    this.graphs = graphs
    this.mutationGuard = mutationGuard
    this.makeId = deps.id ?? (() => nanoid(16))
    this.timestamp = deps.now ?? (() => new Date().toISOString())
  }

  async getDocumentGraph(documentId: string): Promise<DesignGraph> {
    const id = requiredId(documentId, 'documentId')
    const document = await this.resources.getDocument(id)
    if (!document) throw new DomainError('NOT_FOUND', `Design document "${id}" was not found.`)
    const graph = await this.graphs.getDesignGraph(id)
    if (!graph) throw new DomainError('GRAPH_UNAVAILABLE', `The canonical design graph for document "${id}" is unavailable.`)
    this.assertGraphScope(graph, document.projectId, document.id)
    return graph
  }

  async getWorkspaceGraph(projectId: string, documentId: string, pageId: string): Promise<DesignGraph> {
    const project = await this.resources.getProject(requiredId(projectId, 'projectId'))
    if (!project) throw new DomainError('NOT_FOUND', `Project "${projectId}" was not found.`)
    const document = await this.resources.getDocument(requiredId(documentId, 'documentId'))
    if (!document) throw new DomainError('NOT_FOUND', `Design document "${documentId}" was not found.`)
    const page = await this.resources.getPage(requiredId(pageId, 'pageId'))
    if (!page) throw new DomainError('NOT_FOUND', `Page "${pageId}" was not found.`)
    if (document.projectId !== project.id || page.documentId !== document.id) {
      throw new DomainError('NOT_FOUND', 'The requested page does not belong to the requested project and document.')
    }
    const graph = await this.getDocumentGraph(document.id)
    if (graph.page.id !== page.id) throw new DomainError('GRAPH_UNAVAILABLE', 'The canonical graph does not contain the requested page.')
    return graph
  }

  async createNode(documentId: string, input: CreateNodeInput): Promise<DesignGraph> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new DomainError('VALIDATION_ERROR', 'Node input must be an object.')
    const type = String(input.type ?? '') as NodeType
    if (!NODE_TYPES.includes(type)) throw new DomainError('VALIDATION_ERROR', `type must be one of: ${NODE_TYPES.join(', ')}.`)
    const name = requiredText(input.name, 'name')
    if (input.orderIndex !== undefined && (!Number.isInteger(input.orderIndex) || input.orderIndex < 0)) {
      throw new DomainError('VALIDATION_ERROR', 'orderIndex must be a non-negative integer.')
    }
    return this.mutate(documentId, (graph) => {
      const parentId = input.parentId ?? null
      if (parentId !== null && !graph.nodes.some((node) => node.id === parentId)) {
        throw new DomainError('INVALID_REFERENCE', `Parent node "${parentId}" does not exist on this page.`)
      }
      const now = this.timestamp()
      const siblingCount = graph.nodes.filter((node) => node.parentId === parentId).length
      const node: DesignNode = {
        id: this.makeId(),
        pageId: graph.page.id,
        parentId,
        type,
        name,
        orderIndex: input.orderIndex ?? siblingCount,
        semantic: objectOrEmpty(input.semantic, 'semantic'),
        properties: objectOrEmpty(input.properties, 'properties'),
        layout: objectOrEmpty(input.layout, 'layout'),
        ...(input.tokenRefs ? { tokenRefs: input.tokenRefs } : {}),
        ...(input.typographyId ? { typographyId: input.typographyId } : {}),
        ...(input.responsive ? { responsive: input.responsive } : {}),
        ...(input.interactions ? { interactions: input.interactions } : {}),
        ...(input.states ? { states: input.states } : {}),
        ...(input.accessibility ? { accessibility: input.accessibility } : {}),
        ...(input.assetRef ? { assetRef: input.assetRef } : {}),
        ...(input.componentInstanceId ? { componentInstanceId: input.componentInstanceId } : {}),
        ...(input.intentIds ? { intentIds: input.intentIds } : {}),
        createdAt: now,
        updatedAt: now,
      }
      return { ...createNode(withRegisteredAsset(graph, node.assetRef), node) }
    })
  }

  async moveNode(documentId: string, nodeId: string, parentId: string | null, orderIndex?: number): Promise<DesignGraph> {
    return this.mutate(documentId, (graph) => moveNode(graph, requiredId(nodeId, 'nodeId'), parentId, orderIndex))
  }

  async updateNode(documentId: string, nodeId: string, patch: Partial<Omit<DesignNode, 'id' | 'pageId'>>): Promise<DesignGraph> {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new DomainError('VALIDATION_ERROR', 'patch must be an object.')
    return this.mutate(documentId, (graph) => updateNode(withRegisteredAsset(graph, patch.assetRef), requiredId(nodeId, 'nodeId'), patch))
  }

  async resizeNode(documentId: string, nodeId: string, width: number, height: number, x?: number, y?: number): Promise<DesignGraph> {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 8 || height < 8) {
      throw new DomainError('VALIDATION_ERROR', 'width and height must be finite values of at least 8.')
    }
    const current = await this.getDocumentGraph(documentId)
    const node = current.nodes.find((candidate) => candidate.id === nodeId)
    if (!node) throw new DomainError('NOT_FOUND', `Node "${nodeId}" was not found.`)
    return this.updateNode(documentId, nodeId, { layout: { ...node.layout, ...(x === undefined ? {} : { x }), ...(y === undefined ? {} : { y }), width, height } })
  }

  async deleteNode(documentId: string, nodeId: string): Promise<DesignGraph> {
    return this.mutate(documentId, (graph) => deleteNode(graph, requiredId(nodeId, 'nodeId')))
  }

  async duplicateNode(documentId: string, nodeId: string): Promise<DesignGraph> {
    const id = requiredId(nodeId, 'nodeId')
    return this.mutate(documentId, (graph) => {
      if (!graph.nodes.some((node) => node.id === id)) throw new DomainError('NOT_FOUND', `Node "${id}" was not found.`)
      return duplicateNode(graph, id, () => this.makeId())
    })
  }

  async upsertToken(documentId: string, token: DesignToken): Promise<DesignGraph> {
    if (!token?.id || !token.name || !token.category) throw new DomainError('VALIDATION_ERROR', 'token must have id, name, and category.')
    return this.mutate(documentId, (g) => {
      const tokens = Array.isArray(g.tokens) ? g.tokens : []
      const idx = tokens.findIndex((t) => t.id === token.id)
      const next = idx >= 0 ? tokens.map((t, i) => (i === idx ? token : t)) : [...tokens, token]
      return { ...g, tokens: next }
    })
  }

  async deleteToken(documentId: string, tokenId: string): Promise<DesignGraph> {
    if (!tokenId) throw new DomainError('VALIDATION_ERROR', 'tokenId is required.')
    return this.mutate(documentId, (g) => ({ ...g, tokens: (g.tokens ?? []).filter((t) => t.id !== tokenId) }))
  }

  async upsertTypography(documentId: string, def: TypographyDefinition): Promise<DesignGraph> {
    if (!def?.id || !def.name || !def.fontFamily) throw new DomainError('VALIDATION_ERROR', 'typography must have id, name, and fontFamily.')
    return this.mutate(documentId, (g) => {
      const typography = Array.isArray(g.typography) ? g.typography : []
      const idx = typography.findIndex((t) => t.id === def.id)
      const next = idx >= 0 ? typography.map((t, i) => (i === idx ? def : t)) : [...typography, def]
      return { ...g, typography: next }
    })
  }

  async deleteTypography(documentId: string, typographyId: string): Promise<DesignGraph> {
    if (!typographyId) throw new DomainError('VALIDATION_ERROR', 'typographyId is required.')
    return this.mutate(documentId, (g) => ({ ...g, typography: (g.typography ?? []).filter((t) => t.id !== typographyId) }))
  }

  async importDesignSystem(documentId: string, patch: { tokens?: DesignToken[]; typography?: TypographyDefinition[] }): Promise<DesignGraph> {
    return this.mutate(documentId, (g) => {
      let tokens = Array.isArray(g.tokens) ? [...g.tokens] : []
      for (const t of patch.tokens ?? []) {
        const idx = tokens.findIndex((x) => x.id === t.id)
        if (idx >= 0) tokens[idx] = t; else tokens.push(t)
      }
      let typography = Array.isArray(g.typography) ? [...g.typography] : []
      for (const t of patch.typography ?? []) {
        const idx = typography.findIndex((x) => x.id === t.id)
        if (idx >= 0) typography[idx] = t; else typography.push(t)
      }
      return { ...g, tokens, typography }
    })
  }

  async restoreDesignGraph(documentId: string, graph: DesignGraph): Promise<DesignGraph> {
    if (!graph || typeof graph !== 'object' || Array.isArray(graph)) throw new DomainError('VALIDATION_ERROR', 'graph must be an object.')
    const document = await this.resources.getDocument(requiredId(documentId, 'documentId'))
    if (!document) throw new DomainError('NOT_FOUND', `Design document "${documentId}" was not found.`)
    this.assertGraphScope(graph, document.projectId, document.id)
    await this.mutationGuard?.assertMutable(documentId)
    const saved = await this.graphs.saveDesignGraph(structuredClone(graph))
    await this.mutationGuard?.recordDraftGraph(saved)
    return saved
  }

  private async mutate(documentId: string, operation: (graph: DesignGraph) => DesignGraph): Promise<DesignGraph> {
    await this.mutationGuard?.assertMutable(documentId)
    const current = await this.getDocumentGraph(documentId)
    const next = operation(current)
    const saved = await this.graphs.saveDesignGraph(next)
    await this.mutationGuard?.recordDraftGraph(saved)
    return saved
  }

  private assertGraphScope(graph: DesignGraph, projectId: string, documentId: string): void {
    if (graph.project.id !== projectId || graph.document.id !== documentId || graph.document.projectId !== projectId || graph.page.documentId !== documentId) {
      throw new DomainError('GRAPH_UNAVAILABLE', 'The canonical design graph does not match the requested project and document.')
    }
    try {
      validateDesignGraph(graph)
    } catch (error) {
      if (error instanceof GraphValidationError) throw new DomainError('INVALID_GRAPH', 'The canonical design graph is invalid.', { issues: error.issues })
      throw error
    }
  }
}
