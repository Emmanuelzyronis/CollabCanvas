import { once } from 'node:events'
import { describe, expect, it } from 'vitest'
import { createApiServer } from '../server/api/http'
import { AgentHandoffApplicationService } from '../server/application/agent-handoff-service'
import { VersioningApplicationService } from '../server/application/version-service'
import { createInvoiceFlowGraph } from '../server/domain/fixtures/invoiceflow'
import { serializeDesignManifest } from '../server/domain/manifest-serialization'
import { AgentGateway } from '../server/gateway'
import { DevelopmentGatewayAuthenticator } from '../server/gateway/auth'
import { MemoryDesignGraphRepository } from '../server/persistence/memory-graph'
import { MemoryDesignRepository } from '../server/persistence/memory'
import { MemoryVersionRepository } from '../server/persistence/memory-versions'

const graph = createInvoiceFlowGraph()

async function setup(capabilities: ('READ_MANIFEST' | 'READ_VERSION')[] = ['READ_VERSION'], projectIds = [graph.project.id]) {
  const resources = new MemoryDesignRepository()
  const graphs = new MemoryDesignGraphRepository([graph])
  await resources.createProject(graph.project)
  await resources.createDocument(graph.document)
  const versions = new MemoryVersionRepository()
  const versioning = new VersioningApplicationService(resources, graphs, versions, {
    id: (() => { let n = 0; return () => `handoff-${++n}` })(),
    now: () => '2026-09-06T00:00:00.000Z',
  })
  const draft = await versioning.createDraft(graph.document.id, 'designer')
  const approved = await versioning.approveVersion(draft.id, 'reviewer')
  const handoff = new AgentHandoffApplicationService(versions)
  const authenticator = new DevelopmentGatewayAuthenticator()
  authenticator.register({ id: 'handoff-credential', agentId: 'agent-codex', projectIds, capabilities, secret: 'handoff-secret' })
  return { gateway: new AgentGateway(authenticator, { getDocumentManifest: async () => handoff.getApprovedVersionHandoff(approved.id).then((value) => value.manifest) }, handoff), approved }
}

function request(approvedId: string, overrides: Partial<{ requestId: string; projectId: string; documentId: string; versionId: string; credential: string | undefined; capability: 'READ_VERSION' }> = {}) {
  return { requestId: 'handoff-request', credential: 'handoff-secret', projectId: graph.project.id, documentId: graph.document.id, versionId: approvedId, capability: 'READ_VERSION' as const, ...overrides }
}

describe('approved-version agent handoff', () => {
  it('returns an approved version manifest with deterministic provenance', async () => {
    const { gateway, approved } = await setup()
    const result = await gateway.readApprovedVersion(request(approved.id))

    expect(result.data.handoffVersion).toBe('1')
    expect(result.data.version).toMatchObject({ id: approved.id, number: 1, status: 'approved', graphHash: approved.graphHash })
    expect(result.data.project.id).toBe(graph.project.id)
    expect(result.data.document.id).toBe(graph.document.id)
    expect(result.data.manifest.document.id).toBe(graph.document.id)
    expect(result.auditContext).toMatchObject({ capability: 'READ_VERSION', operation: 'READ_APPROVED_VERSION', outcome: 'succeeded' })
    expect(Object.isFrozen(result.auditContext)).toBe(true)
  })

  it.each([
    ['missing credential', { credential: undefined }, 'UNAUTHENTICATED'],
    ['invalid credential', { credential: 'wrong' }, 'INVALID_CREDENTIAL'],
    ['out-of-scope project', { projectId: 'other-project' }, 'PROJECT_SCOPE_DENIED'],
  ] as const)('%s is rejected before handoff', async (_label, overrides, code) => {
    const { gateway, approved } = await setup()
    await expect(gateway.readApprovedVersion(request(approved.id, overrides))).rejects.toMatchObject({ code })
  })

  it('rejects inactive and capability-missing credentials', async () => {
    const inactive = await setup()
    const inactiveAuth = new DevelopmentGatewayAuthenticator()
    inactiveAuth.register({ id: 'inactive', agentId: 'agent', projectIds: [graph.project.id], capabilities: ['READ_VERSION'], secret: 'inactive-secret', active: false })
    const inactiveGateway = new AgentGateway(inactiveAuth, { getDocumentManifest: async () => { throw new Error('not called') } }, new AgentHandoffApplicationService(new MemoryVersionRepository()))
    await expect(inactiveGateway.readApprovedVersion(request(inactive.approved.id, { credential: 'inactive-secret' }))).rejects.toMatchObject({ code: 'INVALID_CREDENTIAL' })

    const noCapability = await setup([])
    await expect(noCapability.gateway.readApprovedVersion(request(noCapability.approved.id))).rejects.toMatchObject({ code: 'CAPABILITY_DENIED' })
  })

  it('does not hand drafts to agents', async () => {
    const resources = new MemoryDesignRepository()
    const graphs = new MemoryDesignGraphRepository([graph])
    await resources.createProject(graph.project)
    await resources.createDocument(graph.document)
    const versions = new MemoryVersionRepository()
    const versioning = new VersioningApplicationService(resources, graphs, versions, { id: () => 'draft-only', now: () => '2026-09-06T00:00:00.000Z' })
    const draft = await versioning.createDraft(graph.document.id, 'designer')
    const auth = new DevelopmentGatewayAuthenticator()
    auth.register({ id: 'credential', agentId: 'agent', projectIds: [graph.project.id], capabilities: ['READ_VERSION'], secret: 'secret' })
    const gateway = new AgentGateway(auth, { getDocumentManifest: async () => { throw new Error('not called') } }, new AgentHandoffApplicationService(versions))
    await expect(gateway.readApprovedVersion(request(draft.id, { credential: 'secret' }))).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' })
  })

  it('enforces trusted project/document identity after authorization', async () => {
    const { gateway, approved } = await setup(['READ_VERSION'], ['other-project'])
    await expect(gateway.readApprovedVersion(request(approved.id, { projectId: 'other-project' }))).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' })
  })

  it('returns the same deterministic manifest on repeated handoffs', async () => {
    const { gateway, approved } = await setup()
    const first = await gateway.readApprovedVersion(request(approved.id, { requestId: 'a' }))
    const second = await gateway.readApprovedVersion(request(approved.id, { requestId: 'b' }))
    expect(serializeDesignManifest(first.data.manifest)).toBe(serializeDesignManifest(second.data.manifest))
    expect(first.data.version.manifestHash).toBe(second.data.version.manifestHash)
  })

  it('does not expose credentials in the handoff or audit context', async () => {
    const { gateway, approved } = await setup()
    const result = await gateway.readApprovedVersion(request(approved.id))
    expect(JSON.stringify(result)).not.toContain('handoff-secret')
    expect(JSON.stringify(result.auditContext)).not.toContain('handoff-secret')
  })

  it('exposes the handoff through the distinct gateway HTTP namespace', async () => {
    const { gateway, approved } = await setup()
    const server = createApiServer({} as never, undefined, gateway).listen(0)
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Test server did not expose a port.')
    const base = `http://127.0.0.1:${address.port}`

    const missing = await fetch(`${base}/api/v1/gateway/approved-version?projectId=${graph.project.id}&documentId=${graph.document.id}&versionId=${approved.id}`)
    expect(missing.status).toBe(401)
    const response = await fetch(`${base}/api/v1/gateway/approved-version?projectId=${graph.project.id}&documentId=${graph.document.id}&versionId=${approved.id}`, { headers: { authorization: 'Bearer handoff-secret' } })
    expect(response.status).toBe(200)
    const body = await response.json() as { data: { version: { id: string; status: string } } }
    expect(body.data.version).toMatchObject({ id: approved.id, status: 'approved' })
    server.close()
  })
})
