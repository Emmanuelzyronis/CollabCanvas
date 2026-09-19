import { Pool } from 'pg'
import { DomainError } from '../domain/errors.js'
import type { DesignDocument, DesignGraph, DesignNode, JsonObject, LayoutConstraints, NodeSemantic, NodeType, Page, PageGraph, Project } from '../domain/contracts.js'
import { validateDesignGraph } from '../domain/graph-validation.js'
import type { DesignProposal, DesignVersion } from '../domain/version-types.js'
import type { DesignGraphRepository, DesignGraphWriter, DesignRepository } from './repository.js'
import type { VersionRepository } from './version-repository.js'

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
type GraphRow = { document_id: string; graph: DesignGraph }
type VersionRow = Omit<DesignVersion, 'number' | 'createdAt' | 'approvedAt'> & { version_number: number; created_at: Date | string; approved_at: Date | string | null }
type ProposalRow = Omit<DesignProposal, 'createdAt' | 'reviewedAt'> & { created_at: Date | string; reviewed_at: Date | string | null }

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

const toVersion = (row: VersionRow): DesignVersion => ({
  id: row.id,
  projectId: row.projectId,
  documentId: row.documentId,
  number: row.version_number,
  status: row.status,
  graph: structuredClone(row.graph),
  graphHash: row.graphHash,
  createdAt: iso(row.created_at),
  createdBy: row.createdBy,
  ...(row.approved_at ? { approvedAt: iso(row.approved_at), approvedBy: row.approvedBy } : {}),
})

const toProposal = (row: ProposalRow): DesignProposal => ({
  id: row.id,
  projectId: row.projectId,
  documentId: row.documentId,
  baseVersionId: row.baseVersionId,
  operations: structuredClone(row.operations),
  affectedResourceIds: structuredClone(row.affectedResourceIds),
  rationale: row.rationale,
  author: row.author,
  validation: structuredClone(row.validation),
  status: row.status,
  createdAt: iso(row.created_at),
  ...(row.reviewed_at ? { reviewedAt: iso(row.reviewed_at), reviewedBy: row.reviewedBy, ...(row.resultingVersionId ? { resultingVersionId: row.resultingVersionId } : {}) } : {}),
})

export class PostgresDesignRepository implements DesignRepository, DesignGraphRepository, DesignGraphWriter {
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

  async getDesignGraph(documentId: string): Promise<DesignGraph | null> {
    const { rows } = await this.db.query<GraphRow>('SELECT document_id, graph FROM design_graphs WHERE document_id = $1', [documentId])
    const row = rows[0]
    return row ? structuredClone(row.graph) : null
  }

  async saveDesignGraph(graph: DesignGraph): Promise<DesignGraph> {
    validateDesignGraph(graph)
    try {
      const { rows } = await this.db.query<GraphRow>(
        `INSERT INTO design_graphs (document_id, project_id, page_id, graph, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, $5)
         ON CONFLICT (document_id) DO UPDATE SET project_id = EXCLUDED.project_id, page_id = EXCLUDED.page_id, graph = EXCLUDED.graph, updated_at = EXCLUDED.updated_at
         RETURNING document_id, graph`,
        [graph.document.id, graph.project.id, graph.page.id, JSON.stringify(graph), graph.document.updatedAt],
      )
      return structuredClone(rows[0].graph)
    } catch (error) {
      throw mapDatabaseError(error, `Design graph for document "${graph.document.id}" could not be saved.`)
    }
  }
}

export class PostgresVersionRepository implements VersionRepository {
  constructor(private readonly db: Queryable) {}

  async getVersion(id: string): Promise<DesignVersion | null> {
    const { rows } = await this.db.query<VersionRow>(
      `SELECT id, project_id AS "projectId", document_id AS "documentId", version_number, status, graph,
        graph_hash AS "graphHash", created_at, created_by AS "createdBy", approved_at, approved_by AS "approvedBy"
       FROM design_versions WHERE id = $1`,
      [id],
    )
    return rows[0] ? toVersion(rows[0]) : null
  }

  async listVersions(documentId: string): Promise<DesignVersion[]> {
    const { rows } = await this.db.query<VersionRow>(
      `SELECT id, project_id AS "projectId", document_id AS "documentId", version_number, status, graph,
        graph_hash AS "graphHash", created_at, created_by AS "createdBy", approved_at, approved_by AS "approvedBy"
       FROM design_versions WHERE document_id = $1 ORDER BY version_number ASC, id ASC`,
      [documentId],
    )
    return rows.map(toVersion)
  }

  async saveVersion(version: DesignVersion): Promise<DesignVersion> {
    try {
      const { rows } = await this.db.query<VersionRow>(
        `INSERT INTO design_versions
          (id, project_id, document_id, version_number, status, graph, graph_hash, created_at, created_by, approved_at, approved_by)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11)
         RETURNING id, project_id AS "projectId", document_id AS "documentId", version_number, status, graph,
          graph_hash AS "graphHash", created_at, created_by AS "createdBy", approved_at, approved_by AS "approvedBy"`,
        [version.id, version.projectId, version.documentId, version.number, version.status, JSON.stringify(version.graph), version.graphHash, version.createdAt, version.createdBy, version.approvedAt ?? null, version.approvedBy ?? null],
      )
      return toVersion(rows[0])
    } catch (error) { throw mapDatabaseError(error, `Version number ${version.number} already exists.`) }
  }

  async updateVersion(version: DesignVersion): Promise<DesignVersion> {
    try {
      const { rows } = await this.db.query<VersionRow>(
        `UPDATE design_versions SET status = $2, graph = $3::jsonb, graph_hash = $4, approved_at = $5, approved_by = $6
         WHERE id = $1
         RETURNING id, project_id AS "projectId", document_id AS "documentId", version_number, status, graph,
          graph_hash AS "graphHash", created_at, created_by AS "createdBy", approved_at, approved_by AS "approvedBy"`,
        [version.id, version.status, JSON.stringify(version.graph), version.graphHash, version.approvedAt ?? null, version.approvedBy ?? null],
      )
      if (!rows[0]) throw new DomainError('NOT_FOUND', `Design version "${version.id}" was not found.`)
      return toVersion(rows[0])
    } catch (error) { throw mapDatabaseError(error, `Design version "${version.id}" could not be updated.`) }
  }

  async getProposal(id: string): Promise<DesignProposal | null> {
    const { rows } = await this.db.query<ProposalRow>(
      `SELECT id, project_id AS "projectId", document_id AS "documentId", base_version_id AS "baseVersionId", operations,
        affected_resource_ids AS "affectedResourceIds", rationale, author, validation, status, created_at,
        reviewed_at, reviewed_by AS "reviewedBy", resulting_version_id AS "resultingVersionId"
       FROM design_proposals WHERE id = $1`,
      [id],
    )
    return rows[0] ? toProposal(rows[0]) : null
  }

  async saveProposal(proposal: DesignProposal): Promise<DesignProposal> {
    try {
      const { rows } = await this.db.query<ProposalRow>(
        `INSERT INTO design_proposals
          (id, project_id, document_id, base_version_id, operations, affected_resource_ids, rationale, author, validation, status, created_at, reviewed_at, reviewed_by, resulting_version_id)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9::jsonb, $10, $11, $12, $13, $14)
         RETURNING id, project_id AS "projectId", document_id AS "documentId", base_version_id AS "baseVersionId", operations,
          affected_resource_ids AS "affectedResourceIds", rationale, author, validation, status, created_at,
          reviewed_at, reviewed_by AS "reviewedBy", resulting_version_id AS "resultingVersionId"`,
        [proposal.id, proposal.projectId, proposal.documentId, proposal.baseVersionId, JSON.stringify(proposal.operations), JSON.stringify(proposal.affectedResourceIds), proposal.rationale, proposal.author, JSON.stringify(proposal.validation), proposal.status, proposal.createdAt, proposal.reviewedAt ?? null, proposal.reviewedBy ?? null, proposal.resultingVersionId ?? null],
      )
      return toProposal(rows[0])
    } catch (error) { throw mapDatabaseError(error, `Design proposal "${proposal.id}" could not be saved.`) }
  }

  async updateProposal(proposal: DesignProposal): Promise<DesignProposal> {
    try {
      const { rows } = await this.db.query<ProposalRow>(
        `UPDATE design_proposals SET status = $2, validation = $3::jsonb, reviewed_at = $4, reviewed_by = $5, resulting_version_id = $6
         WHERE id = $1
         RETURNING id, project_id AS "projectId", document_id AS "documentId", base_version_id AS "baseVersionId", operations,
          affected_resource_ids AS "affectedResourceIds", rationale, author, validation, status, created_at,
          reviewed_at, reviewed_by AS "reviewedBy", resulting_version_id AS "resultingVersionId"`,
        [proposal.id, proposal.status, JSON.stringify(proposal.validation), proposal.reviewedAt ?? null, proposal.reviewedBy ?? null, proposal.resultingVersionId ?? null],
      )
      if (!rows[0]) throw new DomainError('NOT_FOUND', `Design proposal "${proposal.id}" was not found.`)
      return toProposal(rows[0])
    } catch (error) { throw mapDatabaseError(error, `Design proposal "${proposal.id}" could not be updated.`) }
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
