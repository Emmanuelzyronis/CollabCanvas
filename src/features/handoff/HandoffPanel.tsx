import { useEffect, useState } from 'react'
import { Button, Divider, Inline, Panel, Stack, Text } from '../../ui/foundation'
import { fetchDocumentManifest, WorkspaceApiError } from '../../application/commands'
import { useWorkspaceContext } from '../../workspace'
import { handoffFailure, handoffLoading, projectHandoff, type HandoffState } from './handoffProjection'

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}

function download(name: string, value: string): void {
  const url = URL.createObjectURL(new Blob([value], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function CopyButton({ value, label, primary }: { value: string; label: string; primary?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant={primary ? 'primary' : 'secondary'}
      onClick={() => {
        void copyText(value).then((ok) => {
          setCopied(ok)
          if (ok) setTimeout(() => setCopied(false), 2000)
        })
      }}
    >
      {copied ? 'Copied' : label}
    </Button>
  )
}

export default function HandoffPanel() {
  const workspace = useWorkspaceContext()
  const [state, setState] = useState<HandoffState>(() => handoffLoading())

  useEffect(() => {
    const documentId = workspace.documentId
    if (!documentId || workspace.availability !== 'GRAPH_AVAILABLE') {
      setState({ availability: 'HANDOFF_UNAVAILABLE' })
      return
    }
    let active = true
    setState(handoffLoading())
    fetchDocumentManifest(documentId)
      .then((manifest) => {
        if (active) setState(projectHandoff(manifest))
      })
      .catch((error: unknown) => {
        if (!active) return
        const failure = error instanceof WorkspaceApiError ? error : new WorkspaceApiError('HANDOFF_UNAVAILABLE', 'The handoff could not be prepared.', 0)
        setState(handoffFailure(failure.code, failure.message))
      })
    return () => { active = false }
  }, [workspace.documentId, workspace.availability])

  if (state.availability === 'HANDOFF_LOADING') {
    return <Panel className="p-6" data-handoff-state="loading"><Text muted>Preparing the handoff…</Text></Panel>
  }
  if (state.availability !== 'HANDOFF_READY' || !state.summary) {
    return (
      <Panel className="border-dashed p-6" data-handoff-state={state.availability === 'HANDOFF_INVALID' ? 'invalid' : 'unavailable'}>
        <Text role="heading">{state.availability === 'HANDOFF_INVALID' ? 'This design cannot be handed off yet' : 'Handoff is unavailable'}</Text>
        <Text muted className="mt-2">{state.error?.message ?? 'Open a design first, then prepare the handoff.'}</Text>
      </Panel>
    )
  }

  const { summary } = state
  const fileName = `design-handoff-${workspace.documentId.slice(0, 8)}.json`

  return (
    <div className="grid gap-4" data-handoff-state="ready">
      <Panel className="p-5">
        <Stack gap="2">
          <Text role="title">Handoff</Text>
          <Text muted>This is the structured design a coding agent receives — hierarchy, layout, styles, components, and assets. Paste the brief into Codex or Claude Code, or hand over the design file.</Text>
          <Inline gap="2" wrap className="pt-1">
            <CopyButton primary label="Copy implementation brief" value={summary.brief} />
            <CopyButton label="Copy design file" value={summary.json} />
            <Button variant="secondary" onClick={() => download(fileName, summary.json)}>Download design file</Button>
            <Text role="metadata" muted>{Math.round(summary.bytes / 1024)} KB · {workspace.version ? `version ${workspace.version.number} (${workspace.version.status})` : 'current design'}</Text>
          </Inline>
        </Stack>
      </Panel>

      <Panel className="p-5">
        <Text role="label" muted>What is in this handoff</Text>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {summary.counts.map((count) => (
            <div key={count.label} className="rounded-card border border-border-subtle bg-surface p-3">
              <p className="text-xs text-text-muted">{count.label}</p>
              <p className="mt-1 text-2xl font-semibold text-text-primary" data-handoff-count={count.label.toLowerCase().replace(/\s+/g, '-')}>{count.value}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="p-5">
        <Text role="label" muted>Structure</Text>
        <ul className="mt-3 grid gap-1" data-handoff-outline="true">
          {summary.outline.map((row) => (
            <li key={row.id} className="flex min-w-0 items-center gap-2 text-sm" style={{ paddingLeft: `${row.depth * 16}px` }}>
              <span className="min-w-0 flex-1 truncate text-text-primary">{row.name}</span>
              <span className="shrink-0 text-[10px] uppercase text-text-muted">{row.kind}</span>
            </li>
          ))}
          {summary.outline.length === 0 ? <li className="text-sm text-text-muted">No layers yet.</li> : null}
        </ul>
      </Panel>

      {summary.tokens.length > 0 || summary.components.length > 0 ? (
        <Panel className="p-5">
          <div className="grid gap-4 md:grid-cols-2">
            {summary.tokens.length > 0 ? (
              <div>
                <Text role="label" muted>Design tokens</Text>
                <ul className="mt-3 grid gap-1 text-sm">
                  {summary.tokens.map((token) => (
                    <li key={token.name} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-text-primary">{token.name}</span>
                      <span className="shrink-0 font-mono text-[11px] text-text-muted">{token.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {summary.components.length > 0 ? (
              <div>
                <Text role="label" muted>Components</Text>
                <ul className="mt-3 grid gap-1 text-sm">
                  {summary.components.map((component) => (
                    <li key={component.name} className="truncate text-text-primary">
                      {component.name}
                      {component.variants.length > 0 ? <span className="ml-2 text-[11px] text-text-muted">{component.variants.join(' · ')}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </Panel>
      ) : null}

      <Panel className="p-5">
        <Inline justify="between" className="pb-3">
          <Text role="label" muted>Implementation brief</Text>
          <CopyButton label="Copy" value={summary.brief} />
        </Inline>
        <Divider />
        <pre data-handoff-brief="true" className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-card bg-surface p-3 text-[11px] leading-5 text-text-secondary">{summary.brief}</pre>
      </Panel>

      <details className="rounded-panel border border-border-subtle bg-panel p-5">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-text-secondary">Design file (JSON)</summary>
        <div className="mt-3">
          <pre data-handoff-json="true" className="max-h-72 overflow-auto rounded-card bg-surface p-3 text-[11px] leading-5 text-text-secondary">{summary.json}</pre>
        </div>
      </details>
    </div>
  )
}
