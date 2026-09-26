import { useEffect, useState } from 'react'
import type { ImplementationStatusReport, SynchronizationProposal } from '../../../server/domain/synchronization-types'
import { fetchImplementationReports, fetchSyncProposals, WorkspaceApiError } from '../../application/commands'
import { Badge, Button, Panel, Skeleton, Stack, Text } from '../../ui/foundation'

const STATUS_TONE: Record<string, 'success' | 'warning' | 'neutral'> = {
  implemented: 'success',
  drift_detected: 'warning',
  sync_proposed: 'warning',
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ')
}

export default function AgentStatusPanel({ projectId, documentId }: { projectId: string; documentId: string }) {
  const [reports, setReports] = useState<ImplementationStatusReport[]>([])
  const [proposals, setProposals] = useState<SynchronizationProposal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()

  const refresh = async () => {
    setLoading(true)
    setError(undefined)
    try {
      const [r, p] = await Promise.all([
        fetchImplementationReports(projectId, documentId),
        fetchSyncProposals(projectId, documentId),
      ])
      setReports(r)
      setProposals(p)
    } catch (caught) {
      setError(caught instanceof WorkspaceApiError ? caught.message : 'Implementation status unavailable.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [projectId, documentId])

  return (
    <Panel className="m-4 max-w-xl p-5" data-implementation-state={loading ? 'loading' : error ? 'error' : 'ready'}>
      <Stack gap="3">
        <div>
          <Text role="title">Implementation</Text>
          <Text muted>Evidence reported from repositories linked to this design.</Text>
        </div>

        {loading ? (
          <Stack gap="2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-14 w-full" />
          </Stack>
        ) : error ? (
          <Text role="body" className="text-red-700" aria-live="assertive">{error}</Text>
        ) : (
          <>
            <section aria-label="Implementation reports">
              <Text role="label" className="mb-2">Reports</Text>
              {reports.length === 0 ? (
                <Text muted>No implementation reports yet.</Text>
              ) : (
                <Stack gap="2">
                  {reports.map((report) => (
                    <div key={report.id} className="flex items-center gap-3 rounded border border-[color:var(--border)] p-3 text-sm">
                      <Badge tone={STATUS_TONE[report.status] ?? 'neutral'}>{statusLabel(report.status)}</Badge>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{report.repository}{report.branch ? ` · ${report.branch}` : ''}</div>
                        {report.commit && <div className="truncate text-xs text-[color:var(--fg-muted)]">{report.commit.slice(0, 8)}</div>}
                      </div>
                      <div className="shrink-0 text-xs text-[color:var(--fg-muted)]">{new Date(report.reportedAt).toLocaleDateString()}</div>
                    </div>
                  ))}
                </Stack>
              )}
            </section>

            <section aria-label="Sync proposals">
              <Text role="label" className="mb-2">Sync proposals</Text>
              {proposals.length === 0 ? (
                <Text muted>No sync proposals pending.</Text>
              ) : (
                <Stack gap="2">
                  {proposals.map((proposal) => (
                    <div key={proposal.id} className="rounded border border-[color:var(--border)] p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge tone="warning">pending</Badge>
                        <span className="truncate">{proposal.rationale}</span>
                      </div>
                      <div className="mt-1 text-xs text-[color:var(--fg-muted)]">
                        {proposal.impact.changes.length} change{proposal.impact.changes.length !== 1 ? 's' : ''} · by {proposal.createdBy}
                      </div>
                    </div>
                  ))}
                </Stack>
              )}
            </section>

            <Button variant="quiet" onClick={() => void refresh()}>Refresh</Button>
          </>
        )}
      </Stack>
    </Panel>
  )
}
