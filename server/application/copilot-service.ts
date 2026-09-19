import { DomainError } from '../domain/errors.js'
import type { CopilotContext, CopilotPlan, CopilotPlanner, CopilotProposalPreview, CopilotRequest } from '../domain/copilot-types.js'
import { affectedResourceIds, validateProposalOperations } from '../domain/versioning.js'
import type { DesignNode } from '../domain/contracts.js'
import type { DesignProposal, DesignVersion } from '../domain/version-types.js'
import type { VersioningApplicationService } from './version-service.js'

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
  constructor(private readonly versioning: Pick<VersioningApplicationService, 'getVersion' | 'getHeadVersion' | 'createProposal'>) {}

  async inspect(request: Omit<CopilotRequest, 'instruction' | 'author'>): Promise<CopilotContext> {
    const projectId = requiredText(request.projectId, 'projectId')
    const documentId = requiredText(request.documentId, 'documentId')
    const baseVersionId = requiredText(request.baseVersionId, 'baseVersionId')
    if (request.trustedVersionId !== undefined && requiredText(request.trustedVersionId, 'trustedVersionId') !== baseVersionId) {
      throw new DomainError('VERSION_CONFLICT', 'The workspace trusted version does not match the requested proposal base. Refresh the workspace and try again.')
    }
    const version = await this.versioning.getVersion(baseVersionId)
    await this.assertWorkingScope(version, projectId, documentId)
    if (request.pageId && version.graph.page.id !== requiredText(request.pageId, 'pageId')) throw new DomainError('INVALID_REFERENCE', 'The base version is outside the requested page scope.')

    const availableNodeIds = new Set(version.graph.nodes.map((node) => node.id))
    const selectedNodeIds = [...new Set(request.selectedNodeIds ?? [])].map((id) => requiredText(id, 'selectedNodeId')).sort()
    for (const nodeId of selectedNodeIds) {
      if (!availableNodeIds.has(nodeId)) throw new DomainError('INVALID_REFERENCE', `Selected node "${nodeId}" does not exist in the current design.`)
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

  async generate(request: CopilotRequest, planner: CopilotPlanner): Promise<CopilotProposalPreview> {
    const instruction = requiredText(request.instruction, 'instruction')
    const author = requiredText(request.author, 'author')
    const context = await this.inspect(request)
    const plan = await planner.plan(context, instruction)
    if (!plan || !Array.isArray(plan.operations)) throw new DomainError('PROPOSAL_INVALID', 'The Copilot planner did not return a valid operation list.')
    const operations = structuredClone(plan.operations)
    const rationale = requiredText(plan.rationale, 'rationale')
    const affected = affectedResourceIds(operations)
    const baseVersion = await this.versioning.getVersion(context.baseVersionId)
    const checked = validateProposalOperations(baseVersion.graph, operations)
    const summary = instruction.length > 120 ? `${instruction.slice(0, 117)}...` : instruction
    if (!operations.length || !checked.valid) return { status: 'clarification', projectId: context.project.id, documentId: context.document.id, pageId: context.page.id, baseVersionId: context.baseVersionId, summary, rationale, operations, affectedResourceIds: affected, validation: checked, clarification: !operations.length ? 'Tell me what to change — for example, move a layer inside another, or remove one.' : "I couldn't turn that into a safe change. Try rephrasing it." }
    const proposal = await this.versioning.createProposal({ projectId: context.project.id, documentId: context.document.id, baseVersionId: context.baseVersionId, operations, rationale, author })
    return { status: 'ready', projectId: context.project.id, documentId: context.document.id, pageId: context.page.id, baseVersionId: context.baseVersionId, summary, rationale, operations, affectedResourceIds: proposal.affectedResourceIds, validation: proposal.validation, proposal }
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

  /**
   * Assistant suggestions are grounded in the design the user is actually
   * working on: the active draft, or the latest approved snapshot when there is
   * no draft. This keeps AI assistance usable during first-time editing without
   * ever mutating an approved snapshot.
   */
  private async assertWorkingScope(version: DesignVersion, projectId: string, documentId: string): Promise<void> {
    if (version.projectId !== projectId || version.documentId !== documentId || version.graph.project.id !== projectId || version.graph.document.id !== documentId) {
      throw new DomainError('INVALID_REFERENCE', 'The base version is outside the requested project/document scope.')
    }
    const head = await this.versioning.getHeadVersion(documentId)
    if (!head || head.id !== version.id) throw new DomainError('VERSION_CONFLICT', 'The base version is not the current working design. Refresh the design and try again.')
  }
}
