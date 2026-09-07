import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { newDb } from 'pg-mem'
import { DesignService } from '../server/application/design-service'
import { PostgresDesignRepository } from '../server/persistence/postgres'

const migration = readFileSync(new URL('../db/migrations/001_initial.sql', import.meta.url), 'utf8')

describe('PostgresDesignRepository', () => {
  it('persists and retrieves a page graph using the migration schema', async () => {
    const database = newDb({ autoCreateForeignKeyIndices: true })
    database.public.none(migration)
    const { Pool } = database.adapters.createPg()
    const pool = new Pool()
    let sequence = 0
    const service = new DesignService(new PostgresDesignRepository(pool), {
      id: () => `pg-${++sequence}`,
      now: () => '2026-09-05T00:00:00.000Z',
    })

    const project = await service.createProject({ name: 'Persisted project' })
    const document = await service.createDocument(project.id, { name: 'Persisted document' })
    const page = await service.createPage(document.id, { name: 'Persisted page' })
    const root = await service.createNode(page.id, { type: 'section', name: 'Root' })
    await service.createNode(page.id, { parentId: root.id, type: 'text', name: 'Child' })

    const retrieved = await service.getPage(page.id)
    expect(retrieved.nodes).toHaveLength(2)
    expect(retrieved.nodes[1].parentId).toBe(root.id)
    expect(await service.getProject(project.id)).toMatchObject({ id: project.id, slug: 'persisted-project' })
    await pool.end()
  })
})
