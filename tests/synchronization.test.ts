import { describe, expect, it } from 'vitest'
import { VersioningApplicationService } from '../server/application/version-service'
import { SynchronizationApplicationService } from '../server/application/synchronization-service'
import { createInvoiceFlowGraph } from '../server/domain/fixtures/invoiceflow'
import { AgentGateway } from '../server/gateway'
import { DevelopmentGatewayAuthenticator } from '../server/gateway/auth'
import { MemoryDesignGraphRepository } from '../server/persistence/memory-graph'
import { MemoryDesignRepository } from '../server/persistence/memory'
import { MemorySynchronizationRepository } from '../server/persistence/memory-synchronization'
import { MemoryVersionRepository } from '../server/persistence/memory-versions'

const graph = createInvoiceFlowGraph()

async function setup() {
  const resources = new MemoryDesignRepository()
  const graphs = new MemoryDesignGraphRepository([graph])
  const versions = new MemoryVersionRepository()
  await resources.createProject(graph.project)
  await resources.createDocument(graph.document)
  let sequence = 0
  const versioning = new VersioningApplicationService(resources, graphs, versions, {
    id: () => `sync-version-${++sequence}`,
    now: () => '2026-09-06T00:00:00.000Z',
  })
  const firstDraft = await versioning.createDraft(graph.document.id, 'designer')
  const firstApproved = await versioning.approveVersion(firstDraft.id, 'reviewer')
  const change = await versioning.createProposal({
    projectId: graph.project.id,
    documentId: graph.document.id,
    baseVersionId: firstApproved.id,
    operations: [{ type: 'moveNode', nodeId: 'node_dashboard_title', parentId: null }],
    rationale: 'Promote the title to the page root.',
    author: 'designer',
  })
  const nextDraft = (await versioning.approveProposal(change.id, 'reviewer')).version
  const secondApproved = await versioning.approveVersion(nextDraft.id, 'reviewer')
  const repository = new MemorySynchronizationRepository()
  const synchronization = new SynchronizationApplicationService(versioning, repository, repository, {
    id: (() => { let id = 0; return () => `sync-record-${++id}` })(),
    now: () => '2026-09-06T01:00:00.000Z',
  })
  return { resources, graphs, versions, versioning, repository, synchronization, firstApproved, secondApproved }
}

describe('design/code synchronization foundation', () => {
  it('records implementation status against an approved version with normalized evidence', async () => {
    const { synchronization, firstApproved, repository } = await setup()
    const report = await synchronization.reportImplementationStatus({
      projectId: graph.project.id,
      documentId: graph.document.id,
      designVersionId: firstApproved.id,
      reportedBy: 'agent-codex',
      repository: 'invoiceflow-web',
      branch: 'main',
      commit: 'abc123',
      environment: 'staging',
      status: 'implemented',
      surfaces: ['app/dashboard/page.tsx', 'app/dashboard/page.tsx', 'components/MetricCard.tsx'],
      notes: 'Implemented the approved dashboard contract.',
    })

    expect(report).toMatchObject({
      projectId: graph.project.id,
      documentId: graph.document.id,
      designVersionId: firstApproved.id,
      reportedBy: 'agent-codex',
      status: 'implemented',
      surfaces: ['app/dashboard/page.tsx', 'components/MetricCard.tsx'],
    })
    expect(await repository.getImplementationStatus(report.id)).toEqual(report)
  })

  it('rejects implementation evidence for drafts or another project/document', async () => {
    const { synchronization, versioning } = await setup()
    const draft = await versioning.createDraft(graph.document.id, 'designer-2')
    await expect(synchronization.reportImplementationStatus({
      projectId: graph.project.id,
      documentId: graph.document.id,
      designVersionId: draft.id,
      reportedBy: 'agent',
      repository: 'repo',
      status: 'implementing',
    })).rejects.toMatchObject({ code: 'VERSION_IMMUTABLE' })
    await expect(synchronization.reportImplementationStatus({
      projectId: 'other-project',
      documentId: graph.document.id,
      designVersionId: draft.id,
      reportedBy: 'agent',
      repository: 'repo',
      status: 'implemented',
    })).rejects.toMatchObject({ code: 'VERSION_IMMUTABLE' })
  })

  it('computes deterministic semantic impact between approved versions', async () => {
    const { synchronization, firstApproved, secondApproved } = await setup()
    const impact = await synchronization.compareApprovedVersions(firstApproved.id, secondApproved.id)

    expect(impact.equivalent).toBe(false)
    expect(impact.changes).toContainEqual({ entityType: 'node', entityId: 'node_dashboard_title', kind: 'updated' })
    expect(impact.affectedResourceIds).toEqual(['node_dashboard_title', 'node_primary_button'])
    expect(impact.affectedSemanticSurfaces).toEqual(['node:node_dashboard_title', 'node:node_primary_button'])
    expect(impact.implementationSurfaces).toEqual([])
  })

  it('creates a pending sync proposal without mutating approved design state', async () => {
    const { synchronization, firstApproved, secondApproved, repository } = await setup()
    const report = await synchronization.reportImplementationStatus({
      projectId: graph.project.id,
      documentId: graph.document.id,
      designVersionId: firstApproved.id,
      reportedBy: 'agent-codex',
      repository: 'invoiceflow-web',
      status: 'implemented',
      surfaces: ['app/dashboard/page.tsx'],
    })
    const proposal = await synchronization.proposeSynchronization({
      projectId: graph.project.id,
      documentId: graph.document.id,
      fromVersionId: firstApproved.id,
      toVersionId: secondApproved.id,
      implementationReportId: report.id,
      rationale: 'Review the dashboard title hierarchy change before updating implementation.',
      createdBy: 'agent-codex',
    })

    expect(proposal).toMatchObject({
      projectId: graph.project.id,
      documentId: graph.document.id,
      fromVersionId: firstApproved.id,
      toVersionId: secondApproved.id,
      implementationReportId: report.id,
      status: 'pending',
    })
    expect(proposal.impact.implementationSurfaces).toEqual(['app/dashboard/page.tsx'])
    expect(await repository.getSynchronizationProposal(proposal.id)).toEqual(proposal)
    expect(firstApproved.graph.nodes.find((node) => node.id === 'node_dashboard_title')?.parentId).toBe('node_dashboard_header')
  })

  it('rejects equivalent versions and reports that do not match the base version', async () => {
    const { synchronization, firstApproved, secondApproved } = await setup()
    const report = await synchronization.reportImplementationStatus({
      projectId: graph.project.id,
      documentId: graph.document.id,
      designVersionId: secondApproved.id,
      reportedBy: 'agent-codex',
      repository: 'invoiceflow-web',
      status: 'implemented',
    })
    await expect(synchronization.proposeSynchronization({
      projectId: graph.project.id,
      documentId: graph.document.id,
      fromVersionId: firstApproved.id,
      toVersionId: secondApproved.id,
      implementationReportId: report.id,
      rationale: 'Wrong base report.',
      createdBy: 'agent-codex',
    })).rejects.toMatchObject({ code: 'INVALID_REFERENCE' })

    await expect(synchronization.proposeSynchronization({
      projectId: graph.project.id,
      documentId: graph.document.id,
      fromVersionId: secondApproved.id,
      toVersionId: secondApproved.id,
      implementationReportId: report.id,
      rationale: 'No change.',
      createdBy: 'agent-codex',
    })).rejects.toMatchObject({ code: 'CONFLICT' })

    const inProgress = await synchronization.reportImplementationStatus({
      projectId: graph.project.id,
      documentId: graph.document.id,
      designVersionId: firstApproved.id,
      reportedBy: 'agent-codex',
      repository: 'invoiceflow-web',
      status: 'implementing',
    })
    await expect(synchronization.proposeSynchronization({
      projectId: graph.project.id,
      documentId: graph.document.id,
      fromVersionId: firstApproved.id,
      toVersionId: secondApproved.id,
      implementationReportId: inProgress.id,
      rationale: 'Too early to synchronize.',
      createdBy: 'agent-codex',
    })).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})

describe('synchronization gateway policy', () => {
  it('derives report authorship from authenticated identity and delegates to the application service', async () => {
    const { synchronization, firstApproved } = await setup()
    const authenticator = new DevelopmentGatewayAuthenticator()
    authenticator.register({ id: 'status-credential', agentId: 'agent-codex', projectIds: [graph.project.id], capabilities: ['REPORT_IMPLEMENTATION_STATUS'], secret: 'status-secret' })
    const gateway = new AgentGateway(authenticator, { getDocumentManifest: async () => { throw new Error('not called') } }, undefined, synchronization)

    const result = await gateway.reportImplementationStatus({
      requestId: 'status-request',
      credential: 'status-secret',
      projectId: graph.project.id,
      documentId: graph.document.id,
      designVersionId: firstApproved.id,
      repository: 'invoiceflow-web',
      status: 'implemented',
      surfaces: ['app/dashboard/page.tsx'],
      capability: 'REPORT_IMPLEMENTATION_STATUS',
    })

    expect(result.data.reportedBy).toBe('agent-codex')
    expect(result.auditContext).toMatchObject({ operation: 'REPORT_IMPLEMENTATION_STATUS', capability: 'REPORT_IMPLEMENTATION_STATUS', outcome: 'succeeded' })
  })

  it('enforces explicit sync capability and project scope', async () => {
    const { synchronization, firstApproved, secondApproved } = await setup()
    const reportAuth = new DevelopmentGatewayAuthenticator()
    reportAuth.register({ id: 'report', agentId: 'agent-codex', projectIds: [graph.project.id], capabilities: ['REPORT_IMPLEMENTATION_STATUS'], secret: 'report-secret' })
    const reportGateway = new AgentGateway(reportAuth, { getDocumentManifest: async () => { throw new Error('not called') } }, undefined, synchronization)
    const report = await reportGateway.reportImplementationStatus({
      requestId: 'report-request', credential: 'report-secret', projectId: graph.project.id, documentId: graph.document.id,
      designVersionId: firstApproved.id, repository: 'invoiceflow-web', status: 'implemented', capability: 'REPORT_IMPLEMENTATION_STATUS',
    })

    const auth = new DevelopmentGatewayAuthenticator()
    auth.register({ id: 'sync', agentId: 'agent-codex', projectIds: [graph.project.id], capabilities: ['PROPOSE_SYNC'], secret: 'sync-secret' })
    const gateway = new AgentGateway(auth, { getDocumentManifest: async () => { throw new Error('not called') } }, undefined, synchronization)
    const proposal = await gateway.proposeSynchronization({
      requestId: 'sync-request', credential: 'sync-secret', projectId: graph.project.id, documentId: graph.document.id,
      fromVersionId: firstApproved.id, toVersionId: secondApproved.id, implementationReportId: report.data.id,
      rationale: 'Review changed dashboard hierarchy.', capability: 'PROPOSE_SYNC',
    })
    expect(proposal.data.status).toBe('pending')

    await expect(gateway.proposeSynchronization({
      requestId: 'scope-request', credential: 'sync-secret', projectId: 'other-project', documentId: graph.document.id,
      fromVersionId: firstApproved.id, toVersionId: secondApproved.id, implementationReportId: report.data.id,
      rationale: 'Should be denied.', capability: 'PROPOSE_SYNC',
    })).rejects.toMatchObject({ code: 'PROJECT_SCOPE_DENIED' })

    const noCapability = new DevelopmentGatewayAuthenticator()
    noCapability.register({ id: 'none', agentId: 'agent-codex', projectIds: [graph.project.id], capabilities: [], secret: 'none-secret' })
    const denied = new AgentGateway(noCapability, { getDocumentManifest: async () => { throw new Error('not called') } }, undefined, synchronization)
    await expect(denied.proposeSynchronization({
      requestId: 'capability-request', credential: 'none-secret', projectId: graph.project.id, documentId: graph.document.id,
      fromVersionId: firstApproved.id, toVersionId: secondApproved.id, implementationReportId: report.data.id,
      rationale: 'Should be denied.', capability: 'PROPOSE_SYNC',
    })).rejects.toMatchObject({ code: 'CAPABILITY_DENIED' })
  })
})
