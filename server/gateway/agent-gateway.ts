import type { AgentHandoff } from '../application/agent-handoff-service'
import type { ManifestApplication } from '../application/manifest-service'
import type { SynchronizationApplicationService } from '../application/synchronization-service'
import { DomainError } from '../domain/errors'
import type { DesignManifest } from '../domain/manifest-types'
import {
  GATEWAY_CAPABILITIES,
  GatewayError,
  type GatewayErrorCode,
  type AgentIdentity,
  type AuditContext,
  type GatewayApprovedVersionRequest,
  type GatewayImplementationStatusRequest,
  type GatewayManifestResponse,
  type GatewayRequest,
  type GatewayResponse,
  type GatewaySynchronizationProposalRequest,
  type GatewayImplementationStatusResponse,
  type GatewaySynchronizationProposalResponse,
} from './contracts'
import type { GatewayAuthenticator } from './auth'
import { createAuditEvent, type GatewayHardeningOptions } from './hardening'

function createAuditContext(request: GatewayRequest | GatewayApprovedVersionRequest, agentId: string | null, outcome: AuditContext['outcome'], operation: AuditContext['operation']): AuditContext {
  return Object.freeze({
    requestId: request.requestId,
    agentId,
    projectId: request.projectId,
    capability: request.capability,
    operation,
    outcome,
  })
}

function requiredRequestValue(value: string, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${field} is required.`)
  return value.trim()
}

/** Policy boundary above application services; it has no repository/compiler dependency. */
export class AgentGateway {
  constructor(
    private readonly authenticator: GatewayAuthenticator,
    private readonly application: ManifestApplication,
    private readonly handoff?: { getApprovedVersionHandoff(versionId: string): Promise<AgentHandoff> },
    private readonly synchronization?: Pick<SynchronizationApplicationService, 'reportImplementationStatus' | 'proposeSynchronization'>,
    private readonly hardening: GatewayHardeningOptions = {},
  ) {}

  async readManifest(request: GatewayRequest): Promise<GatewayManifestResponse> {
    const baseAudit = createAuditContext(request, null, 'denied', 'READ_MANIFEST')
    let agent: { identity: AgentIdentity } | undefined
    try {
      requiredRequestValue(request.requestId, 'requestId')
      requiredRequestValue(request.projectId, 'projectId')
      requiredRequestValue(request.documentId, 'documentId')
      if (request.capability !== 'READ_MANIFEST' || !GATEWAY_CAPABILITIES.includes(request.capability)) {
        throw new GatewayError('CAPABILITY_DENIED', 'The requested gateway capability is not granted.', baseAudit)
      }

      const authenticated = await this.authenticator.authenticate(request.credential, baseAudit)
      agent = authenticated
      const authenticatedAudit = createAuditContext(request, authenticated.identity.id, 'denied', 'READ_MANIFEST')
      this.enforceRateLimit(authenticated.identity.id, request.projectId, 'READ_MANIFEST', authenticatedAudit)
      if (!authenticated.scope.projectIds.includes(request.projectId)) {
        throw new GatewayError('PROJECT_SCOPE_DENIED', 'The agent is not scoped to the requested project.', authenticatedAudit)
      }
      if (!authenticated.capabilities.includes(request.capability)) {
        throw new GatewayError('CAPABILITY_DENIED', 'The agent is not granted the requested capability.', authenticatedAudit)
      }

      let manifest: DesignManifest
      try {
        manifest = await this.application.getDocumentManifest(request.documentId)
      } catch (error) {
        if (error instanceof DomainError && error.code === 'NOT_FOUND') {
          throw new GatewayError('RESOURCE_NOT_FOUND', 'The requested manifest resource was not found.', authenticatedAudit)
        }
        throw new GatewayError('UPSTREAM_APPLICATION_ERROR', 'The manifest application service failed.', createAuditContext(request, authenticated.identity.id, 'failed', 'READ_MANIFEST'))
      }

      if (manifest.project.id !== request.projectId || manifest.document.id !== request.documentId) {
        throw new GatewayError('RESOURCE_NOT_FOUND', 'The requested document is not part of the scoped project.', authenticatedAudit)
      }

      const successAudit = createAuditContext(request, authenticated.identity.id, 'succeeded', 'READ_MANIFEST')
      this.recordAudit(successAudit)
      return { data: manifest, auditContext: successAudit }
    } catch (error) {
      if (error instanceof GatewayError) {
        const context = error.auditContext.agentId || !agent ? error.auditContext : createAuditContext(request, agent.identity.id, 'denied', 'READ_MANIFEST')
        const gatewayError = new GatewayError(error.code, error.message, context, error.details)
        this.recordAudit(context, error.code)
        throw gatewayError
      }
      const gatewayError = new GatewayError('INVALID_REQUEST', error instanceof Error ? error.message : 'Invalid gateway request.', createAuditContext(request, agent?.identity.id ?? null, 'denied', 'READ_MANIFEST'))
      this.recordAudit(gatewayError.auditContext, gatewayError.code)
      throw gatewayError
    }
  }

  async readApprovedVersion(request: GatewayApprovedVersionRequest): Promise<GatewayResponse<AgentHandoff>> {
    const baseAudit = createAuditContext(request, null, 'denied', 'READ_APPROVED_VERSION')
    let agent: { identity: AgentIdentity } | undefined
    try {
      requiredRequestValue(request.requestId, 'requestId')
      requiredRequestValue(request.projectId, 'projectId')
      requiredRequestValue(request.documentId, 'documentId')
      requiredRequestValue(request.versionId, 'versionId')
      if (request.capability !== 'READ_VERSION' || !GATEWAY_CAPABILITIES.includes(request.capability)) {
        throw new GatewayError('CAPABILITY_DENIED', 'The requested gateway capability is not granted.', baseAudit)
      }

      const authenticated = await this.authenticator.authenticate(request.credential, baseAudit)
      agent = authenticated
      const authenticatedAudit = createAuditContext(request, authenticated.identity.id, 'denied', 'READ_APPROVED_VERSION')
      this.enforceRateLimit(authenticated.identity.id, request.projectId, 'READ_APPROVED_VERSION', authenticatedAudit)
      if (!authenticated.scope.projectIds.includes(request.projectId)) throw new GatewayError('PROJECT_SCOPE_DENIED', 'The agent is not scoped to the requested project.', authenticatedAudit)
      if (!authenticated.capabilities.includes('READ_VERSION')) throw new GatewayError('CAPABILITY_DENIED', 'The agent is not granted the requested capability.', authenticatedAudit)
      if (!this.handoff) throw new GatewayError('UPSTREAM_APPLICATION_ERROR', 'Approved-version handoff is not configured.', createAuditContext(request, authenticated.identity.id, 'failed', 'READ_APPROVED_VERSION'))

      let handoff: AgentHandoff
      try {
        handoff = await this.handoff.getApprovedVersionHandoff(request.versionId)
      } catch (error) {
        if (error instanceof DomainError && (error.code === 'NOT_FOUND' || error.code === 'VERSION_IMMUTABLE')) {
          throw new GatewayError('RESOURCE_NOT_FOUND', 'The requested approved version was not found.', authenticatedAudit)
        }
        throw new GatewayError('UPSTREAM_APPLICATION_ERROR', 'The approved-version handoff failed.', createAuditContext(request, authenticated.identity.id, 'failed', 'READ_APPROVED_VERSION'))
      }

      if (handoff.project.id !== request.projectId || handoff.document.id !== request.documentId || handoff.version.id !== request.versionId) {
        throw new GatewayError('RESOURCE_NOT_FOUND', 'The requested version is not part of the scoped project and document.', authenticatedAudit)
      }
      const successAudit = createAuditContext(request, authenticated.identity.id, 'succeeded', 'READ_APPROVED_VERSION')
      this.recordAudit(successAudit)
      return { data: handoff, auditContext: successAudit }
    } catch (error) {
      if (error instanceof GatewayError) {
        const context = error.auditContext.agentId || !agent ? error.auditContext : createAuditContext(request, agent.identity.id, 'denied', 'READ_APPROVED_VERSION')
        const gatewayError = new GatewayError(error.code, error.message, context, error.details)
        this.recordAudit(context, error.code)
        throw gatewayError
      }
      const gatewayError = new GatewayError('INVALID_REQUEST', error instanceof Error ? error.message : 'Invalid gateway request.', createAuditContext(request, agent?.identity.id ?? null, 'denied', 'READ_APPROVED_VERSION'))
      this.recordAudit(gatewayError.auditContext, gatewayError.code)
      throw gatewayError
    }
  }

  async reportImplementationStatus(request: GatewayImplementationStatusRequest): Promise<GatewayImplementationStatusResponse> {
    const baseAudit = createAuditContext(request, null, 'denied', 'REPORT_IMPLEMENTATION_STATUS')
    let agent: { identity: AgentIdentity } | undefined
    try {
      requiredRequestValue(request.requestId, 'requestId')
      requiredRequestValue(request.projectId, 'projectId')
      requiredRequestValue(request.documentId, 'documentId')
      requiredRequestValue(request.designVersionId, 'designVersionId')
      if (request.capability !== 'REPORT_IMPLEMENTATION_STATUS' || !GATEWAY_CAPABILITIES.includes(request.capability)) {
        throw new GatewayError('CAPABILITY_DENIED', 'The requested gateway capability is not granted.', baseAudit)
      }

      const authenticated = await this.authenticator.authenticate(request.credential, baseAudit)
      agent = authenticated
      const authenticatedAudit = createAuditContext(request, authenticated.identity.id, 'denied', 'REPORT_IMPLEMENTATION_STATUS')
      this.enforceRateLimit(authenticated.identity.id, request.projectId, 'REPORT_IMPLEMENTATION_STATUS', authenticatedAudit)
      this.assertAuthorized(authenticated, request.projectId, request.capability, authenticatedAudit)
      if (!this.synchronization) throw new GatewayError('UPSTREAM_APPLICATION_ERROR', 'Synchronization application services are not configured.', createAuditContext(request, authenticated.identity.id, 'failed', 'REPORT_IMPLEMENTATION_STATUS'))

      try {
        const report = await this.synchronization.reportImplementationStatus({
          projectId: request.projectId,
          documentId: request.documentId,
          designVersionId: request.designVersionId,
          reportedBy: authenticated.identity.id,
          repository: request.repository,
          ...(request.branch !== undefined ? { branch: request.branch } : {}),
          ...(request.commit !== undefined ? { commit: request.commit } : {}),
          ...(request.environment !== undefined ? { environment: request.environment } : {}),
          status: request.status,
          ...(request.surfaces !== undefined ? { surfaces: request.surfaces } : {}),
          ...(request.notes !== undefined ? { notes: request.notes } : {}),
        })
        const successAudit = createAuditContext(request, authenticated.identity.id, 'succeeded', 'REPORT_IMPLEMENTATION_STATUS')
        this.recordAudit(successAudit)
        return { data: report, auditContext: successAudit }
      } catch (error) {
        throw this.mapSynchronizationError(error, authenticatedAudit, 'The implementation status application service failed.')
      }
    } catch (error) {
      if (error instanceof GatewayError) {
        const context = error.auditContext.agentId || !agent ? error.auditContext : createAuditContext(request, agent.identity.id, 'denied', 'REPORT_IMPLEMENTATION_STATUS')
        const gatewayError = new GatewayError(error.code, error.message, context, error.details)
        this.recordAudit(context, error.code)
        throw gatewayError
      }
      const gatewayError = new GatewayError('INVALID_REQUEST', error instanceof Error ? error.message : 'Invalid gateway request.', createAuditContext(request, agent?.identity.id ?? null, 'denied', 'REPORT_IMPLEMENTATION_STATUS'))
      this.recordAudit(gatewayError.auditContext, gatewayError.code)
      throw gatewayError
    }
  }

  async proposeSynchronization(request: GatewaySynchronizationProposalRequest): Promise<GatewaySynchronizationProposalResponse> {
    const baseAudit = createAuditContext(request, null, 'denied', 'PROPOSE_SYNC')
    let agent: { identity: AgentIdentity } | undefined
    try {
      requiredRequestValue(request.requestId, 'requestId')
      requiredRequestValue(request.projectId, 'projectId')
      requiredRequestValue(request.documentId, 'documentId')
      requiredRequestValue(request.fromVersionId, 'fromVersionId')
      requiredRequestValue(request.toVersionId, 'toVersionId')
      requiredRequestValue(request.implementationReportId, 'implementationReportId')
      if (request.capability !== 'PROPOSE_SYNC' || !GATEWAY_CAPABILITIES.includes(request.capability)) {
        throw new GatewayError('CAPABILITY_DENIED', 'The requested gateway capability is not granted.', baseAudit)
      }

      const authenticated = await this.authenticator.authenticate(request.credential, baseAudit)
      agent = authenticated
      const authenticatedAudit = createAuditContext(request, authenticated.identity.id, 'denied', 'PROPOSE_SYNC')
      this.enforceRateLimit(authenticated.identity.id, request.projectId, 'PROPOSE_SYNC', authenticatedAudit)
      this.assertAuthorized(authenticated, request.projectId, request.capability, authenticatedAudit)
      if (!this.synchronization) throw new GatewayError('UPSTREAM_APPLICATION_ERROR', 'Synchronization application services are not configured.', createAuditContext(request, authenticated.identity.id, 'failed', 'PROPOSE_SYNC'))

      try {
        const proposal = await this.synchronization.proposeSynchronization({
          projectId: request.projectId,
          documentId: request.documentId,
          fromVersionId: request.fromVersionId,
          toVersionId: request.toVersionId,
          implementationReportId: request.implementationReportId,
          rationale: request.rationale,
          createdBy: authenticated.identity.id,
        })
        const successAudit = createAuditContext(request, authenticated.identity.id, 'succeeded', 'PROPOSE_SYNC')
        this.recordAudit(successAudit)
        return { data: proposal, auditContext: successAudit }
      } catch (error) {
        throw this.mapSynchronizationError(error, authenticatedAudit, 'The synchronization proposal application service failed.')
      }
    } catch (error) {
      if (error instanceof GatewayError) {
        const context = error.auditContext.agentId || !agent ? error.auditContext : createAuditContext(request, agent.identity.id, 'denied', 'PROPOSE_SYNC')
        const gatewayError = new GatewayError(error.code, error.message, context, error.details)
        this.recordAudit(context, error.code)
        throw gatewayError
      }
      const gatewayError = new GatewayError('INVALID_REQUEST', error instanceof Error ? error.message : 'Invalid gateway request.', createAuditContext(request, agent?.identity.id ?? null, 'denied', 'PROPOSE_SYNC'))
      this.recordAudit(gatewayError.auditContext, gatewayError.code)
      throw gatewayError
    }
  }

  private assertAuthorized(authenticated: { scope: { projectIds: readonly string[] }; capabilities: readonly string[] }, projectId: string, capability: string, audit: AuditContext): void {
    if (!authenticated.scope.projectIds.includes(projectId)) throw new GatewayError('PROJECT_SCOPE_DENIED', 'The agent is not scoped to the requested project.', audit)
    if (!authenticated.capabilities.includes(capability)) throw new GatewayError('CAPABILITY_DENIED', 'The agent is not granted the requested capability.', audit)
  }

  private mapSynchronizationError(error: unknown, audit: AuditContext, fallback: string): GatewayError {
    if (error instanceof DomainError && error.code === 'NOT_FOUND') return new GatewayError('RESOURCE_NOT_FOUND', 'The requested synchronization resource was not found.', audit)
    if (error instanceof DomainError && ['VALIDATION_ERROR', 'INVALID_REFERENCE', 'CONFLICT', 'VERSION_CONFLICT', 'VERSION_IMMUTABLE'].includes(error.code)) {
      return new GatewayError('INVALID_REQUEST', 'The synchronization request is invalid.', audit)
    }
    return new GatewayError('UPSTREAM_APPLICATION_ERROR', fallback, Object.freeze({ ...audit, outcome: 'failed' }))
  }

  private enforceRateLimit(agentId: string, projectId: string, operation: AuditContext['operation'], audit: AuditContext): void {
    const decision = this.hardening.rateLimiter?.check({ agentId, projectId, operation })
    if (decision && !decision.allowed) {
      throw new GatewayError('RATE_LIMITED', 'Gateway request rate limit exceeded.', audit, decision.retryAfterMs === undefined ? undefined : { retryAfterMs: decision.retryAfterMs })
    }
  }

  private recordAudit(context: AuditContext, errorCode?: GatewayErrorCode): void {
    if (!this.hardening.auditSink) return
    try {
      this.hardening.auditSink.record(createAuditEvent(context, errorCode, this.hardening))
    } catch {
      // Observability failure must not alter gateway authorization behavior.
    }
  }
}
