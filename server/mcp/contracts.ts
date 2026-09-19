import type { DesignManifest } from '../domain/manifest-types.js'
import type { ImplementationStatus, ImplementationStatusReport, SynchronizationProposal } from '../domain/synchronization-types.js'
import type { GatewayCapability, GatewayErrorCode } from '../gateway/contracts.js'

export interface SemanticToolInputSchema {
  readonly type: 'object'
  readonly properties: Record<string, unknown>
  readonly required: readonly string[]
}

export interface GetManifestToolInput {
  readonly projectId: string
  readonly documentId: string
  /** Development credential forwarded to the existing gateway authenticator. */
  readonly credential: string | undefined
  readonly requestId: string
}

export interface SemanticToolResponse<T> {
  readonly data: T
  readonly requestId: string
}

export interface SemanticToolErrorResponse {
  readonly error: {
    readonly code: GatewayErrorCode
    readonly message: string
  }
  readonly requestId: string
}

export type SemanticToolResult<T> = SemanticToolResponse<T> | SemanticToolErrorResponse

export interface SemanticToolDefinition<Input, Output> {
  readonly name: string
  readonly description: string
  readonly capability: GatewayCapability
  readonly inputSchema: SemanticToolInputSchema
  execute(input: Input): Promise<SemanticToolResponse<Output>>
}

export type GetManifestToolResponse = SemanticToolResponse<DesignManifest>

export interface ReportImplementationStatusToolInput {
  readonly projectId: string
  readonly documentId: string
  readonly designVersionId: string
  readonly repository: string
  readonly branch?: string
  readonly commit?: string
  readonly environment?: string
  readonly status: ImplementationStatus
  readonly surfaces?: readonly string[]
  readonly notes?: string
  readonly credential: string | undefined
  readonly requestId: string
}

export interface ProposeSyncToolInput {
  readonly projectId: string
  readonly documentId: string
  readonly fromVersionId: string
  readonly toVersionId: string
  readonly implementationReportId: string
  readonly rationale: string
  readonly credential: string | undefined
  readonly requestId: string
}

export type ReportImplementationStatusToolResponse = SemanticToolResponse<ImplementationStatusReport>
export type ProposeSyncToolResponse = SemanticToolResponse<SynchronizationProposal>
