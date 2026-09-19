import { randomUUID } from 'node:crypto'
import type { DesignGraph } from '../domain/contracts.js'
import { DomainError } from '../domain/errors.js'
import { validateDesignGraph } from '../domain/graph-validation.js'
import { affectedResourceIds, applyDesignChangeOperations, compareDesignGraphs, hashDesignGraph, validateProposalOperations } from '../domain/versioning.js'
import type { DesignChangeOperation, DesignProposal, DesignVersion, VersionComparison } from '../domain/version-types.js'
import type { DesignGraphRepository, DesignGraphWriter, DesignRepository } from '../persistence/repository.js'
import type { VersionRepository } from '../persistence/version-repository.js'

export interface VersionServiceDeps {
  id?: () => string
  now?: () => string
}

export interface CreateProposalInput {
  projectId: string
  documentId: string
  baseVersionId: string
  operations: readonly DesignChangeOperation[]
  rationale: string
  author: string
}

export interface VersionMutationGuard {
  assertMutable(documentId: string): Promise<void>
}

function requiredText(value: string, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new DomainError('VALIDATION_ERROR', `${field} must be a non-empty string.`)
  return value.trim()
}

/** Version/proposal application boundary. Approved snapshots are never edited. */
export class VersioningApplicationService implements VersionMutationGuard {
  private readonly makeId: () => string
  private readonly timestamp: () => string

  constructor(
    private readonly resources: Pick<DesignRepository, 'getDocument'>,
    private readonly graphs: DesignGraphRepository & DesignGraphWriter,
    private readonly versions: VersionRepository,
    deps: VersionServiceDeps = {},
  ) {
    this.makeId = deps.id ?? randomUUID
    this.timestamp = deps.now ?? (() => new Date().toISOString())
  }

  async getVersion(id: string): Promise<DesignVersion> {
    const version = await this.versions.getVersion(requiredText(id, 'versionId'))
    if (!version) throw new DomainError('NOT_FOUND', `Design version "${id}" was not found.`)
    return version
  }

  async listVersions(documentId: string): Promise<DesignVersion[]> {
    const id = requiredText(documentId, 'documentId')
    return this.versions.listVersions(id)
  }

  async listWorkspaceVersions(projectId: string, documentId: string): Promise<DesignVersion[]> {
    const project = requiredText(projectId, 'projectId')
    const document = await this.requireScopedDocument(project, documentId)
    return this.versions.listVersions(document.id)
  }

  async getScopedProposal(projectId: string, documentId: string, proposalId: string): Promise<DesignProposal> {
    await this.requireScopedDocument(projectId, documentId)
    const proposal = await this.getProposal(proposalId)
    if (proposal.projectId !== projectId || proposal.documentId !== documentId) throw new DomainError('NOT_FOUND', `Design proposal "${proposalId}" was not found.`)
    return proposal
  }

  async createScopedDraft(projectId: string, documentId: string, createdBy: string): Promise<DesignVersion> {
    await this.requireScopedDocument(projectId, documentId)
    return this.createDraft(documentId, createdBy)
  }

  async approveScopedVersion(projectId: string, documentId: string, versionId: string, approvedBy: string): Promise<DesignVersion> {
    await this.requireScopedDocument(projectId, documentId)
    const version = await this.getVersion(versionId)
    if (version.projectId !== projectId || version.documentId !== documentId) throw new DomainError('NOT_FOUND', `Design version "${versionId}" was not found.`)
    return this.approveVersion(version.id, approvedBy)
  }

  async approveScopedProposal(projectId: string, documentId: string, proposalId: string, approvedBy: string): Promise<{ proposal: DesignProposal; version: DesignVersion }> {
    await this.getScopedProposal(projectId, documentId, proposalId)
    return this.approveProposal(proposalId, approvedBy)
  }

  async rejectScopedProposal(projectId: string, documentId: string, proposalId: string, rejectedBy: string): Promise<DesignProposal> {
    await this.getScopedProposal(projectId, documentId, proposalId)
    return this.rejectProposal(proposalId, rejectedBy)
  }

  async createDraft(documentId: string, createdBy: string): Promise<DesignVersion> {
    const id = requiredText(documentId, 'documentId')
    const author = requiredText(createdBy, 'createdBy')
    const document = await this.resources.getDocument(id)
    if (!document) throw new DomainError('NOT_FOUND', `Design document "${id}" was not found.`)
    const versions = await this.versions.listVersions(id)
    if (versions.some((version) => version.status === 'draft')) throw new DomainError('CONFLICT', 'A draft version already exists for this document.')
    const approved = this.latestApproved(versions)
    const graph = approved?.graph ?? await this.graphs.getDesignGraph(id)
    if (!graph) throw new DomainError('GRAPH_UNAVAILABLE', `The canonical design graph for document "${id}" is unavailable.`)
    this.assertGraphScope(graph, document.projectId, document.id)
    validateDesignGraph(graph)
    return this.versions.saveVersion(this.versionRecord(graph, document.projectId, id, versions.length ? Math.max(...versions.map((version) => version.number)) + 1 : 1, 'draft', author))
  }

  async approveVersion(versionId: string, approvedBy: string): Promise<DesignVersion> {
    const version = await this.getVersion(versionId)
    if (version.status !== 'draft') throw new DomainError('VERSION_IMMUTABLE', 'Only draft versions can be approved.')
    const reviewer = requiredText(approvedBy, 'approvedBy')
    validateDesignGraph(version.graph)
    return this.versions.updateVersion({ ...version, graph: structuredClone(version.graph), status: 'approved', approvedAt: this.timestamp(), approvedBy: reviewer })
  }

  async compareVersions(fromVersionId: string, toVersionId: string): Promise<VersionComparison> {
    const from = await this.getVersion(fromVersionId)
    const to = await this.getVersion(toVersionId)
    if (from.documentId !== to.documentId || from.projectId !== to.projectId) throw new DomainError('INVALID_REFERENCE', 'Versions must belong to the same document and project.')
    return compareDesignGraphs(from.graph, to.graph, from.id, to.id)
  }

  async createProposal(input: CreateProposalInput): Promise<DesignProposal> {
    const projectId = requiredText(input.projectId, 'projectId')
    const documentId = requiredText(input.documentId, 'documentId')
    const rationale = requiredText(input.rationale, 'rationale')
    const author = requiredText(input.author, 'author')
    const base = await this.getVersion(input.baseVersionId)
    const head = await this.getHeadVersion(documentId)
    if (base.projectId !== projectId || base.documentId !== documentId) throw new DomainError('INVALID_REFERENCE', 'The proposal base version is outside the requested project/document scope.')
    // A proposal targets the current working version: the active draft when the
    // design is being edited, otherwise the latest approved snapshot. Approved
    // snapshots are never mutated by the proposal itself.
    if (!head || head.id !== base.id) throw new DomainError('VERSION_CONFLICT', 'The proposal base version is not the current working version. Refresh the design and try again.')
    const operations = structuredClone([...input.operations])
    const validation = validateProposalOperations(base.graph, operations)
    const affected = affectedResourceIds(operations)
    return this.versions.saveProposal({ id: this.makeId(), projectId, documentId, baseVersionId: base.id, operations, affectedResourceIds: affected, rationale, author, validation, status: 'pending', createdAt: this.timestamp() })
  }

  async approveProposal(proposalId: string, approvedBy: string): Promise<{ proposal: DesignProposal; version: DesignVersion }> {
    const proposal = await this.getProposal(proposalId)
    if (proposal.status !== 'pending') throw new DomainError('PROPOSAL_INVALID', 'Only pending proposals can be approved.')
    if (!proposal.validation.valid) throw new DomainError('PROPOSAL_INVALID', 'The proposal contains invalid graph operations.', { issues: proposal.validation.issues })
    const base = await this.getVersion(proposal.baseVersionId)
    const head = await this.getHeadVersion(proposal.documentId)
    if (!head || head.id !== base.id) throw new DomainError('VERSION_CONFLICT', 'The proposal base version is stale; refresh the design and re-create the proposal.')
    // Re-validate against the base graph as it exists now: the working design may
    // have advanced since the proposal was drafted.
    const revalidation = validateProposalOperations(base.graph, proposal.operations)
    if (!revalidation.valid) throw new DomainError('PROPOSAL_INVALID', 'The proposal no longer applies to the current design.', { issues: revalidation.issues })
    const graph = applyDesignChangeOperations(base.graph, proposal.operations)
    await this.graphs.saveDesignGraph(graph)
    const reviewedBy = requiredText(approvedBy, 'approvedBy')
    if (base.status === 'draft') {
      // The working draft is mutable, so approval lands directly in it instead
      // of spawning a second draft for the same document.
      const updatedDraft = await this.versions.updateVersion({ ...base, graph: structuredClone(graph), graphHash: hashDesignGraph(graph) })
      const updatedProposal = await this.versions.updateProposal({ ...proposal, status: 'approved', reviewedAt: this.timestamp(), reviewedBy, resultingVersionId: updatedDraft.id })
      return { proposal: updatedProposal, version: updatedDraft }
    }
    const versions = await this.versions.listVersions(proposal.documentId)
    const draft = await this.versions.saveVersion(this.versionRecord(graph, proposal.projectId, proposal.documentId, Math.max(...versions.map((version) => version.number), 0) + 1, 'draft', reviewedBy))
    const updated = await this.versions.updateProposal({ ...proposal, status: 'approved', reviewedAt: this.timestamp(), reviewedBy, resultingVersionId: draft.id })
    return { proposal: updated, version: draft }
  }

  async rejectProposal(proposalId: string, rejectedBy: string): Promise<DesignProposal> {
    const proposal = await this.getProposal(proposalId)
    if (proposal.status !== 'pending') throw new DomainError('PROPOSAL_INVALID', 'Only pending proposals can be rejected.')
    return this.versions.updateProposal({ ...proposal, status: 'rejected', reviewedAt: this.timestamp(), reviewedBy: requiredText(rejectedBy, 'rejectedBy') })
  }

  async assertMutable(documentId: string): Promise<void> {
    const versions = await this.versions.listVersions(requiredText(documentId, 'documentId'))
    if (this.latestApproved(versions) && !versions.some((version) => version.status === 'draft')) {
      throw new DomainError('APPROVAL_REQUIRED', 'Approved design state is immutable; create or approve a draft before mutating it.')
    }
  }

  /**
   * The version an editor mutation is based on: the active draft when one
   * exists, otherwise the latest approved version, otherwise null for a
   * document that has never been versioned.
   */
  async getHeadVersion(documentId: string): Promise<DesignVersion | null> {
    const versions = await this.versions.listVersions(requiredText(documentId, 'documentId'))
    const draft = versions.find((version) => version.status === 'draft')
    if (draft) return draft
    return this.latestApproved(versions) ?? null
  }

  async recordDraftGraph(graph: DesignGraph): Promise<void> {
    const versions = await this.versions.listVersions(graph.document.id)
    const draft = versions.find((version) => version.status === 'draft')
    if (!draft) return
    if (draft.projectId !== graph.project.id) throw new DomainError('GRAPH_UNAVAILABLE', 'The draft graph does not match its project scope.')
    await this.versions.updateVersion({ ...draft, graph: structuredClone(graph), graphHash: hashDesignGraph(graph) })
  }

  private async getProposal(id: string): Promise<DesignProposal> {
    const proposal = await this.versions.getProposal(requiredText(id, 'proposalId'))
    if (!proposal) throw new DomainError('NOT_FOUND', `Design proposal "${id}" was not found.`)
    return proposal
  }

  private async requireScopedDocument(projectId: string, documentId: string) {
    const project = requiredText(projectId, 'projectId')
    const document = await this.resources.getDocument(requiredText(documentId, 'documentId'))
    if (!document || document.projectId !== project) throw new DomainError('NOT_FOUND', 'The requested document does not belong to the requested project.')
    return document
  }

  private latestApproved(versions: DesignVersion[]): DesignVersion | undefined {
    return versions.filter((version) => version.status === 'approved').sort((a, b) => b.number - a.number || b.id.localeCompare(a.id))[0]
  }

  private assertGraphScope(graph: DesignGraph, projectId: string, documentId: string): void {
    if (graph.project.id !== projectId || graph.document.id !== documentId || graph.document.projectId !== projectId) throw new DomainError('GRAPH_UNAVAILABLE', 'The canonical graph does not match the requested document.')
  }

  private versionRecord(graph: DesignGraph, projectId: string, documentId: string, number: number, status: DesignVersion['status'], createdBy: string): DesignVersion {
    return { id: this.makeId(), projectId, documentId, number, status, graph: structuredClone(graph), graphHash: hashDesignGraph(graph), createdAt: this.timestamp(), createdBy }
  }
}
