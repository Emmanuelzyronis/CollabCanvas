import type { ImplementationStatusReport, SynchronizationProposal } from '../domain/synchronization-types'

export interface ImplementationStatusRepository {
  saveImplementationStatus(report: ImplementationStatusReport): Promise<ImplementationStatusReport>
  getImplementationStatus(id: string): Promise<ImplementationStatusReport | null>
  listImplementationStatus(projectId: string, documentId: string): Promise<ImplementationStatusReport[]>
}

export interface SynchronizationProposalRepository {
  saveSynchronizationProposal(proposal: SynchronizationProposal): Promise<SynchronizationProposal>
  getSynchronizationProposal(id: string): Promise<SynchronizationProposal | null>
  listSynchronizationProposals(projectId: string, documentId: string): Promise<SynchronizationProposal[]>
}

export type SynchronizationRepository = ImplementationStatusRepository & SynchronizationProposalRepository
