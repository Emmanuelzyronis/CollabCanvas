import { describe, expect, it, beforeEach, vi } from 'vitest'
import { createServer } from 'node:http'
import { createApiRequestHandler } from '../server/api/http'
import { DesignService } from '../server/application/design-service'
import { MemoryDesignRepository } from '../server/persistence/memory'
import { SynchronizationApplicationService } from '../server/application/synchronization-service'
import { MemorySynchronizationRepository } from '../server/persistence/memory-synchronization'
import { VersioningApplicationService } from '../server/application/version-service'
import { MemoryVersionRepository } from '../server/persistence/memory-versions'
import type { ImplementationStatusReport, SynchronizationProposal } from '../server/domain/synchronization-types'

function makeSync(overrides?: { listReports?: ImplementationStatusReport[]; listProposals?: SynchronizationProposal[] }) {
  const repo = new MemorySynchronizationRepository()
  const graphRepo = new MemoryDesignRepository()
  const versionRepo = new MemoryVersionRepository()
  const versioning = new VersioningApplicationService(graphRepo, graphRepo, versionRepo)
  const service = new SynchronizationApplicationService(versioning, repo, repo)

  if (overrides?.listReports) {
    vi.spyOn(service, 'listImplementationReports').mockResolvedValue(overrides.listReports)
  }
  if (overrides?.listProposals) {
    vi.spyOn(service, 'listSyncProposals').mockResolvedValue(overrides.listProposals)
  }
  return service
}

async function get(path: string, synchronization?: SynchronizationApplicationService): Promise<{ status: number; body: unknown }> {
  const repo = new MemoryDesignRepository()
  const service = new DesignService(repo)
  const handler = createApiRequestHandler(service, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, synchronization)
  const server = createServer(handler)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as { port: number }
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`)
    const body: unknown = await response.json()
    return { status: response.status, body }
  } finally {
    server.close()
  }
}

describe('GET /api/v1/projects/:projectId/documents/:documentId/implementation-status', () => {
  it('returns 404 when synchronization service is not configured', async () => {
    const { status, body } = await get('/api/v1/projects/p1/documents/d1/implementation-status')
    expect(status).toBe(404)
    expect(body).toMatchObject({ error: { code: 'NOT_FOUND' } })
  })

  it('returns empty array when no reports exist', async () => {
    const sync = makeSync({ listReports: [] })
    const { status, body } = await get('/api/v1/projects/p1/documents/d1/implementation-status', sync)
    expect(status).toBe(200)
    expect((body as { data: unknown[] }).data).toEqual([])
  })

  it('returns implementation reports from the service', async () => {
    const report: ImplementationStatusReport = {
      id: 'r1', projectId: 'p1', documentId: 'd1', designVersionId: 'v1',
      reportedBy: 'ci-agent', repository: 'acme/app', status: 'implemented',
      surfaces: ['web'], reportedAt: new Date().toISOString(),
    }
    const sync = makeSync({ listReports: [report] })
    const { status, body } = await get('/api/v1/projects/p1/documents/d1/implementation-status', sync)
    expect(status).toBe(200)
    expect((body as { data: unknown[] }).data).toHaveLength(1)
    expect((body as { data: ImplementationStatusReport[] }).data[0].id).toBe('r1')
  })

  it('passes projectId and documentId from path parameters to the service', async () => {
    const sync = makeSync()
    const spy = vi.spyOn(sync, 'listImplementationReports').mockResolvedValue([])
    await get('/api/v1/projects/proj-42/documents/doc-99/implementation-status', sync)
    expect(spy).toHaveBeenCalledWith('proj-42', 'doc-99')
  })
})

describe('GET /api/v1/projects/:projectId/documents/:documentId/sync-proposals', () => {
  it('returns 404 when synchronization service is not configured', async () => {
    const { status, body } = await get('/api/v1/projects/p1/documents/d1/sync-proposals')
    expect(status).toBe(404)
    expect(body).toMatchObject({ error: { code: 'NOT_FOUND' } })
  })

  it('returns empty array when no proposals exist', async () => {
    const sync = makeSync({ listProposals: [] })
    const { status, body } = await get('/api/v1/projects/p1/documents/d1/sync-proposals', sync)
    expect(status).toBe(200)
    expect((body as { data: unknown[] }).data).toEqual([])
  })

  it('returns sync proposals from the service', async () => {
    const proposal: SynchronizationProposal = {
      id: 'sp1', projectId: 'p1', documentId: 'd1',
      fromVersionId: 'v1', toVersionId: 'v2',
      implementationReportId: 'r1',
      impact: { fromVersionId: 'v1', toVersionId: 'v2', fromHash: 'h1', toHash: 'h2', equivalent: false, changes: [], affectedResourceIds: [], affectedSemanticSurfaces: [], implementationSurfaces: [] },
      rationale: 'Update to match design v2', createdBy: 'ci-agent',
      createdAt: new Date().toISOString(), status: 'pending',
    }
    const sync = makeSync({ listProposals: [proposal] })
    const { status, body } = await get('/api/v1/projects/p1/documents/d1/sync-proposals', sync)
    expect(status).toBe(200)
    expect((body as { data: SynchronizationProposal[] }).data[0].id).toBe('sp1')
  })

  it('passes projectId and documentId from path parameters to the service', async () => {
    const sync = makeSync()
    const spy = vi.spyOn(sync, 'listSyncProposals').mockResolvedValue([])
    await get('/api/v1/projects/proj-42/documents/doc-99/sync-proposals', sync)
    expect(spy).toHaveBeenCalledWith('proj-42', 'doc-99')
  })
})

describe('Implementation navigation', () => {
  it('LeftPanel includes an Implementation navigation item', async () => {
    const { readFile } = await import('node:fs/promises')
    const source = await readFile(new URL('../src/ui/shell/LeftPanel.tsx', import.meta.url), 'utf8')
    expect(source).toContain("label: 'Implementation'")
    expect(source).toContain("surface: 'implementation'")
  })

  it('App.tsx handles the implementation surface', async () => {
    const { readFile } = await import('node:fs/promises')
    const source = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
    expect(source).toContain("surface === 'implementation'")
    expect(source).toContain('AgentStatusPanel')
  })

  it('AgentStatusPanel uses human-facing label (not internal terminology)', async () => {
    const { readFile } = await import('node:fs/promises')
    const source = await readFile(new URL('../src/features/agent/AgentStatusPanel.tsx', import.meta.url), 'utf8')
    expect(source).not.toMatch(/agent.?center|agent.?gateway|design.?graph|canonical.?graph|webmcp|manifest/i)
    expect(source).toContain('Implementation')
  })
})
