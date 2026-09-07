import { describe, expect, it } from 'vitest'
import { AgentHandoffApplicationService } from '../server/application/agent-handoff-service'
import { InvoiceFlowProofApplicationService } from '../server/application/invoiceflow-proof-service'
import { ManifestApplicationService } from '../server/application/manifest-service'
import { serializeDesignManifest } from '../server/domain/manifest-serialization'
import { AgentGateway } from '../server/gateway'
import { DevelopmentGatewayAuthenticator } from '../server/gateway/auth'
import { MemoryDesignGraphRepository } from '../server/persistence/memory-graph'
import { MemoryDesignRepository } from '../server/persistence/memory'
import { MemoryVersionRepository } from '../server/persistence/memory-versions'

function makeProof() {
  const resources = new MemoryDesignRepository()
  const graphs = new MemoryDesignGraphRepository()
  const versions = new MemoryVersionRepository()
  const proof = new InvoiceFlowProofApplicationService(resources, graphs, versions, {
    id: (() => { let sequence = 0; return () => `invoiceflow-version-${++sequence}` })(),
    now: () => '2026-09-06T00:00:00.000Z',
  })
  return { resources, graphs, versions, proof }
}

describe('InvoiceFlow flagship proof', () => {
  it('provisions, versions, approves, and hands off the canonical fixture', async () => {
    const { proof, resources, graphs } = makeProof()
    const result = await proof.run()

    expect(result.project).toMatchObject({ id: 'project_invoiceflow', name: 'InvoiceFlow' })
    expect(result.document).toMatchObject({ id: 'doc_invoiceflow', projectId: result.project.id })
    expect(result.page).toMatchObject({ id: 'page_invoiceflow_dashboard', documentId: result.document.id })
    expect(result.draft).toMatchObject({ status: 'draft', projectId: result.project.id, documentId: result.document.id })
    expect(result.approved).toMatchObject({ id: result.handoff.version.id, status: 'approved' })
    expect(result.handoff.manifest.document.id).toBe(result.document.id)
    expect(result.handoff.manifest.nodes.some((node) => node.name === 'Dashboard shell')).toBe(true)
    expect(result.handoff.manifest.componentDefinitions.map((component) => component.name)).toEqual(['InvoiceTable', 'MetricCard', 'PrimaryButton', 'StatusBadge'])
    expect(result.handoff.manifest.componentInstances).toHaveLength(4)
    expect(result.handoff.manifest.tokens.some((token) => token.category === 'spacing')).toBe(true)
    expect(result.handoff.manifest.typography).toHaveLength(2)
    expect(result.handoff.manifest.assets).toEqual([{ id: 'asset_invoiceflow_mark', kind: 'icon', name: 'InvoiceFlow mark', source: 'invoiceflow-mark', altText: 'InvoiceFlow' }])
    expect(result.handoff.manifest.pages[0]?.rootNodeIds).toEqual(['node_dashboard_shell'])
    expect(result.handoff.manifest.nodes.some((node) => node.responsive?.length)).toBe(true)
    expect(result.handoff.manifest.nodes.some((node) => node.accessibility?.role === 'button')).toBe(true)
    expect(result.handoff.manifest.nodes.some((node) => node.interactions?.some((interaction) => interaction.type === 'click'))).toBe(true)
    expect(result.handoff.manifest.intents).toHaveLength(3)
    expect(await resources.getProject(result.project.id)).toEqual(result.project)
    expect((await graphs.getDesignGraph(result.document.id))?.document.id).toBe(result.document.id)
  })

  it('retrieves the approved InvoiceFlow manifest through the existing gateway path', async () => {
    const { proof, resources, graphs, versions } = makeProof()
    const result = await proof.run()
    const application = new ManifestApplicationService(resources, graphs)
    const authenticator = new DevelopmentGatewayAuthenticator()
    authenticator.register({
      id: 'invoiceflow-proof-credential',
      agentId: 'invoiceflow-proof-agent',
      projectIds: [result.project.id],
      capabilities: ['READ_VERSION'],
      secret: 'invoiceflow-proof-secret',
    })
    const gateway = new AgentGateway(authenticator, application, new AgentHandoffApplicationService(versions))

    const handoff = await gateway.readApprovedVersion({
      requestId: 'invoiceflow-proof-request',
      credential: 'invoiceflow-proof-secret',
      projectId: result.project.id,
      documentId: result.document.id,
      versionId: result.approved.id,
      capability: 'READ_VERSION',
    })

    expect(serializeDesignManifest(handoff.data.manifest)).toBe(serializeDesignManifest(result.handoff.manifest))
    expect(handoff.data.version.manifestHash).toBe(result.handoff.version.manifestHash)
    expect(handoff.auditContext).toMatchObject({ operation: 'READ_APPROVED_VERSION', capability: 'READ_VERSION', outcome: 'succeeded' })
  })

  it('produces equivalent deterministic manifests and hashes for equivalent fixture runs', async () => {
    const first = await makeProof().proof.run()
    const second = await makeProof().proof.run()

    expect(serializeDesignManifest(first.handoff.manifest)).toBe(serializeDesignManifest(second.handoff.manifest))
    expect(first.handoff.version.graphHash).toBe(second.handoff.version.graphHash)
    expect(first.handoff.version.manifestHash).toBe(second.handoff.version.manifestHash)
  })

  it('does not fabricate a manifest when the richer graph source is unavailable', async () => {
    const resources = new MemoryDesignRepository()
    const graphs = {
      getDesignGraph: async () => null,
      saveDesignGraph: async () => { throw new Error('rich graph writer unavailable') },
    }
    const versions = new MemoryVersionRepository()
    const proof = new InvoiceFlowProofApplicationService(resources, graphs, versions)
    await expect(proof.run()).rejects.toThrow('rich graph writer unavailable')
  })
})
