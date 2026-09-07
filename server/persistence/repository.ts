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
} from '../domain/contracts'

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
 * Source for the richer canonical graph used by manifest compilation.
 * Layer 1's relational repository does not implement this yet because its
 * schema only hydrates the initial page/node persistence slice.
 */
export interface DesignGraphRepository {
  getDesignGraph(documentId: string): Promise<DesignGraph | null>
}

/**
 * Mutation boundary for the richer canonical graph. The current PostgreSQL
 * repository intentionally does not implement this until full graph hydration
 * is available; the in-memory implementation supports the vertical slice.
 */
export interface DesignGraphWriter {
  saveDesignGraph(graph: DesignGraph): Promise<DesignGraph>
}

export type RepositoryProjectInput = CreateProjectInput
export type RepositoryDocumentInput = CreateDocumentInput
export type RepositoryPageInput = CreatePageInput
export type RepositoryNodeInput = CreateNodeInput
