import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPostgresPool } from './postgres'

const migrationDirectory = fileURLToPath(new URL('../../db/migrations', import.meta.url))
const pool = createPostgresPool()

async function migrate(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL
    )
  `)

  const files = (await readdir(migrationDirectory)).filter((file) => file.endsWith('.sql')).sort()
  for (const filename of files) {
    const { rows } = await pool.query<{ filename: string }>('SELECT filename FROM schema_migrations WHERE filename = $1', [filename])
    if (rows.length) continue
    const sql = await readFile(join(migrationDirectory, filename), 'utf8')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (filename, applied_at) VALUES ($1, NOW())', [filename])
      await client.query('COMMIT')
      console.log(`Applied ${filename}`)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
}

void migrate()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => pool.end())
