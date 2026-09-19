import type {
  CreateDocumentInput,
  CreateNodeInput,
  CreatePageInput,
  CreateProjectInput,
  DesignDocument,
  DesignNode,
  DesignGraph,
  Page,
  PageGraph,
  Project,
} from '../domain/contracts.js'

export interface DesignRepository {
  createProject(project: Project): Promise<Project>
  getProject(id: string): Promise<Project | null>
  createDocument(document: DesignDocument): Promise<DesignDocument>
  getDocument(id: string): Promise<DesignDocument | null>
  createPage(page: Page): Promise<Page>
  getPage(id: string): Promise<Page | null>
  getPageGraph(id: string): Promise<PageGraph | null>
  createNode(node: DesignNode): Promise<DesignNode>
}

/**
 * Source for the richer canonical graph used by manifest compilation and the
 * graph-backed workspace boundary.
 */
export interface DesignGraphRepository {
  getDesignGraph(documentId: string): Promise<DesignGraph | null>
}

/**
 * Mutation boundary for the richer canonical graph. PostgreSQL stores the
 * complete aggregate snapshot until all rich entities have dedicated tables;
 * the in-memory implementation remains useful for isolated tests.
 */
export interface DesignGraphWriter {
  saveDesignGraph(graph: DesignGraph): Promise<DesignGraph>
}

export type RepositoryProjectInput = CreateProjectInput
export type RepositoryDocumentInput = CreateDocumentInput
export type RepositoryPageInput = CreatePageInput
export type RepositoryNodeInput = CreateNodeInput
