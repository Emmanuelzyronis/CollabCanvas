import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { DesignGraph, DesignDocument, DesignNode, Page, Project } from '../../server/domain/contracts'
import type { DesignProposal, DesignVersion, VersionComparison } from '../../server/domain/version-types'
import type { CopilotProposalPreview } from '../../server/domain/copilot-types'
import { projectDesignGraph } from '../graph/graphProjection'
import { publishCanonicalGraph } from '../graph/canonicalGraph'
import { buildIntelligenceContext, type IntelligenceContext } from '../features/intelligence'
import {
  WorkspaceApiError,
  runEditorCommand,
  runEditorHistory,
  type EditorCommandName,
  type EditorHistoryResult,
  type WorkspaceHydration,
  type WorkspaceVersion,
} from '../application/commands'

export { WorkspaceApiError, fetchAssistantStatus } from '../application/commands'
export type { AssistantStatus, WorkspaceHydration, WorkspacePreset, WorkspaceVersion, EditorCommandName, EditorHistoryResult } from '../application/commands'

export type GraphAvailability = 'GRAPH_LOADING' | 'GRAPH_AVAILABLE' | 'GRAPH_UNAVAILABLE' | 'GRAPH_INVALID'

export interface WorkspaceIdentifiers {
  readonly projectId: string
  readonly documentId: string
  readonly pageId: string
}

export interface WorkspaceError {
  readonly code: string
  readonly message: string
}

export interface WorkspaceContextValue extends WorkspaceIdentifiers {
  readonly identifiers: WorkspaceIdentifiers | null
  readonly project: Project | null
  readonly document: DesignDocument | null
  readonly page: Page | null
  readonly graph: DesignGraph | null
  readonly version: WorkspaceVersion | null
  readonly availability: GraphAvailability
  readonly error?: WorkspaceError
  readonly intelligence: IntelligenceContext
  readonly resizeNode?: (nodeId: string, width: number, height: number, x?: number, y?: number) => Promise<void>
  readonly updateNode?: (nodeId: string, patch: Partial<Omit<DesignNode, 'id' | 'pageId'>>) => Promise<void>
  readonly command?: (command: EditorCommandName, payload: Record<string, unknown>) => Promise<{ graph: DesignGraph; nodeId: string | null }>
  readonly undo?: () => Promise<EditorHistoryResult>
  readonly redo?: () => Promise<EditorHistoryResult>
  readonly refreshGraph?: () => void
}

export interface VersionComparisonTarget {
  readonly fromVersionId: string
  readonly toVersionId: string
}

export interface ProposalTarget { readonly proposalId: string }

export function buildProposalReviewHref(location: Pick<Location, 'search'>, workspace: WorkspaceIdentifiers, proposalId: string): string {
  const params = new URLSearchParams(location.search)
  params.set('projectId', workspace.projectId)
  params.set('documentId', workspace.documentId)
  params.set('pageId', workspace.pageId)
  params.set('proposalId', proposalId)
  return `?${params.toString()}`
}

export function resolveWorkspaceIdentifiers(location: Pick<Location, 'search' | 'pathname'>): WorkspaceIdentifiers | null {
  const search = new URLSearchParams(location.search)
  const query = {
    projectId: search.get('projectId') ?? '',
    documentId: search.get('documentId') ?? '',
    pageId: search.get('pageId') ?? '',
  }
  if (query.projectId && query.documentId && query.pageId) return query

  const match = location.pathname.match(/^\/projects\/([^/]+)\/documents\/([^/]+)\/pages\/([^/]+)/)
  if (match) return { projectId: decodeURIComponent(match[1]), documentId: decodeURIComponent(match[2]), pageId: decodeURIComponent(match[3]) }

  return null
}

export function resolveVersionComparisonTarget(location: Pick<Location, 'search'>): VersionComparisonTarget | null {
  const search = new URLSearchParams(location.search)
  const fromVersionId = search.get('fromVersion')
  const toVersionId = search.get('toVersion')
  return fromVersionId && toVersionId ? { fromVersionId, toVersionId } : null
}

export function resolveProposalTarget(location: Pick<Location, 'search'>): ProposalTarget | null {
  const proposalId = new URLSearchParams(location.search).get('proposalId')
  return proposalId ? { proposalId } : null
}

export async function fetchWorkspaceGraph(identifiers: WorkspaceIdentifiers, signal?: AbortSignal): Promise<WorkspaceHydration> {
  const configuredBase = typeof window !== 'undefined' ? (window as Window & { __COLLABCANVAS_API_BASE__?: string }).__COLLABCANVAS_API_BASE__ : undefined
  const base = (configuredBase ?? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8787')).replace(/\/$/, '')
  const path = `/api/v1/projects/${encodeURIComponent(identifiers.projectId)}/documents/${encodeURIComponent(identifiers.documentId)}/pages/${encodeURIComponent(identifiers.pageId)}/graph`
  let response: Response
  try {
    response = await fetch(`${base}${path}`, { signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new WorkspaceApiError('NETWORK_ERROR', 'The canonical design graph could not be reached.', 0)
  }

  const body = await response.json() as { data: WorkspaceHydration } | { error?: { code?: string; message?: string } }
  if (!response.ok || !('data' in body) || !body.data) {
    const failure = 'error' in body ? body.error : undefined
    throw new WorkspaceApiError(failure?.code ?? 'GRAPH_UNAVAILABLE', failure?.message ?? 'The canonical design graph is unavailable.', response.status)
  }
  return body.data
}

export async function fetchVersionComparison(target: VersionComparisonTarget, signal?: AbortSignal): Promise<VersionComparison> {
  const configuredBase = typeof window !== 'undefined' ? (window as Window & { __COLLABCANVAS_API_BASE__?: string }).__COLLABCANVAS_API_BASE__ : undefined
  const base = (configuredBase ?? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8787')).replace(/\/$/, '')
  const path = `/api/v1/versions/${encodeURIComponent(target.fromVersionId)}/compare/${encodeURIComponent(target.toVersionId)}`
  let response: Response
  try {
    response = await fetch(`${base}${path}`, { signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new WorkspaceApiError('NETWORK_ERROR', 'The version comparison could not be reached.', 0)
  }

  const body = await response.json() as { data?: VersionComparison; error?: { code?: string; message?: string } }
  if (!response.ok || !body.data) {
    throw new WorkspaceApiError(body.error?.code ?? 'VERSION_COMPARISON_UNAVAILABLE', body.error?.message ?? 'The semantic version comparison is unavailable.', response.status)
  }
  return body.data
}

function apiBase(): string {
  const configuredBase = typeof window !== 'undefined' ? (window as Window & { __COLLABCANVAS_API_BASE__?: string }).__COLLABCANVAS_API_BASE__ : undefined
  return (configuredBase ?? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8787')).replace(/\/$/, '')
}

async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try { response = await fetch(`${apiBase()}${path}`, init) } catch { throw new WorkspaceApiError('NETWORK_ERROR', 'The version service could not be reached.', 0) }
  const body = await response.json() as { data?: T; error?: { code?: string; message?: string } }
  if (!response.ok || body.data === undefined) throw new WorkspaceApiError(body.error?.code ?? 'GRAPH_UNAVAILABLE', body.error?.message ?? 'The version operation is unavailable.', response.status)
  return body.data
}

export function fetchVersions(projectId: string, documentId: string, signal?: AbortSignal): Promise<DesignVersion[]> {
  return fetchApi<DesignVersion[]>(`/api/v1/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}/versions`, { signal })
}

export function createDraftVersion(projectId: string, documentId: string, createdBy: string): Promise<DesignVersion> {
  return fetchApi<DesignVersion>(`/api/v1/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}/versions/draft`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ createdBy }) })
}

export function approveVersion(projectId: string, documentId: string, versionId: string, approvedBy: string): Promise<DesignVersion> {
  return fetchApi<DesignVersion>(`/api/v1/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}/versions/${encodeURIComponent(versionId)}/approve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ approvedBy }) })
}

export function fetchProposal(projectId: string, documentId: string, proposalId: string): Promise<DesignProposal> {
  return fetchApi<DesignProposal>(`/api/v1/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}/proposals/${encodeURIComponent(proposalId)}`)
}

export function approveProposal(projectId: string, documentId: string, proposalId: string, reviewedBy: string): Promise<{ proposal: DesignProposal; version: DesignVersion }> {
  return fetchApi<{ proposal: DesignProposal; version: DesignVersion }>(`/api/v1/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}/proposals/${encodeURIComponent(proposalId)}/approve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reviewedBy }) })
}

export function rejectProposal(projectId: string, documentId: string, proposalId: string, reviewedBy: string): Promise<DesignProposal> {
  return fetchApi<DesignProposal>(`/api/v1/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}/proposals/${encodeURIComponent(proposalId)}/reject`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reviewedBy }) })
}

export function generateCopilotProposal(input: { projectId: string; documentId: string; pageId: string; baseVersionId: string; trustedVersionId?: string; instruction: string; selectedNodeIds: readonly string[]; author: string }): Promise<CopilotProposalPreview> {
  return fetchApi<CopilotProposalPreview>(`/api/v1/projects/${encodeURIComponent(input.projectId)}/documents/${encodeURIComponent(input.documentId)}/copilot/proposals`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) })
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

function initialState(identifiers: WorkspaceIdentifiers | null): WorkspaceContextValue {
  const ids = identifiers ?? { projectId: '', documentId: '', pageId: '' }
  return {
    projectId: identifiers?.projectId ?? '',
    documentId: identifiers?.documentId ?? '',
    pageId: identifiers?.pageId ?? '',
    identifiers,
    project: null,
    document: null,
    page: null,
    graph: null,
    version: null,
    availability: identifiers ? 'GRAPH_LOADING' : 'GRAPH_UNAVAILABLE',
    intelligence: buildIntelligenceContext({ availability: identifiers ? 'GRAPH_LOADING' : 'GRAPH_UNAVAILABLE', identifiers: ids, graph: null }),
    ...(!identifiers ? { error: { code: 'MISSING_CONTEXT', message: 'Project, document, and page identifiers are required.' } } : {}),
    resizeNode: async () => { throw new WorkspaceApiError('GRAPH_UNAVAILABLE', 'The canonical design graph is unavailable.', 0) },
    updateNode: async () => { throw new WorkspaceApiError('GRAPH_UNAVAILABLE', 'The canonical design graph is unavailable.', 0) },
    command: async () => { throw new WorkspaceApiError('GRAPH_UNAVAILABLE', 'The canonical design graph is unavailable.', 0) },
  }
}

export function WorkspaceProvider({ children, initialIdentifiers }: { children: ReactNode; initialIdentifiers?: WorkspaceIdentifiers | null }) {
  const [identifiers, setIdentifiers] = useState<WorkspaceIdentifiers | null>(() => initialIdentifiers ?? (typeof window === 'undefined' ? null : resolveWorkspaceIdentifiers(window.location)))
  const [context, setContext] = useState<WorkspaceContextValue>(() => initialState(identifiers))
  const [refreshNonce, setRefreshNonce] = useState(0)
  const refreshGraph = useCallback(() => setRefreshNonce((n) => n + 1), [])

  // Publish the canonical graph for non-React consumers (WebMCP tools). The
  // workspace remains the owner; this is a read-only publication point.
  useEffect(() => {
    publishCanonicalGraph(context.graph)
    return () => publishCanonicalGraph(null)
  }, [context.graph])

  useEffect(() => {
    const onPopState = () => setIdentifiers(resolveWorkspaceIdentifiers(window.location))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    if (!identifiers) {
      setContext(initialState(null))
      return () => controller.abort()
    }

    setContext({ ...initialState(identifiers), availability: 'GRAPH_LOADING' })
    void fetchWorkspaceGraph(identifiers, controller.signal)
      .then((payload) => {
        if (!active) return
        try {
          if (payload.project.id !== identifiers.projectId || payload.document.id !== identifiers.documentId || payload.page.id !== identifiers.pageId || payload.graph.project.id !== identifiers.projectId || payload.graph.document.id !== identifiers.documentId || payload.graph.page.id !== identifiers.pageId) {
            throw new Error('The canonical graph does not match the requested project, document, and page.')
          }
          projectDesignGraph(payload.graph)
          setContext({ ...identifiers, identifiers, project: payload.project, document: payload.document, page: payload.page, graph: payload.graph, version: payload.version ?? null, availability: 'GRAPH_AVAILABLE', intelligence: buildIntelligenceContext({ availability: 'GRAPH_AVAILABLE', identifiers, graph: payload.graph }) })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'The canonical design graph is invalid.'
          setContext({ ...identifiers, identifiers, project: payload.project, document: payload.document, page: payload.page, graph: null, version: null, availability: 'GRAPH_INVALID', error: { code: 'INVALID_GRAPH', message }, intelligence: buildIntelligenceContext({ availability: 'GRAPH_INVALID', identifiers, graph: null, error: message }) })
        }
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return
        const failure = error instanceof WorkspaceApiError ? error : new WorkspaceApiError('GRAPH_UNAVAILABLE', 'The canonical design graph is unavailable.', 0)
        const availability = failure.code === 'INVALID_GRAPH' || failure.status === 422 ? 'GRAPH_INVALID' : 'GRAPH_UNAVAILABLE'
        setContext({ ...identifiers, identifiers, project: null, document: null, page: null, graph: null, version: null, availability, error: { code: failure.code, message: failure.message }, intelligence: buildIntelligenceContext({ availability, identifiers, graph: null, error: failure.message }) })
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [identifiers, refreshNonce])

  const value = useMemo<WorkspaceContextValue>(() => {
    const command = async (name: EditorCommandName, payload: Record<string, unknown>) => {
      if (!identifiers) throw new WorkspaceApiError('GRAPH_UNAVAILABLE', 'The canonical design graph is unavailable.', 0)
      const baseVersionId = context.version?.id
      const result = await runEditorCommand(identifiers.documentId, name, payload, baseVersionId)
      projectDesignGraph(result.graph)
      setContext((current) => ({
        ...current,
        graph: result.graph,
        availability: 'GRAPH_AVAILABLE',
        version: result.version.currentVersionId && result.version.status
          ? { id: result.version.currentVersionId, number: result.version.revision ?? 0, status: result.version.status }
          : current.version,
        intelligence: buildIntelligenceContext({ availability: 'GRAPH_AVAILABLE', identifiers, graph: result.graph, selectedNodeIds: current.intelligence.selectedNodeIds }),
      }))
      return { graph: result.graph, nodeId: result.nodeId }
    }
    const history = async (operation: 'undo' | 'redo'): Promise<EditorHistoryResult> => {
      if (!identifiers) throw new WorkspaceApiError('GRAPH_UNAVAILABLE', 'The canonical design graph is unavailable.', 0)
      const baseVersionId = context.version?.id
      const result = await runEditorHistory(identifiers.documentId, operation, baseVersionId)
      projectDesignGraph(result.graph)
      setContext((current) => ({
        ...current,
        graph: result.graph,
        availability: 'GRAPH_AVAILABLE',
        version: result.version.currentVersionId && result.version.status
          ? { id: result.version.currentVersionId, number: result.version.revision ?? 0, status: result.version.status }
          : current.version,
        intelligence: buildIntelligenceContext({ availability: 'GRAPH_AVAILABLE', identifiers, graph: result.graph, selectedNodeIds: current.intelligence.selectedNodeIds }),
      }))
      return result
    }
    return {
      ...context,
      command,
      undo: () => history('undo'),
      redo: () => history('redo'),
      refreshGraph,
      resizeNode: async (nodeId, width, height, x, y) => {
        await command('resize', { nodeId, width, height, ...(x !== undefined ? { x } : {}), ...(y !== undefined ? { y } : {}) })
      },
      updateNode: async (nodeId, patch) => {
        await command('update', { nodeId, patch })
      },
    }
  }, [context, identifiers, refreshGraph])
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspaceContext(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error('useWorkspaceContext must be used within WorkspaceProvider')
  return context
}
