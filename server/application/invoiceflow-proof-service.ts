import type { AgentHandoff } from './agent-handoff-service'
import { AgentHandoffApplicationService } from './agent-handoff-service'
import { VersioningApplicationService, type VersionServiceDeps } from './version-service'
import { createInvoiceFlowGraph } from '../domain/fixtures/invoiceflow'
import type { DesignGraph, DesignNode, Project, DesignDocument, Page } from '../domain/contracts'
import type { DesignGraphRepository, DesignGraphWriter, DesignRepository } from '../persistence/repository'
import type { DesignVersion } from '../domain/version-types'
import type { VersionRepository } from '../persistence/version-repository'

export interface InvoiceFlowProofResult {
  readonly graph: DesignGraph
  readonly project: Project
  readonly document: DesignDocument
  readonly page: Page
  readonly draft: DesignVersion
  readonly approved: DesignVersion
  readonly handoff: AgentHandoff
}

export interface InvoiceFlowProofInput {
  readonly createdBy?: string
  readonly approvedBy?: string
}

type GraphStore = DesignGraphRepository & DesignGraphWriter

/**
 * Development/demo orchestration for the InvoiceFlow flagship proof.
 * It composes the existing repository, versioning, and handoff boundaries;
 * it does not add a second manifest or gateway path.
 */
export class InvoiceFlowProofApplicationService {
  private readonly versioning: VersioningApplicationService
  private readonly handoff: AgentHandoffApplicationService

  constructor(
    private readonly resources: DesignRepository,
    private readonly graphs: GraphStore,
    versions: VersionRepository,
    versionDeps: VersionServiceDeps = {},
  ) {
    this.versioning = new VersioningApplicationService(resources, graphs, versions, versionDeps)
    this.handoff = new AgentHandoffApplicationService(versions)
  }

  async run(input: InvoiceFlowProofInput = {}): Promise<InvoiceFlowProofResult> {
    const graph = createInvoiceFlowGraph()
    await this.provision(graph)

    const draft = await this.versioning.createDraft(graph.document.id, input.createdBy ?? 'invoiceflow-designer')
    const approved = await this.versioning.approveVersion(draft.id, input.approvedBy ?? 'invoiceflow-reviewer')
    const handoff = await this.handoff.getApprovedVersionHandoff(approved.id)

    return {
      graph,
      project: graph.project,
      document: graph.document,
      page: graph.page,
      draft,
      approved,
      handoff,
    }
  }

  private async provision(graph: DesignGraph): Promise<void> {
    const project = await this.resources.getProject(graph.project.id)
    if (!project) await this.resources.createProject(graph.project)

    const document = await this.resources.getDocument(graph.document.id)
    if (!document) await this.resources.createDocument(graph.document)

    const page = await this.resources.getPage(graph.page.id)
    if (!page) await this.resources.createPage(graph.page)

    const existingPageGraph = await this.resources.getPageGraph(graph.page.id)
    const existingNodeIds = new Set(existingPageGraph?.nodes.map((node: DesignNode) => node.id) ?? [])
    for (const node of graph.nodes) {
      if (!existingNodeIds.has(node.id)) await this.resources.createNode(node)
    }

    // The richer graph is available through the development graph repository.
    // PostgreSQL intentionally does not implement this writer until hydration
    // of all Layer 2 entities is available.
    await this.graphs.saveDesignGraph(graph)
  }
}
