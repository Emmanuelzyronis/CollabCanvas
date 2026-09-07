import { AgentGateway, GatewayError, type GatewayImplementationStatusRequest, type GatewaySynchronizationProposalRequest } from '../gateway'
import {
  type ProposeSyncToolInput,
  type ProposeSyncToolResponse,
  type ReportImplementationStatusToolInput,
  type ReportImplementationStatusToolResponse,
  type SemanticToolDefinition,
  type SemanticToolErrorResponse,
  type SemanticToolInputSchema,
  type SemanticToolResult,
} from './contracts'
import type { ImplementationStatusReport, SynchronizationProposal } from '../domain/synchronization-types'

type GatewaySynchronization = Pick<AgentGateway, 'reportImplementationStatus' | 'proposeSynchronization'>

const reportImplementationStatusInputSchema: SemanticToolInputSchema = {
  type: 'object',
  properties: {
    projectId: { type: 'string' }, documentId: { type: 'string' }, designVersionId: { type: 'string' },
    repository: { type: 'string' }, branch: { type: 'string' }, commit: { type: 'string' }, environment: { type: 'string' },
    status: { type: 'string', enum: ['connected', 'reading_design', 'implementing', 'validating', 'implemented', 'drift_detected', 'sync_proposed'] },
    surfaces: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' }, credential: { type: 'string' }, requestId: { type: 'string' },
  },
  required: ['projectId', 'documentId', 'designVersionId', 'repository', 'status', 'requestId'],
}

const proposeSyncInputSchema: SemanticToolInputSchema = {
  type: 'object',
  properties: {
    projectId: { type: 'string' }, documentId: { type: 'string' }, fromVersionId: { type: 'string' }, toVersionId: { type: 'string' },
    implementationReportId: { type: 'string' }, rationale: { type: 'string' }, credential: { type: 'string' }, requestId: { type: 'string' },
  },
  required: ['projectId', 'documentId', 'fromVersionId', 'toVersionId', 'implementationReportId', 'rationale', 'requestId'],
}

export function createReportImplementationStatusTool(gateway: GatewaySynchronization): SemanticToolDefinition<ReportImplementationStatusToolInput, ImplementationStatusReport> {
  return {
    name: 'report_implementation_status',
    description: 'Record implementation evidence for an approved design version through the Agent Gateway.',
    capability: 'REPORT_IMPLEMENTATION_STATUS',
    inputSchema: reportImplementationStatusInputSchema,
    async execute(input): Promise<ReportImplementationStatusToolResponse> {
      const request: GatewayImplementationStatusRequest = {
        requestId: input.requestId, credential: input.credential, projectId: input.projectId, documentId: input.documentId,
        designVersionId: input.designVersionId, repository: input.repository,
        ...(input.branch !== undefined ? { branch: input.branch } : {}), ...(input.commit !== undefined ? { commit: input.commit } : {}),
        ...(input.environment !== undefined ? { environment: input.environment } : {}), status: input.status,
        ...(input.surfaces !== undefined ? { surfaces: input.surfaces } : {}), ...(input.notes !== undefined ? { notes: input.notes } : {}),
        capability: 'REPORT_IMPLEMENTATION_STATUS',
      }
      const response = await gateway.reportImplementationStatus(request)
      return { data: response.data, requestId: response.auditContext.requestId }
    },
  }
}

export function createProposeSyncTool(gateway: GatewaySynchronization): SemanticToolDefinition<ProposeSyncToolInput, SynchronizationProposal> {
  return {
    name: 'propose_sync',
    description: 'Create a pending, non-mutating synchronization proposal between approved design versions.',
    capability: 'PROPOSE_SYNC',
    inputSchema: proposeSyncInputSchema,
    async execute(input): Promise<ProposeSyncToolResponse> {
      const request: GatewaySynchronizationProposalRequest = {
        requestId: input.requestId, credential: input.credential, projectId: input.projectId, documentId: input.documentId,
        fromVersionId: input.fromVersionId, toVersionId: input.toVersionId, implementationReportId: input.implementationReportId,
        rationale: input.rationale, capability: 'PROPOSE_SYNC',
      }
      const response = await gateway.proposeSynchronization(request)
      return { data: response.data, requestId: response.auditContext.requestId }
    },
  }
}

type SynchronizationTool =
  | SemanticToolDefinition<ReportImplementationStatusToolInput, ImplementationStatusReport>
  | SemanticToolDefinition<ProposeSyncToolInput, SynchronizationProposal>

export interface SynchronizationToolRegistry {
  list(): readonly SynchronizationTool[]
  get(name: string): SynchronizationTool | undefined
  call(name: string, input: ReportImplementationStatusToolInput | ProposeSyncToolInput): Promise<SemanticToolResult<ImplementationStatusReport | SynchronizationProposal>>
}

function safeError(error: unknown, requestId: string): SemanticToolErrorResponse {
  if (error instanceof GatewayError) return { error: { code: error.code, message: error.message }, requestId: error.auditContext.requestId }
  return { error: { code: 'UPSTREAM_APPLICATION_ERROR', message: 'The synchronization tool could not complete the request.' }, requestId }
}

/** Semantic synchronization tools remain separate from the legacy browser canvas registry. */
export function createSynchronizationToolRegistry(gateway: GatewaySynchronization): SynchronizationToolRegistry {
  const reportTool = createReportImplementationStatusTool(gateway)
  const proposeTool = createProposeSyncTool(gateway)
  const tools = [reportTool, proposeTool] as const
  const byName = new Map<string, (typeof tools)[number]>(tools.map((tool) => [tool.name, tool]))
  return {
    list: () => tools,
    get: (name) => byName.get(name),
    async call(name, input) {
      const tool = byName.get(name)
      const requestId = typeof input?.requestId === 'string' ? input.requestId : ''
      if (!tool) return { error: { code: 'INVALID_REQUEST', message: `Unknown synchronization tool "${name}".` }, requestId }
      if (!input || typeof input !== 'object') return { error: { code: 'INVALID_REQUEST', message: 'Synchronization tool input must be an object.' }, requestId }
      try {
        if (name === 'report_implementation_status') {
          return await reportTool.execute(input as ReportImplementationStatusToolInput)
        }
        return await proposeTool.execute(input as ProposeSyncToolInput)
      } catch (error) {
        return safeError(error, requestId)
      }
    },
  }
}

export { proposeSyncInputSchema, reportImplementationStatusInputSchema }
