import { randomUUID } from 'node:crypto'
import type { DesignVersion, VersionComparison } from '../domain/version-types.js'
import { DomainError } from '../domain/errors.js'
import { IMPLEMENTATION_STATUSES, synchronizationImpact, type ImplementationStatus, type ImplementationStatusReport, type SynchronizationProposal } from '../domain/synchronization-types.js'
import type { ImplementationStatusRepository, SynchronizationProposalRepository } from '../persistence/synchronization-repository.js'

export interface ReportImplementationStatusInput {
  projectId: string
  documentId: string
  designVersionId: string
  reportedBy: string
  repository: string
  branch?: string
  commit?: string
  environment?: string
  status: ImplementationStatus
  surfaces?: readonly string[]
  notes?: string
}

export interface CreateSynchronizationProposalInput {
  projectId: string
  documentId: string
  fromVersionId: string
  toVersionId: string
  implementationReportId: string
  rationale: string
  createdBy: string
}

export interface SynchronizationServiceDeps {
  id?: () => string
  now?: () => string
}

interface VersionReader {
  getVersion(id: string): Promise<DesignVersion>
  compareVersions(fromVersionId: string, toVersionId: string): Promise<VersionComparison>
}

function requiredText(value: string, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new DomainError('VALIDATION_ERROR', `${field} must be a non-empty string.`)
  return value.trim()
}

function optionalText(value: string | undefined, field: string): string | undefined {
  if (value === undefined) return undefined
  return requiredText(value, field)
}

function normalizedList(values: readonly string[] | undefined, field: string): string[] {
  return [...new Set((values ?? []).map((value) => requiredText(value, field)))].sort()
}

/** Application boundary for implementation evidence and non-mutating sync proposals. */
export class SynchronizationApplicationService {
  private readonly makeId: () => string
  private readonly timestamp: () => string

  constructor(
    private readonly versions: VersionReader,
    private readonly reports: ImplementationStatusRepository,
    private readonly proposals: SynchronizationProposalRepository,
    deps: SynchronizationServiceDeps = {},
  ) {
    this.makeId = deps.id ?? randomUUID
    this.timestamp = deps.now ?? (() => new Date().toISOString())
  }

  async reportImplementationStatus(input: ReportImplementationStatusInput): Promise<ImplementationStatusReport> {
    const projectId = requiredText(input.projectId, 'projectId')
    const documentId = requiredText(input.documentId, 'documentId')
    const reportedBy = requiredText(input.reportedBy, 'reportedBy')
    const repository = requiredText(input.repository, 'repository')
    const status = input.status
    if (!IMPLEMENTATION_STATUSES.includes(status)) throw new DomainError('VALIDATION_ERROR', `Unknown implementation status "${String(status)}".`)

    const version = await this.versions.getVersion(requiredText(input.designVersionId, 'designVersionId'))
    this.assertApprovedScope(version, projectId, documentId)
    const report: ImplementationStatusReport = {
      id: this.makeId(),
      projectId,
      documentId,
      designVersionId: version.id,
      reportedBy,
      repository,
      ...(optionalText(input.branch, 'branch') ? { branch: optionalText(input.branch, 'branch') } : {}),
      ...(optionalText(input.commit, 'commit') ? { commit: optionalText(input.commit, 'commit') } : {}),
      ...(optionalText(input.environment, 'environment') ? { environment: optionalText(input.environment, 'environment') } : {}),
      status,
      surfaces: normalizedList(input.surfaces, 'surface'),
      ...(optionalText(input.notes, 'notes') ? { notes: optionalText(input.notes, 'notes') } : {}),
      reportedAt: this.timestamp(),
    }
    return this.reports.saveImplementationStatus(report)
  }

  async getImplementationStatus(id: string): Promise<ImplementationStatusReport> {
    const report = await this.reports.getImplementationStatus(requiredText(id, 'implementationReportId'))
    if (!report) throw new DomainError('NOT_FOUND', `Implementation status "${id}" was not found.`)
    return report
  }

  async compareApprovedVersions(fromVersionId: string, toVersionId: string): Promise<ReturnType<typeof synchronizationImpact>> {
    const from = await this.versions.getVersion(requiredText(fromVersionId, 'fromVersionId'))
    const to = await this.versions.getVersion(requiredText(toVersionId, 'toVersionId'))
    this.assertApprovedScope(from, from.projectId, from.documentId)
    this.assertApprovedScope(to, from.projectId, from.documentId)
    const comparison = await this.versions.compareVersions(from.id, to.id)
    return synchronizationImpact(comparison, [])
  }

  async proposeSynchronization(input: CreateSynchronizationProposalInput): Promise<SynchronizationProposal> {
    const projectId = requiredText(input.projectId, 'projectId')
    const documentId = requiredText(input.documentId, 'documentId')
    const from = await this.versions.getVersion(requiredText(input.fromVersionId, 'fromVersionId'))
    const to = await this.versions.getVersion(requiredText(input.toVersionId, 'toVersionId'))
    this.assertApprovedScope(from, projectId, documentId)
    this.assertApprovedScope(to, projectId, documentId)

    const report = await this.getImplementationStatus(input.implementationReportId)
    if (report.projectId !== projectId || report.documentId !== documentId || report.designVersionId !== from.id) {
      throw new DomainError('INVALID_REFERENCE', 'The implementation report does not belong to the requested project, document, and base version.')
    }
    if (report.status !== 'implemented' && report.status !== 'drift_detected') {
      throw new DomainError('CONFLICT', 'Synchronization requires implemented or drift-detected evidence for the base version.')
    }
    const comparison = await this.versions.compareVersions(from.id, to.id)
    if (comparison.equivalent) throw new DomainError('CONFLICT', 'A synchronization proposal requires a semantic design change.')

    const proposal: SynchronizationProposal = {
      id: this.makeId(),
      projectId,
      documentId,
      fromVersionId: from.id,
      toVersionId: to.id,
      implementationReportId: report.id,
      impact: synchronizationImpact(comparison, report.surfaces),
      rationale: requiredText(input.rationale, 'rationale'),
      createdBy: requiredText(input.createdBy, 'createdBy'),
      createdAt: this.timestamp(),
      status: 'pending',
    }
    return this.proposals.saveSynchronizationProposal(proposal)
  }

  private assertApprovedScope(version: DesignVersion, projectId: string, documentId: string): void {
    if (version.status !== 'approved') throw new DomainError('VERSION_IMMUTABLE', 'Implementation linkage requires an approved design version.')
    if (version.projectId !== projectId || version.documentId !== documentId || version.graph.project.id !== projectId || version.graph.document.id !== documentId) {
      throw new DomainError('INVALID_REFERENCE', 'The design version is outside the requested project/document scope.')
    }
  }
}
