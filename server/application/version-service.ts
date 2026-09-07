import { randomUUID } from 'node:crypto'
import type { DesignGraph } from '../domain/contracts'
import { DomainError } from '../domain/errors'
import { validateDesignGraph } from '../domain/graph-validation'
import { applyDesignChangeOperations, compareDesignGraphs, hashDesignGraph, validateProposalOperations } from '../domain/versioning'
import type { DesignChangeOperation, DesignProposal, DesignVersion, VersionComparison } from '../domain/version-types'
import type { DesignGraphRepository, DesignGraphWriter, DesignRepository } from '../persistence/repository'
import type { VersionRepository } from '../persistence/version-repository'

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
    const versions = await this.versions.listVersions(documentId)
    const current = this.latestApproved(versions)
    if (base.projectId !== projectId || base.documentId !== documentId) throw new DomainError('INVALID_REFERENCE', 'The proposal base version is outside the requested project/document scope.')
    if (base.status !== 'approved' || !current || current.id !== base.id) throw new DomainError('VERSION_CONFLICT', 'The proposal base version is not the current approved version.')
    const operations = structuredClone([...input.operations])
    const validation = validateProposalOperations(base.graph, operations)
    const affectedResourceIds = [...new Set(operations.flatMap((operation) => [operation.nodeId]))].sort()
    return this.versions.saveProposal({ id: this.makeId(), projectId, documentId, baseVersionId: base.id, operations, affectedResourceIds, rationale, author, validation, status: 'pending', createdAt: this.timestamp() })
  }

  async approveProposal(proposalId: string, approvedBy: string): Promise<{ proposal: DesignProposal; version: DesignVersion }> {
    const proposal = await this.getProposal(proposalId)
    if (proposal.status !== 'pending') throw new DomainError('PROPOSAL_INVALID', 'Only pending proposals can be approved.')
    if (!proposal.validation.valid) throw new DomainError('PROPOSAL_INVALID', 'The proposal contains invalid graph operations.', { issues: proposal.validation.issues })
    const base = await this.getVersion(proposal.baseVersionId)
    const versions = await this.versions.listVersions(proposal.documentId)
    const current = this.latestApproved(versions)
    if (!current || current.id !== base.id) throw new DomainError('VERSION_CONFLICT', 'The proposal base version is stale.')
    const graph = applyDesignChangeOperations(base.graph, proposal.operations)
    await this.graphs.saveDesignGraph(graph)
    const draft = await this.versions.saveVersion(this.versionRecord(graph, proposal.projectId, proposal.documentId, Math.max(...versions.map((version) => version.number), 0) + 1, 'draft', approvedBy))
    const updated = await this.versions.updateProposal({ ...proposal, status: 'approved', reviewedAt: this.timestamp(), reviewedBy: requiredText(approvedBy, 'approvedBy'), resultingVersionId: draft.id })
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
