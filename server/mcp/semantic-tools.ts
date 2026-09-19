import { AgentGateway, GatewayError, type GatewayRequest } from '../gateway/index.js'
import type { DesignManifest } from '../domain/manifest-types.js'
import {
  type GetManifestToolInput,
  type GetManifestToolResponse,
  type SemanticToolDefinition,
  type SemanticToolResult,
} from './contracts.js'

type GatewayReader = Pick<AgentGateway, 'readManifest'>

const getManifestInputSchema = {
  type: 'object' as const,
  properties: {
    projectId: { type: 'string', description: 'Project scope for the requested document.' },
    documentId: { type: 'string', description: 'Canonical design document to retrieve.' },
    credential: { type: 'string', description: 'Gateway credential supplied by the authenticated machine transport.' },
    requestId: { type: 'string', description: 'Correlation ID for this gateway operation.' },
  },
  required: ['projectId', 'documentId', 'requestId'] as const,
}

/**
 * Semantic manifest access is deliberately bound to the gateway dependency.
 * It has no repository, compiler, browser, canvas, or Zustand dependency.
 */
export function createGetManifestTool(gateway: GatewayReader): SemanticToolDefinition<GetManifestToolInput, DesignManifest> {
  return {
    name: 'get_manifest',
    description: 'Retrieve the deterministic Design Manifest for a project document through the Agent Gateway.',
    capability: 'READ_MANIFEST',
    inputSchema: getManifestInputSchema,
    async execute(input): Promise<GetManifestToolResponse> {
      const request: GatewayRequest = {
        requestId: input.requestId,
        credential: input.credential,
        projectId: input.projectId,
        documentId: input.documentId,
        capability: 'READ_MANIFEST',
      }
      const response = await gateway.readManifest(request)
      return { data: response.data, requestId: response.auditContext.requestId }
    },
  }
}

export interface SemanticToolRegistry {
  list(): readonly SemanticToolDefinition<GetManifestToolInput, DesignManifest>[]
  get(name: string): SemanticToolDefinition<GetManifestToolInput, DesignManifest> | undefined
  call(name: string, input: GetManifestToolInput): Promise<SemanticToolResult<DesignManifest>>
}

/**
 * Transport-neutral semantic registry. A future WebMCP/MCP transport can
 * expose this registry without adding another authorization or application
 * path.
 */
export function createSemanticToolRegistry(gateway: GatewayReader): SemanticToolRegistry {
  const tools = [createGetManifestTool(gateway)] as const
  const byName = new Map(tools.map((tool) => [tool.name, tool]))

  return {
    list: () => tools,
    get: (name) => byName.get(name),
    async call(name, input): Promise<SemanticToolResult<DesignManifest>> {
      const tool = byName.get(name)
      const requestId = typeof input?.requestId === 'string' ? input.requestId : ''
      if (!tool) {
        return {
          error: { code: 'INVALID_REQUEST', message: `Unknown semantic tool "${name}".` },
          requestId,
        }
      }
      if (!input || typeof input !== 'object') {
        return { error: { code: 'INVALID_REQUEST', message: 'Semantic tool input must be an object.' }, requestId }
      }
      try {
        return await tool.execute(input)
      } catch (error) {
        if (error instanceof GatewayError) {
          return {
            error: { code: error.code, message: error.message },
            requestId: error.auditContext.requestId,
          }
        }
        return {
          error: { code: 'UPSTREAM_APPLICATION_ERROR', message: 'The semantic tool could not retrieve the manifest.' },
          requestId,
        }
      }
    },
  }
}

export { getManifestInputSchema }
