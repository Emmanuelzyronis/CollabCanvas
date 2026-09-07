import { DomainError } from '../domain/errors'
import type { CopilotContext, CopilotPlan, CopilotPlanner, CopilotRequest } from '../domain/copilot-types'
import type { DesignNode } from '../domain/contracts'
import type { DesignProposal, DesignVersion } from '../domain/version-types'
import type { VersioningApplicationService } from './version-service'

function requiredText(value: string, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new DomainError('VALIDATION_ERROR', `${field} must be a non-empty string.`)
  return value.trim()
}

function sortedNodes(nodes: readonly DesignNode[]): DesignNode[] {
  return [...nodes]
    .sort((a, b) => (a.id.localeCompare(b.id)))
    .map((node) => structuredClone(node))
}

/**
 * Application boundary for structured Copilot context and proposal creation.
 * A planner can be backed by any model later; this service only accepts typed
 * domain operations and routes them through the existing proposal validator.
 */
export class CopilotApplicationService {
  constructor(private readonly versioning: Pick<VersioningApplicationService, 'getVersion' | 'createProposal'>) {}

  async inspect(request: Omit<CopilotRequest, 'instruction' | 'author'>): Promise<CopilotContext> {
    const projectId = requiredText(request.projectId, 'projectId')
    const documentId = requiredText(request.documentId, 'documentId')
    const baseVersionId = requiredText(request.baseVersionId, 'baseVersionId')
    const version = await this.versioning.getVersion(baseVersionId)
    this.assertApprovedScope(version, projectId, documentId)

    const availableNodeIds = new Set(version.graph.nodes.map((node) => node.id))
    const selectedNodeIds = [...new Set(request.selectedNodeIds ?? [])].map((id) => requiredText(id, 'selectedNodeId')).sort()
    for (const nodeId of selectedNodeIds) {
      if (!availableNodeIds.has(nodeId)) throw new DomainError('INVALID_REFERENCE', `Selected node "${nodeId}" does not exist in the approved graph.`)
    }

    return {
      project: { id: version.graph.project.id, name: version.graph.project.name, slug: version.graph.project.slug },
      document: { id: version.graph.document.id, projectId: version.graph.document.projectId, name: version.graph.document.name },
      page: { id: version.graph.page.id, documentId: version.graph.page.documentId, name: version.graph.page.name, routeHint: version.graph.page.routeHint },
      baseVersionId: version.id,
      nodes: sortedNodes(version.graph.nodes),
      componentDefinitions: structuredClone([...version.graph.componentDefinitions].sort((a, b) => a.id.localeCompare(b.id))),
      componentInstances: structuredClone([...version.graph.componentInstances].sort((a, b) => a.id.localeCompare(b.id))),
      tokens: structuredClone([...version.graph.tokens].sort((a, b) => a.id.localeCompare(b.id))),
      typography: structuredClone([...version.graph.typography].sort((a, b) => a.id.localeCompare(b.id))),
      intents: structuredClone([...version.graph.intents].sort((a, b) => a.id.localeCompare(b.id))),
      selectedNodeIds,
    }
  }

  async propose(request: CopilotRequest, planner: CopilotPlanner): Promise<{ context: CopilotContext; plan: CopilotPlan; proposal: DesignProposal }> {
    const instruction = requiredText(request.instruction, 'instruction')
    const author = requiredText(request.author, 'author')
    const context = await this.inspect(request)
    const plan = await planner.plan(context, instruction)
    if (!plan || !Array.isArray(plan.operations)) throw new DomainError('PROPOSAL_INVALID', 'The Copilot planner did not return a valid operation list.')
    const rationale = requiredText(plan.rationale, 'rationale')
    if (plan.operations.length === 0) throw new DomainError('PROPOSAL_INVALID', 'The Copilot planner returned no design operations.')

    const proposal = await this.versioning.createProposal({
      projectId: context.project.id,
      documentId: context.document.id,
      baseVersionId: context.baseVersionId,
      operations: structuredClone(plan.operations),
      rationale,
      author,
    })
    return { context, plan: { operations: structuredClone(plan.operations), rationale }, proposal }
  }

  private assertApprovedScope(version: DesignVersion, projectId: string, documentId: string): void {
    if (version.status !== 'approved') throw new DomainError('VERSION_IMMUTABLE', 'Copilot proposals must target an approved design version.')
    if (version.projectId !== projectId || version.documentId !== documentId || version.graph.project.id !== projectId || version.graph.document.id !== documentId) {
      throw new DomainError('INVALID_REFERENCE', 'The base version is outside the requested project/document scope.')
    }
  }
}
