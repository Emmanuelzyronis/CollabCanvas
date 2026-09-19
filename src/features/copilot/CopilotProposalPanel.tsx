import { useEffect, useMemo, useState } from 'react'
import type { CopilotProposalPreview } from '../../../server/domain/copilot-types'
import { buildProposalReviewHref, fetchAssistantStatus, useWorkspaceContext, type AssistantStatus } from '../../workspace'
import { Badge, Button, Panel, Stack, Text } from '../../ui/foundation'
import { proposalImpact, useAssistantProposal } from './useAssistantProposal'

const EXAMPLES = [
  'Add a hero section',
  'Add a navigation bar',
  'Move the selected element inside the header',
  'Remove the selected element',
]

function previewStatus(status: CopilotProposalPreview['status']): { label: string; tone: 'success' | 'warning' | 'neutral' } {
  if (status === 'ready') return { label: 'Ready to review', tone: 'success' }
  if (status === 'blocked') return { label: "Can't do that yet", tone: 'warning' }
  return { label: 'Needs a little more detail', tone: 'warning' }
}

function providerLabel(provider: AssistantStatus['provider'] | undefined): string {
  if (provider === 'azure-openai') return 'Azure OpenAI connected'
  return 'Built-in assistant'
}

function elements(count: number): string {
  return count === 1 ? '1 element' : `${count} elements`
}

export default function CopilotProposalPanel() {
  const workspace = useWorkspaceContext()
  const { ask, busy, clear, error, preview, ready, selectedNodeIds } = useAssistantProposal()
  const [instruction, setInstruction] = useState('')
  const [assistant, setAssistant] = useState<AssistantStatus>()

  useEffect(() => {
    void fetchAssistantStatus().then(setAssistant).catch(() => undefined)
  }, [])

  const canAsk = Boolean(instruction.trim()) && ready
  const status = preview ? previewStatus(preview.status) : undefined
  const reviewHref = preview?.proposal ? buildProposalReviewHref(typeof window === 'undefined' ? { search: '' } : window.location, workspace, preview.proposal.id) : undefined

  const submit = async () => { if (canAsk) await ask(instruction) }

  const selectedSummary = useMemo(() => (selectedNodeIds.length ? `${elements(selectedNodeIds.length)} selected` : 'Nothing selected yet'), [selectedNodeIds.length])

  return <Panel className="w-full max-w-md p-4 shadow-panel" data-copilot-proposal-state={error ? 'error' : preview?.status ?? 'idle'}>
    <Stack gap="3">
      <div>
        <Text role="title">Design assistant</Text>
        <Text muted>Describe a change in plain language. You review every suggestion before it is applied.</Text>
      </div>
      <Text role="metadata" muted data-assistant-provider={assistant?.provider ?? 'unknown'}>{providerLabel(assistant?.provider)}</Text>
      <textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="Describe the change you want to make…" rows={3} disabled={workspace.availability !== 'GRAPH_AVAILABLE'} className="w-full resize-y rounded-control border border-border-default bg-panel px-3 py-2 text-sm text-text-primary placeholder:text-text-muted" aria-label="Ask the design assistant" />
      <div className="flex flex-wrap gap-2">{EXAMPLES.map((example) => <button key={example} type="button" onClick={() => { setInstruction(example); clear() }} className="rounded-full border border-border-default px-3 py-1 text-xs text-text-secondary hover:bg-hover hover:text-text-primary">{example}</button>)}</div>
      <Text role="metadata" muted>{selectedSummary}{workspace.availability === 'GRAPH_AVAILABLE' ? '' : ' · open a design to ask'}</Text>
      <Button disabled={!canAsk || busy} loading={busy} onClick={() => void submit()}>Suggest a change</Button>
      {error ? <Text className="text-red-700" aria-live="assertive">{error}</Text> : null}
      {preview ? <div className="space-y-2 border-t border-border-default pt-3">
        <div className="flex flex-wrap gap-2">{status ? <Badge tone={status.tone}>{status.label}</Badge> : null}{preview.proposal ? <Badge tone="neutral">{elements(proposalImpact(preview))} affected</Badge> : null}</div>
        <Text>{preview.summary}</Text>
        {preview.rationale ? <Text muted>{preview.rationale}</Text> : null}
        {preview.clarification ? <Text className="text-amber-700">{preview.clarification}</Text> : null}
        {preview.proposal && reviewHref ? <a className="inline-flex min-h-9 items-center rounded-control bg-accent px-3 text-sm font-medium text-white" href={reviewHref}>Review suggestion</a> : null}
      </div> : null}
    </Stack>
  </Panel>
}
