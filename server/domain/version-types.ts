import type { CreateNodeInput, DesignGraph, JsonObject, LayoutConstraints, NodeSemantic } from './contracts.js'

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

/**
 * A node a proposal wants to create.
 *
 * `key` is proposal-scoped, not canonical identity: operations inside one
 * proposal reference each other by key, and real node ids are minted when the
 * proposal is applied. A proposal can therefore never dictate canonical
 * identity, and the same plan always resolves to the same structure.
 */
export interface ProposedNode {
  key: string
  parentKey?: string | null
  parentId?: string | null
  orderIndex?: number
  node: Omit<CreateNodeInput, 'parentId' | 'orderIndex'>
}

/**
 * A structural refinement of an existing node. Refinements change layout or
 * presentation (spacing, alignment, colour, text); they never introduce new
 * identity and never bypass the canonical node model.
 */
export interface ProposedNodeUpdate {
  name?: string
  layout?: LayoutConstraints
  properties?: JsonObject
  semantic?: NodeSemantic
}

export type DesignChangeOperation =
  | { type: 'moveNode'; nodeId: string; parentId: string | null; orderIndex?: number }
  | { type: 'deleteNode'; nodeId: string }
  | { type: 'updateNode'; nodeId: string; patch: ProposedNodeUpdate }
  | ({ type: 'createNode' } & ProposedNode)

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

/** A deterministic field-level explanation of an entity change for semantic diff consumers. */
export interface SemanticFieldChange extends SemanticChange {
  path: string
  before?: unknown
  after?: unknown
}

export interface VersionComparison {
  fromVersionId: string
  toVersionId: string
  fromHash: string
  toHash: string
  equivalent: boolean
  changes: SemanticChange[]
  fieldChanges: SemanticFieldChange[]
}
