import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import { DomainError } from '../domain/errors'
import type { CreateDocumentInput, CreateNodeInput, CreatePageInput, CreateProjectInput } from '../domain/contracts'
import type { DesignService } from '../application/design-service'
import type { ManifestApplication } from '../application/manifest-service'
import { AgentGateway, GatewayError, type GatewayApprovedVersionRequest, type GatewayRequest } from '../gateway'
import type { ApiFailure, ApiSuccess } from './contracts'
import { serializePageGraph } from '../domain/serialization'

type Route = { method: string; path: RegExp; handler: (params: Record<string, string>, body: Record<string, unknown>, request: IncomingMessage, url: URL, requestId: string) => Promise<unknown> }

const jsonHeaders = { 'content-type': 'application/json; charset=utf-8' }

export function createApiServer(service: DesignService, manifestService?: ManifestApplication, gateway?: AgentGateway): Server {
  return createServer((request, response) => {
    void handleRequest(service, manifestService, gateway, request, response)
  })
}

async function handleRequest(service: DesignService, manifestService: ManifestApplication | undefined, gateway: AgentGateway | undefined, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const requestId = request.headers['x-request-id']?.toString() || randomUUID()
  const url = new URL(request.url ?? '/', 'http://localhost')

  try {
    const body = request.method === 'POST' ? await readJson(request) : {}
    const route = routes(service, manifestService, gateway).find((candidate) => candidate.method === request.method && candidate.path.test(url.pathname))
    if (!route) return writeError(response, requestId, request.method === 'GET' || request.method === 'POST' ? 'NOT_FOUND' : 'METHOD_NOT_ALLOWED', 'Route not found.', request.method === 'GET' || request.method === 'POST' ? 404 : 405)
    const match = route.path.exec(url.pathname)
    const result = await route.handler(match?.groups ?? {}, body, request, url, requestId)
    const status = request.method === 'POST' ? 201 : 200
    writeJson(response, status, { data: result, meta: { requestId, apiVersion: 'v1' } } satisfies ApiSuccess<unknown>)
  } catch (error) {
    if (error instanceof HttpInputError) return writeError(response, requestId, 'VALIDATION_ERROR', error.message, 400)
    if (error instanceof GatewayError) return writeError(response, requestId, error.code, error.message, statusForGatewayError(error), error.details)
    if (error instanceof DomainError) return writeError(response, requestId, error.code, error.message, statusForDomainError(error), error.details)
    console.error(`[CollabCanvas API ${requestId}] ${error instanceof Error ? error.name : 'UnknownError'}`)
    return writeError(response, requestId, 'INTERNAL_ERROR', 'Unexpected server error.', 500)
  }
}

function routes(service: DesignService, manifestService?: ManifestApplication, gateway?: AgentGateway): Route[] {
  const routeList: Route[] = [
    { method: 'GET', path: /^\/healthz$/, handler: async () => ({ status: 'ok' }) },
    { method: 'GET', path: /^\/readyz$/, handler: async () => ({ status: 'ready' }) },
    { method: 'POST', path: /^\/api\/v1\/projects$/, handler: (_, body) => service.createProject(body as unknown as CreateProjectInput) },
    { method: 'GET', path: /^\/api\/v1\/projects\/(?<id>[^/]+)$/, handler: (params) => service.getProject(params.id) },
    { method: 'POST', path: /^\/api\/v1\/projects\/(?<projectId>[^/]+)\/documents$/, handler: (params, body) => service.createDocument(params.projectId, body as unknown as CreateDocumentInput) },
    { method: 'GET', path: /^\/api\/v1\/documents\/(?<id>[^/]+)$/, handler: (params) => service.getDocument(params.id) },
    { method: 'GET', path: /^\/api\/v1\/documents\/(?<documentId>[^/]+)\/manifest$/, handler: (params) => {
      if (!manifestService) throw new DomainError('GRAPH_UNAVAILABLE', 'The canonical design graph is not configured for manifest retrieval.')
      return manifestService.getDocumentManifest(params.documentId)
    } },
    { method: 'POST', path: /^\/api\/v1\/documents\/(?<documentId>[^/]+)\/pages$/, handler: (params, body) => service.createPage(params.documentId, body as unknown as CreatePageInput) },
    { method: 'GET', path: /^\/api\/v1\/pages\/(?<id>[^/]+)$/, handler: async (params) => {
      const graph = await service.getPage(params.id)
      return { ...graph, serialized: serializePageGraph(graph) }
    } },
    { method: 'POST', path: /^\/api\/v1\/pages\/(?<pageId>[^/]+)\/nodes$/, handler: (params, body) => service.createNode(params.pageId, body as unknown as CreateNodeInput) },
  ]
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

function writeError(response: ServerResponse, requestId: string, code: string, message: string, status: number, details?: Record<string, unknown>): void {
  writeJson(response, status, { error: { code, message, ...(details ? { details } : {}) }, meta: { requestId, apiVersion: 'v1' } })
}

function statusForDomainError(error: DomainError): number {
  if (error.code === 'NOT_FOUND') return 404
  if (error.code === 'CONFLICT') return 409
  if (error.code === 'GRAPH_UNAVAILABLE') return 503
  if (error.code === 'INVALID_GRAPH') return 422
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
