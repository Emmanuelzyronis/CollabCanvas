import { once } from 'node:events'
import { describe, expect, it } from 'vitest'
import { createApiServer } from '../server/api/http'
import { CopilotApplicationService } from '../server/application/copilot-service'
import { DeterministicCopilotPlanner } from '../server/application/copilot-planner'
import { DesignService } from '../server/application/design-service'
import { VersioningApplicationService } from '../server/application/version-service'
import { createInvoiceFlowGraph } from '../server/domain/fixtures/invoiceflow'
import { DomainError } from '../server/domain/errors'
import { MemoryDesignGraphRepository } from '../server/persistence/memory-graph'
import { MemoryDesignRepository } from '../server/persistence/memory'
import { MemoryVersionRepository } from '../server/persistence/memory-versions'
import type { CopilotPlanner } from '../server/domain/copilot-types'

const graph = createInvoiceFlowGraph()

async function setup(planner: CopilotPlanner = new DeterministicCopilotPlanner(), canonicalGraph = graph) {
  const resources = new MemoryDesignRepository()
  await resources.createProject(canonicalGraph.project)
  await resources.createDocument(canonicalGraph.document)
  const graphs = new MemoryDesignGraphRepository([canonicalGraph])
  const versions = new MemoryVersionRepository()
  let sequence = 0
  const versioning = new VersioningApplicationService(resources, graphs, versions, { id: () => `http-${++sequence}`, now: () => '2026-09-09T00:00:00.000Z' })
  const draft = await versioning.createDraft(canonicalGraph.document.id, 'designer')
  const approved = await versioning.approveVersion(draft.id, 'reviewer')
  const service = new DesignService(resources)
  const server = createApiServer(service, undefined, undefined, undefined, versioning, new CopilotApplicationService(versioning), planner).listen(0)
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('No test port')
  const base = `http://127.0.0.1:${address.port}`
  const post = (projectId: string, documentId: string, body: unknown) => fetch(`${base}/api/v1/projects/${projectId}/documents/${documentId}/copilot/proposals`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  return { server, versioning, approved, post }
}

const bodyFor = (approvedId: string, extra: Record<string, unknown> = {}) => ({ pageId: graph.page.id, baseVersionId: approvedId, trustedVersionId: approvedId, instruction: 'Move the selected layer under dashboard header.', selectedNodeIds: ['node_dashboard_title'], author: 'copilot', ...extra })

describe('Copilot proposal HTTP contract', () => {
  it('returns a scoped structured proposal for a valid move request', async () => {
    const { server, approved, post } = await setup()
    const response = await post(graph.project.id, graph.document.id, bodyFor(approved.id))
    expect(response.status).toBe(201)
    const payload = await response.json() as { data: { status: string; proposal: { id: string; projectId: string; documentId: string; baseVersionId: string; operations: unknown[] } } }
    expect(payload.data.status).toBe('ready')
    expect(payload.data.proposal).toMatchObject({ projectId: graph.project.id, documentId: graph.document.id, baseVersionId: approved.id })
    expect(payload.data.proposal.operations).toHaveLength(1)
    const review = await fetch(`${new URL(response.url).origin}/api/v1/projects/${graph.project.id}/documents/${graph.document.id}/proposals/${payload.data.proposal.id}`)
    expect(review.status).toBe(200)
    expect((await review.json() as { data: { baseVersionId: string; projectId: string; documentId: string } }).data).toMatchObject({ baseVersionId: approved.id, projectId: graph.project.id, documentId: graph.document.id })
    server.close()
  })

  it('returns a scoped structured proposal for a valid delete request', async () => {
    const { server, approved, post } = await setup()
    const response = await post(graph.project.id, graph.document.id, bodyFor(approved.id, { instruction: 'Delete the selected layer.', selectedNodeIds: ['node_primary_button'] }))
    expect(response.status).toBe(201)
    const payload = await response.json() as { data: { status: string; operations: unknown[]; proposal: { operations: unknown[] } } }
    expect(payload.data.status).toBe('ready')
    expect(payload.data.operations).toEqual([{ type: 'deleteNode', nodeId: 'node_primary_button' }])
    expect(payload.data.proposal.operations).toEqual(payload.data.operations)
    server.close()
  })

  it('reports the active assistant without exposing configuration', async () => {
    const { server } = await setup()
    const address = server.address(); if (!address || typeof address === 'string') throw new Error('No test port')
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/assistant`)
    expect(response.status).toBe(200)
    const payload = await response.json() as { data: { provider: string; connected: boolean; supports: string[] } }
    expect(payload.data).toMatchObject({ provider: 'builtin', connected: true })
    expect(JSON.stringify(payload)).not.toMatch(/api-?key|secret|endpoint|deployment/i)
    server.close()
  })

  it.each([
    ['wrong project', 'other-project', graph.document.id, 'INVALID_REFERENCE'],
    ['wrong document', graph.project.id, 'other-document', 'INVALID_REFERENCE'],
  ])('rejects %s scope', async (_label, projectId, documentId, code) => {
    const { server, approved, post } = await setup()
    const response = await post(projectId, documentId, bodyFor(approved.id))
    expect(response.status).toBe(400)
    expect((await response.json() as { error: { code: string } }).error.code).toBe(code)
    server.close()
  })

  it('rejects trusted-context version drift and stale approved versions', async () => {
    const { server, approved, post, versioning } = await setup()
    let response = await post(graph.project.id, graph.document.id, bodyFor(approved.id, { trustedVersionId: 'different-version' }))
    expect(response.status).toBe(409)
    expect((await response.json() as { error: { code: string } }).error.code).toBe('VERSION_CONFLICT')
    const draft = await versioning.createDraft(graph.document.id, 'designer-2')
    await versioning.approveVersion(draft.id, 'reviewer-2')
    response = await post(graph.project.id, graph.document.id, bodyFor(approved.id))
    expect(response.status).toBe(409)
    expect((await response.json() as { error: { code: string } }).error.code).toBe('VERSION_CONFLICT')
    server.close()
  })

  it.each([
    ['unavailable graph', async () => { throw new DomainError('GRAPH_UNAVAILABLE', 'Canonical graph unavailable.') }],
    ['invalid graph', async () => { throw new DomainError('INVALID_GRAPH', 'Canonical graph invalid.') }],
  ])('returns deterministic %s errors without a proposal', async (_label, getVersion) => {
    const resources = new MemoryDesignRepository()
    const service = new DesignService(resources)
    const fakeVersioning = { getVersion, createProposal: async () => { throw new Error('must not create') } }
    const server = createApiServer(service, undefined, undefined, undefined, undefined, new CopilotApplicationService(fakeVersioning as never), new DeterministicCopilotPlanner()).listen(0)
    await once(server, 'listening')
    const address = server.address(); if (!address || typeof address === 'string') throw new Error('No test port')
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/projects/${graph.project.id}/documents/${graph.document.id}/copilot/proposals`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(bodyFor('v1')) })
    expect(response.status).toBe(_label === 'invalid graph' ? 422 : 503)
    expect((await response.json() as { error: { code: string } }).error.code).toBe(_label === 'invalid graph' ? 'INVALID_GRAPH' : 'GRAPH_UNAVAILABLE')
    server.close()
  })

  it.each([
    ['missing node', { selectedNodeIds: ['missing-node'] }, 'INVALID_REFERENCE'],
    ['wrong page', { pageId: 'other-page' }, 'INVALID_REFERENCE'],
    ['unsupported intent', { instruction: 'Rename this button to Get Started.', selectedNodeIds: ['node_primary_button'] }, undefined],
    ['malformed operation input', { selectedNodeIds: 'node_primary_button' }, 'VALIDATION_ERROR'],
  ])('handles %s safely', async (_label, extra, code) => {
    const { server, approved, post } = await setup()
    const response = await post(graph.project.id, graph.document.id, bodyFor(approved.id, extra))
    if (code) {
      expect((await response.json() as { error: { code: string } }).error.code).toBe(code)
    } else {
      const payload = await response.json() as { data: { status: string; proposal?: unknown } }
      expect(payload.data.status).toBe('clarification')
      expect(payload.data.proposal).toBeUndefined()
    }
    server.close()
  })

  it('returns validation errors for malformed JSON and missing required fields', async () => {
    const { server, approved } = await setup()
    const address = server.address(); if (!address || typeof address === 'string') throw new Error('No test port')
    const url = `http://127.0.0.1:${address.port}/api/v1/projects/${graph.project.id}/documents/${graph.document.id}/copilot/proposals`
    const malformed = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' })
    expect(malformed.status).toBe(400)
    expect((await malformed.json() as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR')
    const missing = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ baseVersionId: approved.id }) })
    expect(missing.status).toBe(400)
    server.close()
  })

  it('rejects malformed planner operations without creating an executable proposal', async () => {
    const planner: CopilotPlanner = { async plan() { return { operations: [{ type: 'moveNode', nodeId: 'node_dashboard_title', parentId: 'missing-parent' }], rationale: 'bad operation' } } }
    const { server, approved, post } = await setup(planner)
    const response = await post(graph.project.id, graph.document.id, bodyFor(approved.id))
    expect(response.status).toBe(201)
    const payload = await response.json() as { data: { status: string; proposal?: unknown; validation: { valid: boolean } } }
    expect(payload.data.status).toBe('clarification')
    expect(payload.data.proposal).toBeUndefined()
    expect(payload.data.validation.valid).toBe(false)
    server.close()
  })

  it('returns clarification for an ambiguous canonical node reference', async () => {
    const original = graph.nodes.find((node) => node.id === 'node_dashboard_header')!
    const duplicate = { ...original, id: 'node_duplicate_header', orderIndex: Math.max(...graph.nodes.filter((node) => node.parentId === original.parentId).map((node) => node.orderIndex)) + 1 }
    const ambiguousGraph = { ...graph, nodes: [...graph.nodes, duplicate] }
    const { server, approved, post } = await setup(new DeterministicCopilotPlanner(), ambiguousGraph)
    const response = await post(graph.project.id, graph.document.id, bodyFor(approved.id, { instruction: 'Delete Dashboard Header', selectedNodeIds: [] }))
    const payload = await response.json() as { data: { status: string; proposal?: unknown; rationale: string } }
    expect(payload.data.status).toBe('clarification')
    expect(payload.data.proposal).toBeUndefined()
    expect(payload.data.rationale).toContain('Several layers match')
    server.close()
  })

  it('ignores client-provided graph data and validates against the canonical version', async () => {
    const { server, approved, post } = await setup()
    const response = await post(graph.project.id, graph.document.id, bodyFor(approved.id, { graph: { nodes: [{ id: 'injected-node' }] }, selectedNodeIds: ['injected-node'] }))
    expect(response.status).toBe(400)
    expect((await response.json() as { error: { code: string } }).error.code).toBe('INVALID_REFERENCE')
    server.close()
  })

  it('keeps stale proposal approval at VERSION_CONFLICT without graph mutation', async () => {
    const { server, approved, post, versioning } = await setup()
    const created = await post(graph.project.id, graph.document.id, bodyFor(approved.id))
    const proposal = (await created.json() as { data: { proposal: { id: string } } }).data.proposal
    const draft = await versioning.createDraft(graph.document.id, 'designer-2')
    await versioning.approveVersion(draft.id, 'reviewer-2')
    const before = await versioning.getVersion(draft.id)
    const address = server.address(); if (!address || typeof address === 'string') throw new Error('No test port')
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/projects/${graph.project.id}/documents/${graph.document.id}/proposals/${proposal.id}/approve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reviewedBy: 'reviewer' }) })
    expect(response.status).toBe(409)
    expect((await response.json() as { error: { code: string } }).error.code).toBe('VERSION_CONFLICT')
    expect(await versioning.getVersion(draft.id)).toEqual(before)
    server.close()
  })
})
