import { describe, expect, it } from 'vitest'
import { createProposeSyncTool, createReportImplementationStatusTool, createSynchronizationToolRegistry, proposeSyncInputSchema, reportImplementationStatusInputSchema } from '../server/mcp'
import type { GatewayImplementationStatusResponse, GatewaySynchronizationProposalResponse } from '../server/gateway/contracts'

const reportResponse: GatewayImplementationStatusResponse = {
  data: { id: 'report-1', projectId: 'project', documentId: 'document', designVersionId: 'version-1', reportedBy: 'agent', repository: 'repo', status: 'implemented', surfaces: [], reportedAt: '2026-09-06T00:00:00.000Z' },
  auditContext: { requestId: 'request', agentId: 'agent', projectId: 'project', capability: 'REPORT_IMPLEMENTATION_STATUS', operation: 'REPORT_IMPLEMENTATION_STATUS', outcome: 'succeeded' },
}

const proposalResponse: GatewaySynchronizationProposalResponse = {
  data: { id: 'proposal-1', projectId: 'project', documentId: 'document', fromVersionId: 'version-1', toVersionId: 'version-2', implementationReportId: 'report-1', impact: { fromVersionId: 'version-1', toVersionId: 'version-2', fromHash: 'from', toHash: 'to', equivalent: false, changes: [], affectedResourceIds: [], affectedSemanticSurfaces: [], implementationSurfaces: [] }, rationale: 'Review design changes.', createdBy: 'agent', createdAt: '2026-09-06T00:00:00.000Z', status: 'pending' },
  auditContext: { requestId: 'request', agentId: 'agent', projectId: 'project', capability: 'PROPOSE_SYNC', operation: 'PROPOSE_SYNC', outcome: 'succeeded' },
}

describe('semantic synchronization tools', () => {
  it('exposes typed report/propose contracts without changing the 33 browser tools', () => {
    const gateway = {
      reportImplementationStatus: async (): Promise<GatewayImplementationStatusResponse> => reportResponse,
      proposeSynchronization: async (): Promise<GatewaySynchronizationProposalResponse> => proposalResponse,
    }
    const registry = createSynchronizationToolRegistry(gateway)
    expect(registry.list().map((tool) => tool.name)).toEqual(['report_implementation_status', 'propose_sync'])
    expect(registry.list().map((tool) => tool.capability)).toEqual(['REPORT_IMPLEMENTATION_STATUS', 'PROPOSE_SYNC'])
    expect(reportImplementationStatusInputSchema.required).toContain('requestId')
    expect(proposeSyncInputSchema.required).toContain('rationale')
    expect(createReportImplementationStatusTool(gateway).name).toBe('report_implementation_status')
    expect(createProposeSyncTool(gateway).name).toBe('propose_sync')
  })

  it('delegates both tools to the gateway and derives no caller-supplied author', async () => {
    const calls: unknown[] = []
    const gateway = {
      reportImplementationStatus: async (request: unknown): Promise<GatewayImplementationStatusResponse> => { calls.push(request); return { ...reportResponse, auditContext: { ...reportResponse.auditContext, requestId: 'report-request' } } },
      proposeSynchronization: async (request: unknown): Promise<GatewaySynchronizationProposalResponse> => { calls.push(request); return { ...proposalResponse, auditContext: { ...proposalResponse.auditContext, requestId: 'sync-request' } } },
    }
    const registry = createSynchronizationToolRegistry(gateway)
    const report = await registry.call('report_implementation_status', { projectId: 'project', documentId: 'document', designVersionId: 'version-1', repository: 'repo', status: 'implemented', credential: 'secret', requestId: 'report-request' })
    const proposal = await registry.call('propose_sync', { projectId: 'project', documentId: 'document', fromVersionId: 'version-1', toVersionId: 'version-2', implementationReportId: 'report-1', rationale: 'Review design changes.', credential: 'secret', requestId: 'sync-request' })

    expect(report).toMatchObject({ data: { id: 'report-1' }, requestId: 'report-request' })
    expect(proposal).toMatchObject({ data: { id: 'proposal-1' }, requestId: 'sync-request' })
    expect(JSON.stringify(calls)).not.toContain('reportedBy')
    expect(JSON.stringify(calls)).not.toContain('createdBy')
  })

  it('preserves gateway error codes and hides unexpected internal errors', async () => {
    const gateway = {
      reportImplementationStatus: async (): Promise<GatewayImplementationStatusResponse> => { throw new Error('database password=secret') },
      proposeSynchronization: async (): Promise<GatewaySynchronizationProposalResponse> => { throw new Error('database password=secret') },
    }
    const result = await createSynchronizationToolRegistry(gateway).call('report_implementation_status', { projectId: 'project', documentId: 'document', designVersionId: 'version', repository: 'repo', status: 'implemented', credential: 'secret', requestId: 'request' })
    expect(result).toMatchObject({ error: { code: 'UPSTREAM_APPLICATION_ERROR' } })
    expect(JSON.stringify(result)).not.toContain('password')
  })
})
