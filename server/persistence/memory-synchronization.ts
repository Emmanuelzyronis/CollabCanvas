import type { ImplementationStatusReport, SynchronizationProposal } from '../domain/synchronization-types.js'
import type { SynchronizationRepository } from './synchronization-repository.js'

/** Development repository; durable implementation linkage is a later persistence slice. */
export class MemorySynchronizationRepository implements SynchronizationRepository {
  private readonly reports = new Map<string, ImplementationStatusReport>()
  private readonly proposals = new Map<string, SynchronizationProposal>()

  async saveImplementationStatus(report: ImplementationStatusReport): Promise<ImplementationStatusReport> {
    const stored = structuredClone(report)
    this.reports.set(report.id, stored)
    return structuredClone(stored)
  }

  async getImplementationStatus(id: string): Promise<ImplementationStatusReport | null> {
    const report = this.reports.get(id)
    return report ? structuredClone(report) : null
  }

  async listImplementationStatus(projectId: string, documentId: string): Promise<ImplementationStatusReport[]> {
    return [...this.reports.values()]
      .filter((report) => report.projectId === projectId && report.documentId === documentId)
      .sort((a, b) => a.reportedAt.localeCompare(b.reportedAt) || a.id.localeCompare(b.id))
      .map((report) => structuredClone(report))
  }

  async saveSynchronizationProposal(proposal: SynchronizationProposal): Promise<SynchronizationProposal> {
    const stored = structuredClone(proposal)
    this.proposals.set(proposal.id, stored)
    return structuredClone(stored)
  }

  async getSynchronizationProposal(id: string): Promise<SynchronizationProposal | null> {
    const proposal = this.proposals.get(id)
    return proposal ? structuredClone(proposal) : null
  }

  async listSynchronizationProposals(projectId: string, documentId: string): Promise<SynchronizationProposal[]> {
    return [...this.proposals.values()]
      .filter((proposal) => proposal.projectId === projectId && proposal.documentId === documentId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
      .map((proposal) => structuredClone(proposal))
  }
}
