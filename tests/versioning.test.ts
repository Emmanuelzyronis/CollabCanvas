import { describe, expect, it } from 'vitest'
import { CanvasGraphApplicationService } from '../server/application/canvas-graph-service'
import { VersioningApplicationService } from '../server/application/version-service'
import { createInvoiceFlowGraph } from '../server/domain/fixtures/invoiceflow'
import { hashDesignGraph } from '../server/domain/versioning'
import { MemoryDesignGraphRepository } from '../server/persistence/memory-graph'
import { MemoryDesignRepository } from '../server/persistence/memory'
import { MemoryVersionRepository } from '../server/persistence/memory-versions'

const fixture = createInvoiceFlowGraph()

async function setup() {
  const resources = new MemoryDesignRepository()
  const graphs = new MemoryDesignGraphRepository([fixture])
  const versions = new MemoryVersionRepository()
  await resources.createProject(fixture.project)
  await resources.createDocument(fixture.document)
  let sequence = 0
  const service = new VersioningApplicationService(resources, graphs, versions, {
    id: () => `version-test-${++sequence}`,
    now: () => '2026-09-06T00:00:00.000Z',
  })
  return { resources, graphs, versions, service }
}

describe('versioning and proposal semantics', () => {
  it('creates a deterministic draft snapshot with a stable graph hash', async () => {
    const { service } = await setup()
    const draft = await service.createDraft(fixture.document.id, 'designer')

    expect(draft).toMatchObject({ projectId: fixture.project.id, documentId: fixture.document.id, number: 1, status: 'draft', createdBy: 'designer' })
    expect(draft.graphHash).toBe(hashDesignGraph(fixture))
    expect(draft.graph).not.toBe(fixture)
  })

  it('approves drafts but refuses to approve an already approved immutable version', async () => {
    const { service } = await setup()
    const draft = await service.createDraft(fixture.document.id, 'designer')
    const approved = await service.approveVersion(draft.id, 'reviewer')

    expect(approved.status).toBe('approved')
    expect(approved.approvedBy).toBe('reviewer')
    await expect(service.approveVersion(approved.id, 'reviewer-2')).rejects.toMatchObject({ code: 'VERSION_IMMUTABLE' })
  })

  it('prevents canvas mutations after approval when the version guard is configured', async () => {
    const { resources, graphs, service } = await setup()
    const draft = await service.createDraft(fixture.document.id, 'designer')
    await service.approveVersion(draft.id, 'reviewer')
    const canvasApplication = new CanvasGraphApplicationService(resources, graphs, service)

    await expect(canvasApplication.moveNode(fixture.document.id, 'node_dashboard_title', null)).rejects.toMatchObject({ code: 'APPROVAL_REQUIRED' })
    expect((await graphs.getDesignGraph(fixture.document.id))?.nodes.find((node) => node.id === 'node_dashboard_title')?.parentId).toBe('node_dashboard_header')
  })

  it('keeps the mutable draft snapshot synchronized with canvas mutations', async () => {
    const { resources, graphs, service } = await setup()
    const draft = await service.createDraft(fixture.document.id, 'designer')
    const canvasApplication = new CanvasGraphApplicationService(resources, graphs, service)

    await canvasApplication.moveNode(fixture.document.id, 'node_dashboard_title', null)
    const synchronized = await service.getVersion(draft.id)
    expect(synchronized.status).toBe('draft')
    expect(synchronized.graph.nodes.find((node) => node.id === 'node_dashboard_title')?.parentId).toBeNull()
    expect(synchronized.graphHash).toBe(hashDesignGraph(synchronized.graph))

    const approved = await service.approveVersion(draft.id, 'reviewer')
    expect(approved.graph.nodes.find((node) => node.id === 'node_dashboard_title')?.parentId).toBeNull()
  })

  it('creates and validates a proposal without mutating the approved graph', async () => {
    const { service, graphs } = await setup()
    const draft = await service.createDraft(fixture.document.id, 'designer')
    const approved = await service.approveVersion(draft.id, 'reviewer')
    const proposal = await service.createProposal({
      projectId: fixture.project.id,
      documentId: fixture.document.id,
      baseVersionId: approved.id,
      operations: [{ type: 'moveNode', nodeId: 'node_dashboard_title', parentId: null }],
      rationale: 'Promote the title to the page root.',
      author: 'agent-codex',
    })

    expect(proposal.status).toBe('pending')
    expect(proposal.validation).toEqual({ valid: true, issues: [] })
    expect(proposal.affectedResourceIds).toEqual(['node_dashboard_title'])
    expect((await graphs.getDesignGraph(fixture.document.id))?.nodes.find((node) => node.id === 'node_dashboard_title')?.parentId).toBe('node_dashboard_header')
  })

  it('approving a proposal creates a new draft and leaves the approved version unchanged', async () => {
    const { service, graphs } = await setup()
    const initial = await service.createDraft(fixture.document.id, 'designer')
    const approved = await service.approveVersion(initial.id, 'reviewer')
    const proposal = await service.createProposal({
      projectId: fixture.project.id,
      documentId: fixture.document.id,
      baseVersionId: approved.id,
      operations: [{ type: 'deleteNode', nodeId: 'node_invoice_table' }],
      rationale: 'Remove the table from this experimental draft.',
      author: 'designer',
    })

    const result = await service.approveProposal(proposal.id, 'reviewer')
    expect(result.proposal.status).toBe('approved')
    expect(result.version.status).toBe('draft')
    expect(result.version.number).toBe(2)
    expect((await service.getVersion(approved.id)).status).toBe('approved')
    expect((await service.getVersion(approved.id)).graph.nodes.some((node) => node.id === 'node_invoice_table')).toBe(true)
    expect((await graphs.getDesignGraph(fixture.document.id))?.nodes.some((node) => node.id === 'node_invoice_table')).toBe(false)
  })

  it('targets the working draft and applies approval into that same draft', async () => {
    const { service, graphs } = await setup()
    const draft = await service.createDraft(fixture.document.id, 'designer')
    const proposal = await service.createProposal({
      projectId: fixture.project.id,
      documentId: fixture.document.id,
      baseVersionId: draft.id,
      operations: [{ type: 'moveNode', nodeId: 'node_dashboard_title', parentId: null }],
      rationale: 'Promote the dashboard title.',
      author: 'design-assistant',
    })
    expect(proposal.validation.valid).toBe(true)

    const result = await service.approveProposal(proposal.id, 'reviewer')
    // The draft is mutable, so approval updates it instead of spawning a second one.
    expect(result.version.id).toBe(draft.id)
    expect(result.version.status).toBe('draft')
    expect(result.version.graphHash).not.toBe(draft.graphHash)
    expect((await service.listVersions(fixture.document.id)).filter((version) => version.status === 'draft')).toHaveLength(1)
    expect((await graphs.getDesignGraph(fixture.document.id))?.nodes.find((node) => node.id === 'node_dashboard_title')?.parentId).toBe(null)
  })

  it('refuses a proposal whose base is not the current working version', async () => {
    const { service } = await setup()
    const firstDraft = await service.createDraft(fixture.document.id, 'designer')
    await service.approveVersion(firstDraft.id, 'reviewer')
    const workingDraft = await service.createDraft(fixture.document.id, 'designer-2')

    // Once editing resumes on a draft, the approved snapshot is no longer the base.
    await expect(service.createProposal({
      projectId: fixture.project.id,
      documentId: fixture.document.id,
      baseVersionId: firstDraft.id,
      operations: [{ type: 'deleteNode', nodeId: 'node_status_badge' }],
      rationale: 'Remove the badge.',
      author: 'design-assistant',
    })).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })

    // The working draft itself is a valid base.
    const proposal = await service.createProposal({
      projectId: fixture.project.id,
      documentId: fixture.document.id,
      baseVersionId: workingDraft.id,
      operations: [{ type: 'deleteNode', nodeId: 'node_status_badge' }],
      rationale: 'Remove the badge.',
      author: 'design-assistant',
    })
    expect(proposal.baseVersionId).toBe(workingDraft.id)
  })

  it('records invalid proposals and refuses to approve them', async () => {
    const { service } = await setup()
    const draft = await service.createDraft(fixture.document.id, 'designer')
    const approved = await service.approveVersion(draft.id, 'reviewer')
    const proposal = await service.createProposal({
      projectId: fixture.project.id,
      documentId: fixture.document.id,
      baseVersionId: approved.id,
      operations: [{ type: 'moveNode', nodeId: 'node_dashboard_shell', parentId: 'node_dashboard_title' }],
      rationale: 'This would create a hierarchy cycle.',
      author: 'agent-codex',
    })

    expect(proposal.validation.valid).toBe(false)
    expect(proposal.validation.issues.map((issue) => issue.code)).toContain('CYCLE')
    await expect(service.approveProposal(proposal.id, 'reviewer')).rejects.toMatchObject({ code: 'PROPOSAL_INVALID' })
  })

  it('rejects stale proposal bases instead of overwriting a newer approved version', async () => {
    const { service } = await setup()
    const firstDraft = await service.createDraft(fixture.document.id, 'designer')
    const firstApproved = await service.approveVersion(firstDraft.id, 'reviewer')
    const stale = await service.createProposal({
      projectId: fixture.project.id,
      documentId: fixture.document.id,
      baseVersionId: firstApproved.id,
      operations: [{ type: 'deleteNode', nodeId: 'node_status_badge' }],
      rationale: 'Remove the badge.',
      author: 'agent-one',
    })
    const competing = await service.createProposal({
      projectId: fixture.project.id,
      documentId: fixture.document.id,
      baseVersionId: firstApproved.id,
      operations: [{ type: 'moveNode', nodeId: 'node_dashboard_title', parentId: null }],
      rationale: 'Move the title.',
      author: 'agent-two',
    })
    const nextDraft = (await service.approveProposal(competing.id, 'reviewer')).version
    await service.approveVersion(nextDraft.id, 'reviewer')

    await expect(service.approveProposal(stale.id, 'reviewer')).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
  })

  it('compares semantic graph state rather than editor screenshots', async () => {
    const { service } = await setup()
    const first = await service.createDraft(fixture.document.id, 'designer')
    const approved = await service.approveVersion(first.id, 'reviewer')
    const proposal = await service.createProposal({
      projectId: fixture.project.id,
      documentId: fixture.document.id,
      baseVersionId: approved.id,
      operations: [{ type: 'moveNode', nodeId: 'node_dashboard_title', parentId: null }],
      rationale: 'Semantic hierarchy change.',
      author: 'designer',
    })
    const changed = (await service.approveProposal(proposal.id, 'reviewer')).version
    const comparison = await service.compareVersions(approved.id, changed.id)

    expect(comparison.equivalent).toBe(false)
    expect(comparison.changes).toContainEqual({ entityType: 'node', entityId: 'node_dashboard_title', kind: 'updated' })
    expect(comparison.changes.some((change) => change.entityType === 'node')).toBe(true)
  })

  it('supports explicit proposal rejection without changing graph state', async () => {
    const { service, graphs } = await setup()
    const draft = await service.createDraft(fixture.document.id, 'designer')
    const approved = await service.approveVersion(draft.id, 'reviewer')
    const proposal = await service.createProposal({
      projectId: fixture.project.id,
      documentId: fixture.document.id,
      baseVersionId: approved.id,
      operations: [{ type: 'deleteNode', nodeId: 'node_invoice_table' }],
      rationale: 'Reject this change for now.',
      author: 'designer',
    })

    const rejected = await service.rejectProposal(proposal.id, 'reviewer')
    expect(rejected.status).toBe('rejected')
    expect((await graphs.getDesignGraph(fixture.document.id))?.nodes.some((node) => node.id === 'node_invoice_table')).toBe(true)
  })
})
