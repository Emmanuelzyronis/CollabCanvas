import { createApiServer } from './api/http'
import { DesignService } from './application/design-service'
import { createPostgresPool, PostgresDesignRepository } from './persistence/postgres'
import { loadRuntimeConfig } from './config'

const config = loadRuntimeConfig()
const pool = createPostgresPool(config.databaseUrl)
const repository = new PostgresDesignRepository(pool)
const service = new DesignService(repository)
const server = createApiServer(service)

server.listen(config.port, () => {
  console.log(`CollabCanvas API listening on http://localhost:${config.port}`)
})

const shutdown = async () => {
  server.close()
  await pool.end()
}

process.once('SIGINT', () => void shutdown())
process.once('SIGTERM', () => void shutdown())
