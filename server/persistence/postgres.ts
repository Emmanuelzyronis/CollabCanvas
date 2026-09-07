import { Pool } from 'pg'
import { DomainError } from '../domain/errors'
import type { DesignDocument, DesignNode, JsonObject, LayoutConstraints, NodeSemantic, NodeType, Page, PageGraph, Project } from '../domain/contracts'
import type { DesignRepository } from './repository'

interface Queryable {
  query<T = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<{ rows: T[] }>
}

type ProjectRow = { id: string; name: string; slug: string; created_at: Date | string; updated_at: Date | string }
type DocumentRow = { id: string; project_id: string; name: string; created_at: Date | string; updated_at: Date | string }
type PageRow = { id: string; document_id: string; name: string; route_hint: string | null; created_at: Date | string; updated_at: Date | string }
type NodeRow = {
  id: string
  page_id: string
  parent_id: string | null
  type: string
  name: string
  order_index: number
  semantic: NodeSemantic
  properties: JsonObject
  layout: LayoutConstraints
  created_at: Date | string
  updated_at: Date | string
}

const iso = (value: Date | string) => value instanceof Date ? value.toISOString() : new Date(value).toISOString()

const toProject = (row: ProjectRow): Project => ({ id: row.id, name: row.name, slug: row.slug, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) })
const toDocument = (row: DocumentRow): DesignDocument => ({ id: row.id, projectId: row.project_id, name: row.name, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) })
const toPage = (row: PageRow): Page => ({ id: row.id, documentId: row.document_id, name: row.name, routeHint: row.route_hint, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) })
const toNode = (row: NodeRow): DesignNode => ({
  id: row.id,
  pageId: row.page_id,
  parentId: row.parent_id,
  type: row.type as NodeType,
  name: row.name,
  orderIndex: row.order_index,
  semantic: row.semantic ?? {},
  properties: row.properties ?? {},
  layout: row.layout ?? {},
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
})

export class PostgresDesignRepository implements DesignRepository {
  constructor(private readonly db: Queryable) {}

  async createProject(project: Project): Promise<Project> {
    try {
      const { rows } = await this.db.query<ProjectRow>(
        `INSERT INTO projects (id, name, slug, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, name, slug, created_at, updated_at`,
        [project.id, project.name, project.slug, project.createdAt, project.updatedAt],
      )
      return toProject(rows[0])
    } catch (error) { throw mapDatabaseError(error, `Project slug "${project.slug}" is already in use.`) }
  }

  async getProject(id: string): Promise<Project | null> {
    const { rows } = await this.db.query<ProjectRow>('SELECT id, name, slug, created_at, updated_at FROM projects WHERE id = $1', [id])
    return rows[0] ? toProject(rows[0]) : null
  }

  async createDocument(document: DesignDocument): Promise<DesignDocument> {
    try {
      const { rows } = await this.db.query<DocumentRow>(
        `INSERT INTO design_documents (id, project_id, name, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, project_id, name, created_at, updated_at`,
        [document.id, document.projectId, document.name, document.createdAt, document.updatedAt],
      )
      return toDocument(rows[0])
    } catch (error) { throw mapDatabaseError(error, `Design document "${document.id}" could not be created.`) }
  }

  async getDocument(id: string): Promise<DesignDocument | null> {
    const { rows } = await this.db.query<DocumentRow>('SELECT id, project_id, name, created_at, updated_at FROM design_documents WHERE id = $1', [id])
    return rows[0] ? toDocument(rows[0]) : null
  }

  async createPage(page: Page): Promise<Page> {
    try {
      const { rows } = await this.db.query<PageRow>(
        `INSERT INTO pages (id, document_id, name, route_hint, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, document_id, name, route_hint, created_at, updated_at`,
        [page.id, page.documentId, page.name, page.routeHint, page.createdAt, page.updatedAt],
      )
      return toPage(rows[0])
    } catch (error) { throw mapDatabaseError(error, `Page "${page.id}" could not be created.`) }
  }

  async getPage(id: string): Promise<Page | null> {
    const { rows } = await this.db.query<PageRow>('SELECT id, document_id, name, route_hint, created_at, updated_at FROM pages WHERE id = $1', [id])
    return rows[0] ? toPage(rows[0]) : null
  }

  async getPageGraph(id: string): Promise<PageGraph | null> {
    const page = await this.getPage(id)
    if (!page) return null
    const { rows } = await this.db.query<NodeRow>(
      `SELECT id, page_id, parent_id, type, name, order_index, semantic, properties, layout, created_at, updated_at
       FROM design_nodes WHERE page_id = $1 ORDER BY parent_id NULLS FIRST, order_index ASC, id ASC`,
      [id],
    )
    return { page, nodes: rows.map(toNode) }
  }

  async createNode(node: DesignNode): Promise<DesignNode> {
    try {
      const { rows } = await this.db.query<NodeRow>(
        `INSERT INTO design_nodes
          (id, page_id, parent_id, type, name, order_index, semantic, properties, layout, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11)
         RETURNING id, page_id, parent_id, type, name, order_index, semantic, properties, layout, created_at, updated_at`,
        [node.id, node.pageId, node.parentId, node.type, node.name, node.orderIndex, JSON.stringify(node.semantic), JSON.stringify(node.properties), JSON.stringify(node.layout), node.createdAt, node.updatedAt],
      )
      return toNode(rows[0])
    } catch (error) { throw mapDatabaseError(error, `Design node "${node.id}" could not be created.`) }
  }
}

export function createPostgresPool(connectionString = process.env.DATABASE_URL): Pool {
  if (!connectionString) throw new Error('DATABASE_URL is required to start the API.')
  return new Pool({ connectionString })
}

function mapDatabaseError(error: unknown, conflictMessage: string): DomainError {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
  if (code === '23505') return new DomainError('CONFLICT', conflictMessage)
  if (code === '23503') return new DomainError('INVALID_REFERENCE', 'A referenced resource does not exist.')
  return error instanceof DomainError ? error : new DomainError('VALIDATION_ERROR', 'The database rejected the request.')
}
