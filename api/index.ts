import type { IncomingMessage, ServerResponse } from 'node:http'
import { createApiRequestHandler } from '../server/api/http.js'
import { DesignService } from '../server/application/design-service.js'
import { CanvasGraphApplicationService } from '../server/application/canvas-graph-service.js'
import { VersioningApplicationService } from '../server/application/version-service.js'
import { EditorCommandApplicationService } from '../server/application/editor-command-service.js'
import { EditorHistoryApplicationService } from '../server/application/editor-history-service.js'
import { HumanWorkspaceService } from '../server/application/workspace-service.js'
import { CopilotApplicationService } from '../server/application/copilot-service.js'
import { assistantDescriptor, createCopilotPlanner } from '../server/application/azure-copilot-planner.js'
import { ManifestApplicationService } from '../server/application/manifest-service.js'
import { createPostgresPool, PostgresDesignRepository, PostgresVersionRepository } from '../server/persistence/postgres.js'

console.log(`CollabCanvas assistant: ${assistantDescriptor().provider}`)
const pool = createPostgresPool(process.env.DATABASE_URL)
const repository = new PostgresDesignRepository(pool)
const designService = new DesignService(repository)
const manifestService = new ManifestApplicationService(repository, repository)
const versionApplication = new VersioningApplicationService(repository, repository, new PostgresVersionRepository(pool))
const graphApplication = new CanvasGraphApplicationService(repository, repository, versionApplication)
const history = new EditorHistoryApplicationService(graphApplication, versionApplication)
const editor = new EditorCommandApplicationService(graphApplication, versionApplication, history)
const workspaces = new HumanWorkspaceService(repository, repository, versionApplication)
const handler = createApiRequestHandler(
  designService,
  manifestService,
  undefined,
  graphApplication,
  versionApplication,
  new CopilotApplicationService(versionApplication),
  createCopilotPlanner(),
  editor,
  workspaces,
  history,
)

export default function apiHandler(request: IncomingMessage, response: ServerResponse): void {
  handler(request, response)
}
