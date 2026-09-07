export type DomainErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INVALID_REFERENCE'
  | 'GRAPH_UNAVAILABLE'
  | 'INVALID_GRAPH'
  | 'MANIFEST_COMPILATION_ERROR'
  | 'VERSION_CONFLICT'
  | 'VERSION_IMMUTABLE'
  | 'APPROVAL_REQUIRED'
  | 'PROPOSAL_INVALID'

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'DomainError'
  }
}
