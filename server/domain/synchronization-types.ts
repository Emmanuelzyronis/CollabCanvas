import type { SemanticChange, VersionComparison } from './version-types'

export const IMPLEMENTATION_STATUSES = [
  'connected',
  'reading_design',
  'implementing',
  'validating',
  'implemented',
  'drift_detected',
  'sync_proposed',
] as const

export type ImplementationStatus = (typeof IMPLEMENTATION_STATUSES)[number]

export interface ImplementationStatusReport {
  id: string
  projectId: string
  documentId: string
  designVersionId: string
  reportedBy: string
  repository: string
  branch?: string
  commit?: string
  environment?: string
  status: ImplementationStatus
  surfaces: string[]
  notes?: string
  reportedAt: string
}

/** Traceability identity from an approved design version to repository evidence. */
export type ImplementationLink = ImplementationStatusReport

export interface SynchronizationImpact {
  fromVersionId: string
  toVersionId: string
  fromHash: string
  toHash: string
  equivalent: boolean
  changes: SemanticChange[]
  affectedResourceIds: string[]
  affectedSemanticSurfaces: string[]
  implementationSurfaces: string[]
}

export type SynchronizationProposalStatus = 'pending'

export interface SynchronizationProposal {
  id: string
  projectId: string
  documentId: string
  fromVersionId: string
  toVersionId: string
  implementationReportId: string
  impact: SynchronizationImpact
  rationale: string
  createdBy: string
  createdAt: string
  status: SynchronizationProposalStatus
}

export function synchronizationImpact(comparison: VersionComparison, implementationSurfaces: readonly string[]): SynchronizationImpact {
  const affectedResourceIds = [...new Set(comparison.changes.map((change) => change.entityId))].sort()
  const affectedSemanticSurfaces = [...new Set(comparison.changes.map((change) => `${change.entityType}:${change.entityId}`))].sort()
  return {
    fromVersionId: comparison.fromVersionId,
    toVersionId: comparison.toVersionId,
    fromHash: comparison.fromHash,
    toHash: comparison.toHash,
    equivalent: comparison.equivalent,
    changes: structuredClone(comparison.changes),
    affectedResourceIds,
    affectedSemanticSurfaces,
    implementationSurfaces: [...new Set(implementationSurfaces)].sort(),
  }
}
