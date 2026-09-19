import type { DesignManifest } from '../domain/manifest-types.js'
import type { ImplementationStatus, ImplementationStatusReport, SynchronizationProposal } from '../domain/synchronization-types.js'

export const GATEWAY_CAPABILITIES = ['READ_MANIFEST', 'READ_VERSION', 'REPORT_IMPLEMENTATION_STATUS', 'PROPOSE_SYNC'] as const
export type GatewayCapability = (typeof GATEWAY_CAPABILITIES)[number]

export interface AgentIdentity {
  id: string
  label?: string
}

export interface ProjectScope {
  projectIds: readonly string[]
}

export interface AgentCredentialReference {
  id: string
}

export interface AuthenticatedAgent {
  identity: AgentIdentity
  credentialId: AgentCredentialReference['id']
  scope: ProjectScope
  capabilities: readonly GatewayCapability[]
}

export interface GatewayRequest {
  requestId: string
  credential: string | undefined
  projectId: string
  documentId: string
  capability: GatewayCapability
}

export interface GatewayApprovedVersionRequest {
  requestId: string
  credential: string | undefined
  projectId: string
  documentId: string
  versionId: string
  capability: 'READ_VERSION'
}

export interface GatewayImplementationStatusRequest {
  requestId: string
  credential: string | undefined
  projectId: string
  documentId: string
  designVersionId: string
  repository: string
  branch?: string
  commit?: string
  environment?: string
  status: ImplementationStatus
  surfaces?: readonly string[]
  notes?: string
  capability: 'REPORT_IMPLEMENTATION_STATUS'
}

export interface GatewaySynchronizationProposalRequest {
  requestId: string
  credential: string | undefined
  projectId: string
  documentId: string
  fromVersionId: string
  toVersionId: string
  implementationReportId: string
  rationale: string
  capability: 'PROPOSE_SYNC'
}

export type AuditOutcome = 'succeeded' | 'denied' | 'failed'
export type GatewayOperation = 'READ_MANIFEST' | 'READ_APPROVED_VERSION' | 'REPORT_IMPLEMENTATION_STATUS' | 'PROPOSE_SYNC'

export interface AuditContext {
  readonly requestId: string
  readonly agentId: string | null
  readonly projectId: string
  readonly capability: GatewayCapability
  readonly operation: GatewayOperation
  readonly outcome: AuditOutcome
}

export interface GatewayResponse<T> {
  readonly data: T
  readonly auditContext: AuditContext
}

export type GatewayErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIAL'
  | 'PROJECT_SCOPE_DENIED'
  | 'CAPABILITY_DENIED'
  | 'RESOURCE_NOT_FOUND'
  | 'UPSTREAM_APPLICATION_ERROR'
  | 'RATE_LIMITED'
  | 'INVALID_REQUEST'

export class GatewayError extends Error {
  constructor(
    public readonly code: GatewayErrorCode,
    message: string,
    public readonly auditContext: AuditContext,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'GatewayError'
  }
}

export type GatewayManifestResponse = GatewayResponse<DesignManifest>
export type GatewayImplementationStatusResponse = GatewayResponse<ImplementationStatusReport>
export type GatewaySynchronizationProposalResponse = GatewayResponse<SynchronizationProposal>
