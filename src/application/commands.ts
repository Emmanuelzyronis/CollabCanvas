import type { DesignDocument, DesignGraph, Page, Project } from '../../server/domain/contracts'
import type { DesignManifest } from '../../server/domain/manifest-types'
import type { DesignVersion } from '../../server/domain/version-types'

export type EditorCommandName = 'create' | 'update' | 'move' | 'resize' | 'delete' | 'reorder' | 'duplicate'

export interface WorkspaceVersion {
  readonly id: string
  readonly number: number
  readonly status: DesignVersion['status']
}

export interface WorkspaceHydration {
  readonly project: Project
  readonly document: DesignDocument
  readonly page: Page
  readonly graph: DesignGraph
  readonly availability: 'GRAPH_AVAILABLE'
  readonly version?: WorkspaceVersion
}

export interface EditorCommandResult {
  readonly graph: DesignGraph
  readonly nodeId: string | null
  readonly version: {
    readonly baseVersionId: string | null
    readonly currentVersionId: string | null
    readonly revision: number | null
    readonly status: DesignVersion['status'] | null
  }
  readonly validation: { readonly valid: true }
}

export type EditorHistoryOperation = 'undo' | 'redo'

export interface EditorHistoryResult extends EditorCommandResult {
  readonly changed: boolean
  readonly history: { readonly canUndo: boolean; readonly canRedo: boolean }
}

export type WorkspacePreset = 'blank' | 'website' | 'flyer' | 'logo'

export class WorkspaceApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message)
    this.name = 'WorkspaceApiError'
  }
}

export function resolveApiBase(): string {
  const configured = typeof window !== 'undefined' ? (window as Window & { __COLLABCANVAS_API_BASE__?: string }).__COLLABCANVAS_API_BASE__ : undefined
  return (configured ?? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8787')).replace(/\/$/, '')
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${resolveApiBase()}${path}`, init)
  } catch {
    throw new WorkspaceApiError('NETWORK_ERROR', 'CollabCanvas could not reach its API. Start it locally with `npm run api`.', 0)
  }
  let body: { data?: T; error?: { code?: string; message?: string } }
  try {
    body = await response.json() as { data?: T; error?: { code?: string; message?: string } }
  } catch {
    throw new WorkspaceApiError('GRAPH_UNAVAILABLE', 'The API returned an unreadable response (is the API server running?).', response.status)
  }
  if (!response.ok || body.data === undefined) {
    const failure = body.error
    throw new WorkspaceApiError(failure?.code ?? 'GRAPH_UNAVAILABLE', failure?.message ?? 'The operation is unavailable.', response.status)
  }
  return body.data
}

export function createBlankWorkspace(preset: WorkspacePreset): Promise<WorkspaceHydration> {
  return request<WorkspaceHydration>('/api/v1/workspaces', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ preset }),
  })
}

export function runEditorCommand(documentId: string, command: EditorCommandName, payload: Record<string, unknown>, baseVersionId?: string): Promise<EditorCommandResult> {
  return request<EditorCommandResult>(`/api/v1/documents/${encodeURIComponent(documentId)}/commands`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ command, payload, ...(baseVersionId ? { baseVersionId } : {}) }),
  })
}

export function runEditorHistory(documentId: string, operation: EditorHistoryOperation, baseVersionId?: string): Promise<EditorHistoryResult> {
  return request<EditorHistoryResult>(`/api/v1/documents/${encodeURIComponent(documentId)}/history`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ operation, ...(baseVersionId ? { baseVersionId } : {}) }),
  })
}

export function fetchDocumentManifest(documentId: string): Promise<DesignManifest> {
  return request<DesignManifest>(`/api/v1/documents/${encodeURIComponent(documentId)}/manifest`)
}

export interface AssistantStatus {
  readonly provider: 'azure-openai' | 'builtin'
  readonly connected: boolean
  readonly supports: readonly string[]
}

export function fetchAssistantStatus(): Promise<AssistantStatus> {
  return request<AssistantStatus>('/api/v1/assistant')
}

export function workspaceErrorCode(error: unknown): string | null {
  return error instanceof WorkspaceApiError ? error.code : null
}
