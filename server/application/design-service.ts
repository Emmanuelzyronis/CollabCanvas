import { nanoid } from 'nanoid'
import type {
  CreateDocumentInput,
  CreateNodeInput,
  CreatePageInput,
  CreateProjectInput,
  DesignDocument,
  DesignNode,
  NodeType,
  NodeSemantic,
  Page,
  PageGraph,
  Project,
} from '../domain/contracts.js'
import { DomainError } from '../domain/errors.js'
import { NODE_TYPES } from '../domain/graph-types.js'
import type { DesignRepository } from '../persistence/repository.js'

export interface DesignServiceDeps {
  id?: () => string
  now?: () => string
}

function requiredText(value: string, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DomainError('VALIDATION_ERROR', `${field} must be a non-empty string.`)
  }
  return value.trim()
}

function slugify(value: string): string {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (!slug) throw new DomainError('VALIDATION_ERROR', 'slug must contain letters or numbers.')
  return slug
}

function objectOrEmpty<T extends object>(value: unknown, field: string): T {
  if (value === undefined) return {} as unknown as T
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DomainError('VALIDATION_ERROR', `${field} must be a JSON object.`)
  }
  return value as unknown as T
}

export class DesignService {
  private readonly makeId: () => string
  private readonly timestamp: () => string

  constructor(
    private readonly repository: DesignRepository,
    deps: DesignServiceDeps = {},
  ) {
    this.makeId = deps.id ?? (() => nanoid(16))
    this.timestamp = deps.now ?? (() => new Date().toISOString())
  }

  async createProject(input: CreateProjectInput): Promise<Project> {
    const name = requiredText(input.name, 'name')
    const now = this.timestamp()
    return this.repository.createProject({
      id: this.makeId(),
      name,
      slug: slugify(input.slug ?? name),
      createdAt: now,
      updatedAt: now,
    })
  }

  async getProject(id: string): Promise<Project> {
    const project = await this.repository.getProject(requiredText(id, 'id'))
    if (!project) throw new DomainError('NOT_FOUND', `Project "${id}" was not found.`)
    return project
  }

  async createDocument(projectId: string, input: CreateDocumentInput): Promise<DesignDocument> {
    const project = await this.getProject(projectId)
    const name = requiredText(input.name, 'name')
    const now = this.timestamp()
    return this.repository.createDocument({ id: this.makeId(), projectId: project.id, name, createdAt: now, updatedAt: now })
  }

  async getDocument(id: string): Promise<DesignDocument> {
    const document = await this.repository.getDocument(requiredText(id, 'id'))
    if (!document) throw new DomainError('NOT_FOUND', `Design document "${id}" was not found.`)
    return document
  }

  async createPage(documentId: string, input: CreatePageInput): Promise<Page> {
    const document = await this.getDocument(documentId)
    const name = requiredText(input.name, 'name')
    const routeHint = input.routeHint === undefined || input.routeHint === null ? null : requiredText(input.routeHint, 'routeHint')
    const now = this.timestamp()
    return this.repository.createPage({ id: this.makeId(), documentId: document.id, name, routeHint, createdAt: now, updatedAt: now })
  }

  async getPage(id: string): Promise<PageGraph> {
    const graph = await this.repository.getPageGraph(requiredText(id, 'id'))
    if (!graph) throw new DomainError('NOT_FOUND', `Page "${id}" was not found.`)
    return graph
  }

  async createNode(pageId: string, input: CreateNodeInput): Promise<DesignNode> {
    const page = await this.getPage(pageId)
    const type = requiredText(input.type, 'type') as NodeType
    if (!NODE_TYPES.includes(type)) throw new DomainError('VALIDATION_ERROR', `type must be one of: ${NODE_TYPES.join(', ')}.`)
    const name = requiredText(input.name, 'name')
    if (input.orderIndex !== undefined && (!Number.isInteger(input.orderIndex) || input.orderIndex < 0)) {
      throw new DomainError('VALIDATION_ERROR', 'orderIndex must be a non-negative integer.')
    }

    const graph = await this.getPage(page.page.id)
    const parentId = input.parentId ?? null
    if (parentId !== null) {
      const parent = graph.nodes.find((node) => node.id === parentId)
      if (!parent) throw new DomainError('INVALID_REFERENCE', `Parent node "${parentId}" does not belong to page "${pageId}".`)
    }

    const siblingIndexes = graph.nodes.filter((node) => node.parentId === parentId).map((node) => node.orderIndex)
    const orderIndex = input.orderIndex ?? (siblingIndexes.length ? Math.max(...siblingIndexes) + 1 : 0)
    const now = this.timestamp()
    return this.repository.createNode({
      id: this.makeId(),
      pageId: page.page.id,
      parentId,
      type,
      name,
      orderIndex,
      semantic: objectOrEmpty<NodeSemantic>(input.semantic, 'semantic'),
      properties: objectOrEmpty(input.properties, 'properties'),
      layout: objectOrEmpty(input.layout, 'layout'),
      createdAt: now,
      updatedAt: now,
    })
  }
}
