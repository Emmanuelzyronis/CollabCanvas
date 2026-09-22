import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import { DomainError } from '../domain/errors.js'
import type { CreateDocumentInput, CreateNodeInput, CreatePageInput, CreateProjectInput, DesignNode } from '../domain/contracts.js'
import type { DesignService } from '../application/design-service.js'
import type { CanvasGraphApplication } from '../application/canvas-graph-service.js'
import type { ManifestApplication } from '../application/manifest-service.js'
import type { VersioningApplicationService } from '../application/version-service.js'
import type { CopilotApplicationService } from '../application/copilot-service.js'
import { assistantDescriptor } from '../application/azure-copilot-planner.js'
import type { CopilotPlanner } from '../domain/copilot-types.js'
import { AgentGateway, GatewayError, type GatewayApprovedVersionRequest, type GatewayRequest } from '../gateway/index.js'
import type { ApiFailure, ApiSuccess } from './contracts.js'
import { serializePageGraph } from '../domain/serialization.js'
import { GraphValidationError } from '../domain/graph-validation.js'
import type { EditorCommandApplicationService } from '../application/editor-command-service.js'
import type { EditorHistoryApplicationService, EditorHistoryOperation } from '../application/editor-history-service.js'
import type { HumanWorkspaceService } from '../application/workspace-service.js'
import type { SynchronizationApplicationService } from '../application/synchronization-service.js'
import type { DesignVersion } from '../domain/version-types.js'

type Route = { method: string; path: RegExp; handler: (params: Record<string, string>, body: Record<string, unknown>, request: IncomingMessage, url: URL, requestId: string) => Promise<unknown> }

const jsonHeaders = { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' }

export function createApiServer(service: DesignService, manifestService?: ManifestApplication, gateway?: AgentGateway, canvasGraph?: CanvasGraphApplication, versioning?: VersioningApplicationService, copilot?: CopilotApplicationService, planner?: CopilotPlanner, editor?: EditorCommandApplicationService, workspaces?: HumanWorkspaceService, history?: EditorHistoryApplicationService, synchronization?: SynchronizationApplicationService): Server {
  return createServer(createApiRequestHandler(service, manifestService, gateway, canvasGraph, versioning, copilot, planner, editor, workspaces, history, synchronization))
}

export function createApiRequestHandler(service: DesignService, manifestService?: ManifestApplication, gateway?: AgentGateway, canvasGraph?: CanvasGraphApplication, versioning?: VersioningApplicationService, copilot?: CopilotApplicationService, planner?: CopilotPlanner, editor?: EditorCommandApplicationService, workspaces?: HumanWorkspaceService, history?: EditorHistoryApplicationService, synchronization?: SynchronizationApplicationService) {
  return (request: IncomingMessage, response: ServerResponse) => {
    void handleRequest(service, manifestService, gateway, canvasGraph, versioning, copilot, planner, editor, workspaces, history, synchronization, request, response)
  }
}

async function handleRequest(service: DesignService, manifestService: ManifestApplication | undefined, gateway: AgentGateway | undefined, canvasGraph: CanvasGraphApplication | undefined, versioning: VersioningApplicationService | undefined, copilot: CopilotApplicationService | undefined, planner: CopilotPlanner | undefined, editor: EditorCommandApplicationService | undefined, workspaces: HumanWorkspaceService | undefined, history: EditorHistoryApplicationService | undefined, synchronization: SynchronizationApplicationService | undefined, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const requestId = request.headers['x-request-id']?.toString() || randomUUID()
  const url = new URL(request.url ?? '/', 'http://localhost')
  const routedPath = url.pathname === '/api' && url.searchParams.get('route')
    ? url.searchParams.get('route')!
    : url.pathname

  try {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, { ...jsonHeaders, 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,authorization,x-request-id' })
      response.end()
      return
    }
    const body = request.method === 'POST' ? await readJson(request) : {}
    const route = routes(service, manifestService, gateway, canvasGraph, versioning, copilot, planner, editor, workspaces, history, synchronization).find((candidate) => candidate.method === request.method && candidate.path.test(routedPath))
    if (!route) return writeError(response, requestId, request.method === 'GET' || request.method === 'POST' ? 'NOT_FOUND' : 'METHOD_NOT_ALLOWED', 'Route not found.', request.method === 'GET' || request.method === 'POST' ? 404 : 405)
    const match = route.path.exec(routedPath)
    const result = await route.handler(match?.groups ?? {}, body, request, url, requestId)
    const status = request.method === 'POST' ? 201 : 200
    writeJson(response, status, { data: result, meta: { requestId, apiVersion: 'v1' } } satisfies ApiSuccess<unknown>)
  } catch (error) {
    if (error instanceof HttpInputError) return writeError(response, requestId, 'VALIDATION_ERROR', error.message, 400)
    if (error instanceof GatewayError) return writeError(response, requestId, error.code, error.message, statusForGatewayError(error), error.details)
    if (error instanceof DomainError) return writeError(response, requestId, error.code, error.message, statusForDomainError(error), error.details)
    if (error instanceof GraphValidationError) return writeError(response, requestId, 'VALIDATION_ERROR', error.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '), 400, { issues: error.issues })
    console.error(`[CollabCanvas API ${requestId}] ${error instanceof Error ? error.name : 'UnknownError'}`)
    return writeError(response, requestId, 'INTERNAL_ERROR', 'Unexpected server error.', 500)
  }
}

function routes(service: DesignService, manifestService?: ManifestApplication, gateway?: AgentGateway, canvasGraph?: CanvasGraphApplication, versioning?: VersioningApplicationService, copilot?: CopilotApplicationService, planner?: CopilotPlanner, editor?: EditorCommandApplicationService, workspaces?: HumanWorkspaceService, history?: EditorHistoryApplicationService, synchronization?: SynchronizationApplicationService): Route[] {
  const routeList: Route[] = [
    { method: 'GET', path: /^\/healthz$/, handler: async () => ({ status: 'ok' }) },
    { method: 'GET', path: /^\/readyz$/, handler: async () => ({ status: 'ready' }) },
    { method: 'GET', path: /^\/api\/v1\/assistant$/, handler: async () => ({ ...assistantDescriptor(), provider: planner?.provider ?? assistantDescriptor().provider }) },
    { method: 'POST', path: /^\/api\/v1\/workspaces$/, handler: async (_params, body) => {
      if (!workspaces) throw new DomainError('GRAPH_UNAVAILABLE', 'The workspace service is not configured.')
      const preset = body.preset === undefined ? 'blank' : body.preset
      if (typeof preset !== 'string') throw new HttpInputError('preset must be a string when provided.')
      const result = await workspaces.create(preset)
      return { project: result.project, document: result.document, page: result.page, graph: result.graph, version: versionSummary(result.version), availability: 'GRAPH_AVAILABLE' as const }
    } },
    { method: 'POST', path: /^\/api\/v1\/projects$/, handler: (_, body) => service.createProject(body as unknown as CreateProjectInput) },
    { method: 'GET', path: /^\/api\/v1\/projects\/(?<id>[^/]+)$/, handler: (params) => service.getProject(params.id) },
    { method: 'POST', path: /^\/api\/v1\/projects\/(?<projectId>[^/]+)\/documents$/, handler: (params, body) => service.createDocument(params.projectId, body as unknown as CreateDocumentInput) },
    { method: 'GET', path: /^\/api\/v1\/documents\/(?<id>[^/]+)$/, handler: (params) => service.getDocument(params.id) },
    { method: 'GET', path: /^\/api\/v1\/documents\/(?<documentId>[^/]+)\/manifest$/, handler: (params) => {
      if (!manifestService) throw new DomainError('GRAPH_UNAVAILABLE', 'The canonical design graph is not configured for manifest retrieval.')
      return manifestService.getDocumentManifest(params.documentId)
    } },
    { method: 'GET', path: /^\/api\/v1\/projects\/(?<projectId>[^/]+)\/documents\/(?<documentId>[^/]+)\/pages\/(?<pageId>[^/]+)\/graph$/, handler: async (params) => {
      if (!canvasGraph) throw new DomainError('GRAPH_UNAVAILABLE', 'The canonical design graph is not configured for workspace hydration.')
      const graph = await canvasGraph.getWorkspaceGraph(params.projectId, params.documentId, params.pageId)
      const head = versioning ? await versioning.getHeadVersion(params.documentId) : null
      return { project: graph.project, document: graph.document, page: graph.page, graph, availability: 'GRAPH_AVAILABLE' as const, ...(head ? { version: versionSummary(head) } : {}) }
    } },
    { method: 'POST', path: /^\/api\/v1\/documents\/(?<documentId>[^/]+)\/commands$/, handler: (params, body) => {
      if (!editor) throw new DomainError('GRAPH_UNAVAILABLE', 'The editor command service is not configured.')
      if (typeof body.command !== 'string') throw new HttpInputError('command must be a string.')
      const baseVersionId = body.baseVersionId === undefined ? undefined : body.baseVersionId
      if (baseVersionId !== undefined && typeof baseVersionId !== 'string') throw new HttpInputError('baseVersionId must be a string when provided.')
      const payload = body.payload
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new HttpInputError('payload must be an object.')
      return editor.execute(params.documentId, body.command, payload as Record<string, unknown>, baseVersionId as string | undefined)
    } },
    { method: 'POST', path: /^\/api\/v1\/documents\/(?<documentId>[^/]+)\/history$/, handler: (params, body) => {
      if (!history) throw new DomainError('GRAPH_UNAVAILABLE', 'The editor history service is not configured.')
      const operation = body.operation
      if (operation !== 'undo' && operation !== 'redo') throw new HttpInputError('operation must be "undo" or "redo".')
      const baseVersionId = body.baseVersionId === undefined ? undefined : body.baseVersionId
      if (baseVersionId !== undefined && typeof baseVersionId !== 'string') throw new HttpInputError('baseVersionId must be a string when provided.')
      return history.run(params.documentId, operation as EditorHistoryOperation, baseVersionId as string | undefined)
    } },
    { method: 'POST', path: /^\/api\/v1\/documents\/(?<documentId>[^/]+)\/nodes\/(?<nodeId>[^/]+)\/update$/, handler: (params, body) => {
      if (!canvasGraph) throw new DomainError('GRAPH_UNAVAILABLE', 'The canonical design graph is not configured for editing.')
      const patch = body.patch
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new HttpInputError('patch must be an object.')
      return canvasGraph.updateNode(params.documentId, params.nodeId, patch as Partial<Omit<DesignNode, 'id' | 'pageId'>>)
    } },
    { method: 'POST', path: /^\/api\/v1\/documents\/(?<documentId>[^/]+)\/nodes\/(?<nodeId>[^/]+)\/resize$/, handler: (params, body) => {
      if (!canvasGraph) throw new DomainError('GRAPH_UNAVAILABLE', 'The canonical design graph is not configured for editing.')
      if (typeof body.width !== 'number' || typeof body.height !== 'number') throw new HttpInputError('width and height must be numbers.')
      if (body.x !== undefined && typeof body.x !== 'number' || body.y !== undefined && typeof body.y !== 'number') throw new HttpInputError('x and y must be numbers when provided.')
      return canvasGraph.resizeNode(params.documentId, params.nodeId, body.width, body.height, body.x as number | undefined, body.y as number | undefined)
    } },
    { method: 'POST', path: /^\/api\/v1\/documents\/(?<documentId>[^/]+)\/pages$/, handler: (params, body) => service.createPage(params.documentId, body as unknown as CreatePageInput) },
    { method: 'GET', path: /^\/api\/v1\/pages\/(?<id>[^/]+)$/, handler: async (params) => {
      const graph = await service.getPage(params.id)
      return { ...graph, serialized: serializePageGraph(graph) }
    } },
    { method: 'POST', path: /^\/api\/v1\/pages\/(?<pageId>[^/]+)\/nodes$/, handler: (params, body) => service.createNode(params.pageId, body as unknown as CreateNodeInput) },
    { method: 'GET', path: /^\/api\/v1\/documents\/(?<documentId>[^/]+)\/versions$/, handler: (params) => {
      if (!versioning) throw new DomainError('GRAPH_UNAVAILABLE', 'The version query service is not configured.')
      return versioning.listVersions(params.documentId)
    } },
    { method: 'GET', path: /^\/api\/v1\/projects\/(?<projectId>[^/]+)\/documents\/(?<documentId>[^/]+)\/versions$/, handler: (params) => {
      if (!versioning) throw new DomainError('GRAPH_UNAVAILABLE', 'The version query service is not configured.')
      return versioning.listWorkspaceVersions(params.projectId, params.documentId)
    } },
    { method: 'POST', path: /^\/api\/v1\/projects\/(?<projectId>[^/]+)\/documents\/(?<documentId>[^/]+)\/versions\/draft$/, handler: (params, body) => {
      if (!versioning) throw new DomainError('GRAPH_UNAVAILABLE', 'The version command service is not configured.')
      if (typeof body.createdBy !== 'string') throw new HttpInputError('createdBy must be a string.')
      return versioning.createScopedDraft(params.projectId, params.documentId, body.createdBy)
    } },
    { method: 'GET', path: /^\/api\/v1\/versions\/(?<versionId>[^/]+)$/, handler: (params) => {
      if (!versioning) throw new DomainError('GRAPH_UNAVAILABLE', 'The version query service is not configured.')
      return versioning.getVersion(params.versionId)
    } },
    { method: 'POST', path: /^\/api\/v1\/projects\/(?<projectId>[^/]+)\/documents\/(?<documentId>[^/]+)\/versions\/(?<versionId>[^/]+)\/approve$/, handler: (params, body) => {
      if (!versioning) throw new DomainError('GRAPH_UNAVAILABLE', 'The version command service is not configured.')
      if (typeof body.approvedBy !== 'string') throw new HttpInputError('approvedBy must be a string.')
      return versioning.approveScopedVersion(params.projectId, params.documentId, params.versionId, body.approvedBy)
    } },
    { method: 'GET', path: /^\/api\/v1\/projects\/(?<projectId>[^/]+)\/documents\/(?<documentId>[^/]+)\/proposals\/(?<proposalId>[^/]+)$/, handler: (params) => {
      if (!versioning) throw new DomainError('GRAPH_UNAVAILABLE', 'The proposal query service is not configured.')
      return versioning.getScopedProposal(params.projectId, params.documentId, params.proposalId)
    } },
    { method: 'POST', path: /^\/api\/v1\/projects\/(?<projectId>[^/]+)\/documents\/(?<documentId>[^/]+)\/proposals\/(?<proposalId>[^/]+)\/approve$/, handler: (params, body) => {
      if (!versioning) throw new DomainError('GRAPH_UNAVAILABLE', 'The proposal command service is not configured.')
      if (typeof body.reviewedBy !== 'string') throw new HttpInputError('reviewedBy must be a string.')
      return versioning.approveScopedProposal(params.projectId, params.documentId, params.proposalId, body.reviewedBy)
    } },
    { method: 'POST', path: /^\/api\/v1\/projects\/(?<projectId>[^/]+)\/documents\/(?<documentId>[^/]+)\/proposals\/(?<proposalId>[^/]+)\/reject$/, handler: (params, body) => {
      if (!versioning) throw new DomainError('GRAPH_UNAVAILABLE', 'The proposal command service is not configured.')
      if (typeof body.reviewedBy !== 'string') throw new HttpInputError('reviewedBy must be a string.')
      return versioning.rejectScopedProposal(params.projectId, params.documentId, params.proposalId, body.reviewedBy)
    } },
    { method: 'GET', path: /^\/api\/v1\/versions\/(?<fromVersionId>[^/]+)\/compare\/(?<toVersionId>[^/]+)$/, handler: (params) => {
      if (!versioning) throw new DomainError('GRAPH_UNAVAILABLE', 'The version query service is not configured.')
      return versioning.compareVersions(params.fromVersionId, params.toVersionId)
    } },
    /* ---- Design-system token CRUD ---- */
    { method: 'POST', path: /^\/api\/v1\/documents\/(?<documentId>[^/]+)\/tokens$/, handler: (params, body) => {
      if (!canvasGraph) throw new DomainError('GRAPH_UNAVAILABLE', 'Canvas graph service is not configured.')
      const token = body.token as Record<string, unknown>
      if (!token || typeof token !== 'object') throw new HttpInputError('body.token must be an object.')
      return canvasGraph.upsertToken(params.documentId, token as never)
    } },
    { method: 'DELETE', path: /^\/api\/v1\/documents\/(?<documentId>[^/]+)\/tokens\/(?<tokenId>[^/]+)$/, handler: (params) => {
      if (!canvasGraph) throw new DomainError('GRAPH_UNAVAILABLE', 'Canvas graph service is not configured.')
      return canvasGraph.deleteToken(params.documentId, params.tokenId)
    } },
    /* ---- Typography CRUD ---- */
    { method: 'POST', path: /^\/api\/v1\/documents\/(?<documentId>[^/]+)\/typography$/, handler: (params, body) => {
      if (!canvasGraph) throw new DomainError('GRAPH_UNAVAILABLE', 'Canvas graph service is not configured.')
      const def = body.typography as Record<string, unknown>
      if (!def || typeof def !== 'object') throw new HttpInputError('body.typography must be an object.')
      return canvasGraph.upsertTypography(params.documentId, def as never)
    } },
    { method: 'DELETE', path: /^\/api\/v1\/documents\/(?<documentId>[^/]+)\/typography\/(?<typographyId>[^/]+)$/, handler: (params) => {
      if (!canvasGraph) throw new DomainError('GRAPH_UNAVAILABLE', 'Canvas graph service is not configured.')
      return canvasGraph.deleteTypography(params.documentId, params.typographyId)
    } },
    /* ---- Batch import ---- */
    { method: 'POST', path: /^\/api\/v1\/documents\/(?<documentId>[^/]+)\/import$/, handler: (params, body) => {
      if (!canvasGraph) throw new DomainError('GRAPH_UNAVAILABLE', 'Canvas graph service is not configured.')
      const tokens = Array.isArray(body.tokens) ? body.tokens : undefined
      const typography = Array.isArray(body.typography) ? body.typography : undefined
      if (!tokens && !typography) throw new HttpInputError('body must contain tokens and/or typography arrays.')
      return canvasGraph.importDesignSystem(params.documentId, { tokens, typography })
    } },
  ]
  if (copilot && planner) routeList.push({ method: 'POST', path: /^\/api\/v1\/projects\/(?<projectId>[^/]+)\/documents\/(?<documentId>[^/]+)\/copilot\/proposals$/, handler: async (params, body) => {
    if (typeof params.projectId !== 'string' || typeof params.documentId !== 'string' || params.projectId.length === 0 || params.documentId.length === 0) throw new HttpInputError('projectId and documentId are required.')
    if (typeof body.instruction !== 'string' || typeof body.author !== 'string' || (body.pageId !== undefined && typeof body.pageId !== 'string') || (body.trustedVersionId !== undefined && typeof body.trustedVersionId !== 'string')) throw new HttpInputError('instruction, author, and optional pageId/trustedVersionId are required.')
    const selectedNodeIds = body.selectedNodeIds === undefined ? undefined : Array.isArray(body.selectedNodeIds) && body.selectedNodeIds.every((id) => typeof id === 'string') ? body.selectedNodeIds as string[] : (() => { throw new HttpInputError('selectedNodeIds must be an array of strings.') })()
    const baseVersionId = typeof body.baseVersionId === 'string' ? body.baseVersionId : undefined
    if (!baseVersionId) throw new HttpInputError('baseVersionId is required.')
    return copilot.generate({ projectId: params.projectId, documentId: params.documentId, pageId: body.pageId as string | undefined, baseVersionId, trustedVersionId: body.trustedVersionId as string | undefined, instruction: body.instruction, selectedNodeIds, author: body.author }, planner)
  } })
  if (synchronization) routeList.push(
    { method: 'GET', path: /^\/api\/v1\/projects\/(?<projectId>[^/]+)\/documents\/(?<documentId>[^/]+)\/implementation-status$/, handler: (params) =>
      synchronization.listImplementationReports(params.projectId, params.documentId)
    },
    { method: 'GET', path: /^\/api\/v1\/projects\/(?<projectId>[^/]+)\/documents\/(?<documentId>[^/]+)\/sync-proposals$/, handler: (params) =>
      synchronization.listSyncProposals(params.projectId, params.documentId)
    },
  )
  if (gateway) routeList.push({ method: 'GET', path: /^\/api\/v1\/gateway\/manifest$/, handler: async (_params, _body, request, url, requestId) => {
    const authorization = request.headers.authorization
    const credential = authorization?.startsWith('Bearer ') ? authorization.slice(7) : authorization
    const gatewayRequest: GatewayRequest = {
      requestId,
      credential,
      projectId: url.searchParams.get('projectId') ?? '',
      documentId: url.searchParams.get('documentId') ?? '',
      capability: 'READ_MANIFEST',
    }
    const result = await gateway.readManifest(gatewayRequest)
    return result.data
  }})
  if (gateway) routeList.push({ method: 'GET', path: /^\/api\/v1\/gateway\/approved-version$/, handler: async (_params, _body, request, url, requestId) => {
    const authorization = request.headers.authorization
    const credential = authorization?.startsWith('Bearer ') ? authorization.slice(7) : authorization
    const gatewayRequest: GatewayApprovedVersionRequest = {
      requestId,
      credential,
      projectId: url.searchParams.get('projectId') ?? '',
      documentId: url.searchParams.get('documentId') ?? '',
      versionId: url.searchParams.get('versionId') ?? '',
      capability: 'READ_VERSION',
    }
    const result = await gateway.readApprovedVersion(gatewayRequest)
    return result.data
  }})
  return routeList
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 1_000_000) throw new HttpInputError('Request body is too large.')
    chunks.push(buffer)
  }
  if (chunks.length === 0) return {}
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('body must be an object')
    return parsed as Record<string, unknown>
  } catch {
    throw new HttpInputError('Request body must be valid JSON.')
  }
}

function writeJson(response: ServerResponse, status: number, body: ApiSuccess<unknown> | ApiFailure): void {
  response.writeHead(status, jsonHeaders)
  response.end(JSON.stringify(body))
}

function versionSummary(version: DesignVersion): { id: string; number: number; status: DesignVersion['status'] } {
  return { id: version.id, number: version.number, status: version.status }
}

function writeError(response: ServerResponse, requestId: string, code: string, message: string, status: number, details?: Record<string, unknown>): void {
  writeJson(response, status, { error: { code, message, ...(details ? { details } : {}) }, meta: { requestId, apiVersion: 'v1' } })
}

function statusForDomainError(error: DomainError): number {
  if (error.code === 'NOT_FOUND') return 404
  if (error.code === 'CONFLICT') return 409
  if (error.code === 'GRAPH_UNAVAILABLE') return 503
  if (error.code === 'INVALID_GRAPH') return 422
  if (error.code === 'VERSION_CONFLICT') return 409
  if (error.code === 'VERSION_IMMUTABLE') return 409
  if (error.code === 'APPROVAL_REQUIRED') return 409
  if (error.code === 'MANIFEST_COMPILATION_ERROR') return 500
  return 400
}

function statusForGatewayError(error: GatewayError): number {
  if (error.code === 'UNAUTHENTICATED' || error.code === 'INVALID_CREDENTIAL') return 401
  if (error.code === 'PROJECT_SCOPE_DENIED' || error.code === 'CAPABILITY_DENIED') return 403
  if (error.code === 'RESOURCE_NOT_FOUND') return 404
  if (error.code === 'INVALID_REQUEST') return 400
  if (error.code === 'RATE_LIMITED') return 429
  return 502
}

class HttpInputError extends Error {}
