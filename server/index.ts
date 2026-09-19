import { createApiServer } from './api/http.js'
import { DesignService } from './application/design-service.js'
import { CanvasGraphApplicationService } from './application/canvas-graph-service.js'
import { VersioningApplicationService } from './application/version-service.js'
import { EditorCommandApplicationService } from './application/editor-command-service.js'
import { EditorHistoryApplicationService } from './application/editor-history-service.js'
import { HumanWorkspaceService } from './application/workspace-service.js'
import { createPostgresPool, PostgresDesignRepository, PostgresVersionRepository } from './persistence/postgres.js'
import { loadRuntimeConfig } from './config.js'
import { CopilotApplicationService } from './application/copilot-service.js'
import { assistantDescriptor, createCopilotPlanner } from './application/azure-copilot-planner.js'
import { ManifestApplicationService } from './application/manifest-service.js'

const config = loadRuntimeConfig()
const pool = createPostgresPool(config.databaseUrl)
const repository = new PostgresDesignRepository(pool)
const service = new DesignService(repository)
const versionApplication = new VersioningApplicationService(repository, repository, new PostgresVersionRepository(pool))
const graphApplication = new CanvasGraphApplicationService(repository, repository, versionApplication)
const history = new EditorHistoryApplicationService(graphApplication, versionApplication)
const editor = new EditorCommandApplicationService(graphApplication, versionApplication, history)
const workspaces = new HumanWorkspaceService(repository, repository, versionApplication)
const manifestService = new ManifestApplicationService(repository, repository)
// Azure OpenAI when configured; deterministic planner otherwise.
const planner = createCopilotPlanner()
const server = createApiServer(service, manifestService, undefined, graphApplication, versionApplication, new CopilotApplicationService(versionApplication), planner, editor, workspaces, history)

server.listen(config.port, () => {
  console.log(`CollabCanvas API listening on http://localhost:${config.port}`)
  console.log(`CollabCanvas assistant: ${assistantDescriptor().provider}`)
})

const shutdown = async () => {
  server.close()
  await pool.end()
}

process.once('SIGINT', () => void shutdown())
process.once('SIGTERM', () => void shutdown())
