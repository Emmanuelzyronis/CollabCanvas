import type { DesignGraph } from './contracts'

export type DesignVersionStatus = 'draft' | 'approved'

export interface DesignVersion {
  id: string
  projectId: string
  documentId: string
  number: number
  status: DesignVersionStatus
  graph: DesignGraph
  graphHash: string
  createdAt: string
  createdBy: string
  approvedAt?: string
  approvedBy?: string
}

export type DesignChangeOperation =
  | { type: 'moveNode'; nodeId: string; parentId: string | null; orderIndex?: number }
  | { type: 'deleteNode'; nodeId: string }

export interface ProposalValidationIssue {
  code: string
  path: string
  message: string
}

export interface ProposalValidation {
  valid: boolean
  issues: ProposalValidationIssue[]
}

export type DesignProposalStatus = 'pending' | 'approved' | 'rejected'

export interface DesignProposal {
  id: string
  projectId: string
  documentId: string
  baseVersionId: string
  operations: DesignChangeOperation[]
  affectedResourceIds: string[]
  rationale: string
  author: string
  validation: ProposalValidation
  status: DesignProposalStatus
  createdAt: string
  reviewedAt?: string
  reviewedBy?: string
  resultingVersionId?: string
}

export type SemanticChangeKind = 'added' | 'removed' | 'updated'
export type SemanticEntityType = 'project' | 'document' | 'page' | 'node' | 'componentDefinition' | 'componentInstance' | 'token' | 'typography' | 'asset' | 'intent'

export interface SemanticChange {
  entityType: SemanticEntityType
  entityId: string
  kind: SemanticChangeKind
}

export interface VersionComparison {
  fromVersionId: string
  toVersionId: string
  fromHash: string
  toHash: string
  equivalent: boolean
  changes: SemanticChange[]
}
