import { DomainError } from '../domain/errors'
import type { DesignRepository } from './repository'
import type { DesignDocument, DesignNode, Page, PageGraph, Project } from '../domain/contracts'

/** Isolated repository used by unit/API tests; production uses PostgresRepository. */
export class MemoryDesignRepository implements DesignRepository {
  private readonly projects = new Map<string, Project>()
  private readonly documents = new Map<string, DesignDocument>()
  private readonly pages = new Map<string, Page>()
  private readonly nodes = new Map<string, DesignNode>()

  async createProject(project: Project): Promise<Project> {
    if ([...this.projects.values()].some((existing) => existing.slug === project.slug)) {
      throw new DomainError('CONFLICT', `Project slug "${project.slug}" is already in use.`)
    }
    this.projects.set(project.id, project)
    return project
  }

  async getProject(id: string) { return this.projects.get(id) ?? null }

  async createDocument(document: DesignDocument): Promise<DesignDocument> {
    if (!this.projects.has(document.projectId)) throw new DomainError('NOT_FOUND', `Project "${document.projectId}" was not found.`)
    this.documents.set(document.id, document)
    return document
  }

  async getDocument(id: string) { return this.documents.get(id) ?? null }

  async createPage(page: Page): Promise<Page> {
    if (!this.documents.has(page.documentId)) throw new DomainError('NOT_FOUND', `Design document "${page.documentId}" was not found.`)
    this.pages.set(page.id, page)
    return page
  }

  async getPage(id: string) { return this.pages.get(id) ?? null }

  async getPageGraph(id: string): Promise<PageGraph | null> {
    const page = await this.getPage(id)
    if (!page) return null
    return { page, nodes: [...this.nodes.values()].filter((node) => node.pageId === id) }
  }

  async createNode(node: DesignNode): Promise<DesignNode> {
    if (!this.pages.has(node.pageId)) throw new DomainError('NOT_FOUND', `Page "${node.pageId}" was not found.`)
    if (node.parentId && !this.nodes.has(node.parentId)) throw new DomainError('INVALID_REFERENCE', `Parent node "${node.parentId}" was not found.`)
    if (node.parentId && this.nodes.get(node.parentId)?.pageId !== node.pageId) {
      throw new DomainError('INVALID_REFERENCE', `Parent node "${node.parentId}" belongs to another page.`)
    }
    this.nodes.set(node.id, node)
    return node
  }
}
