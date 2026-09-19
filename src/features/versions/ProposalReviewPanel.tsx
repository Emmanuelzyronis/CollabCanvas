import { useEffect, useState } from 'react'
import type { DesignProposal } from '../../../server/domain/version-types'
import { approveProposal, fetchProposal, rejectProposal, WorkspaceApiError } from '../../workspace'
import { Badge, Button, Panel, Stack, Text } from '../../ui/foundation'

function statusLabel(status: DesignProposal['status']): { text: string; tone: 'success' | 'warning' | 'neutral' } {
  if (status === 'approved') return { text: 'Applied', tone: 'success' }
  if (status === 'rejected') return { text: 'Discarded', tone: 'neutral' }
  return { text: 'Waiting for you', tone: 'warning' }
}

function changes(count: number): string {
  return count === 1 ? '1 change' : `${count} changes`
}

function elements(count: number): string {
  return count === 1 ? '1 element' : `${count} elements`
}

/** Leave the review view and reload the canonical design so the change is visible. */
function backToDesign(): void {
  const params = new URLSearchParams(window.location.search)
  params.delete('proposalId')
  params.set('surface', 'canvas')
  window.location.assign(`?${params.toString()}`)
}

export default function ProposalReviewPanel({ projectId, documentId, proposalId, reviewer = 'reviewer' }: { projectId: string; documentId: string; proposalId: string; reviewer?: string }) {
  const [proposal, setProposal] = useState<DesignProposal | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  useEffect(() => { let active = true; setError(undefined); void fetchProposal(projectId, documentId, proposalId).then((value) => { if (active) setProposal(value) }).catch((caught) => { if (active) setError(caught instanceof WorkspaceApiError ? caught.message : 'This suggestion is unavailable.') }); return () => { active = false } }, [projectId, documentId, proposalId])
  const review = async (approve: boolean) => { setBusy(true); setError(undefined); try { const result = approve ? await approveProposal(projectId, documentId, proposalId, reviewer) : await rejectProposal(projectId, documentId, proposalId, reviewer); setProposal('proposal' in result ? result.proposal : result) } catch (caught) { setError(caught instanceof WorkspaceApiError ? caught.message : 'The suggestion could not be reviewed.') } finally { setBusy(false) } }
  return <Panel className="m-4 max-w-xl p-5" data-proposal-review-state={error ? 'error' : proposal ? proposal.status : 'loading'}>
    <Stack gap="3">
      <div><Text role="title">Review suggestion</Text><Text muted>Check the assistant's change before it becomes part of your design.</Text></div>
      {!proposal && !error ? <Text muted>Loading suggestion…</Text> : error ? <Text className="text-red-700" aria-live="assertive">{error}</Text> : proposal ? <>
        <div className="flex flex-wrap gap-2"><Badge tone={statusLabel(proposal.status).tone}>{statusLabel(proposal.status).text}</Badge><Badge tone="neutral">{changes(proposal.operations.length)}</Badge></div>
        <Text>{proposal.rationale}</Text>
        <Text role="metadata" muted>{elements(proposal.affectedResourceIds.length)} affected</Text>
        {proposal.validation.valid ? null : <Text role="metadata" className="text-red-700">This change can't be applied: {proposal.validation.issues.map((issue) => issue.message).join(' ')}</Text>}
        {proposal.status === 'pending' && <div className="flex gap-2"><Button disabled={busy || !proposal.validation.valid} loading={busy} onClick={() => void review(true)}>Apply suggestion</Button><Button variant="danger" disabled={busy} onClick={() => void review(false)}>Discard</Button></div>}
        {proposal.status !== 'pending' && <div><Button variant="secondary" onClick={backToDesign}>Back to design</Button></div>}
      </> : null}
    </Stack>
  </Panel>
}
