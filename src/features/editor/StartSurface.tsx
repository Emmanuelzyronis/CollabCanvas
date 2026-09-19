import { useState } from 'react'
import { useCanvasStore } from '../../store/store'
import { buildProposalReviewHref, useWorkspaceContext } from '../../workspace'
import { Button, Text } from '../../ui/foundation'
import { useAssistantProposal } from '../copilot/useAssistantProposal'
import { specFor, type EditorToolKind } from './editorModel'

const SUGGESTIONS = [
  'A hero section with a headline, a supporting line and a primary button',
  'A navigation bar with links and a get started button',
  'Feature cards explaining what the product does',
]

const QUICK_ACTIONS: readonly EditorToolKind[] = ['text', 'heading', 'box', 'frame']

interface StartSurfaceProps {
  onInsertAt: (kind: EditorToolKind, rect: { x: number; y: number; width: number; height: number }) => void
}

/**
 * The first thing a person sees on an empty design.
 *
 * It offers the two entry points the product promises: describe the interface
 * and have the assistant draft it, or place the first element by hand. The
 * assistant never changes the design from here — it returns a suggestion the
 * person reviews before anything is applied.
 */
export default function StartSurface({ onInsertAt }: StartSurfaceProps) {
  const workspace = useWorkspaceContext()
  const { ask, busy, clear, error, preview, ready } = useAssistantProposal()
  const [instruction, setInstruction] = useState('')

  const submit = async () => {
    if (!instruction.trim()) return
    await ask(instruction)
  }

  const insert = (kind: EditorToolKind) => {
    const spec = specFor(kind)
    const { camera, viewport } = useCanvasStore.getState()
    const cx = camera.x + viewport.width / 2 / camera.zoom
    const cy = camera.y + viewport.height / 2 / camera.zoom
    onInsertAt(kind, { x: cx - spec.defaultWidth / 2, y: cy - spec.defaultHeight / 2, width: spec.defaultWidth, height: spec.defaultHeight })
  }

  const reviewHref = preview?.proposal
    ? buildProposalReviewHref(typeof window === 'undefined' ? { search: '' } : window.location, workspace, preview.proposal.id)
    : undefined

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-y-auto p-6" data-start-surface="true">
      <section className="pointer-events-auto w-full max-w-xl rounded-2xl border border-border-default bg-panel/95 p-6 shadow-floating backdrop-blur">
        <h1 className="text-lg font-semibold text-text-primary">What do you want to build?</h1>
        <p className="mt-1 text-sm leading-6 text-text-secondary">
          Describe the interface in your own words. You will see what the assistant proposes and decide whether it happens.
        </p>

        <label className="mt-5 block text-sm font-medium text-text-primary" htmlFor="start-instruction">
          Describe it
        </label>
        <textarea
          id="start-instruction"
          value={instruction}
          onChange={(event) => { setInstruction(event.target.value); clear() }}
          onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void submit() }}
          rows={3}
          placeholder="A hero section with a headline, a supporting line and a primary button"
          disabled={!ready}
          className="mt-2 w-full resize-y rounded-control border border-border-default bg-panel px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              data-start-suggestion={suggestion}
              onClick={() => { setInstruction(suggestion); clear() }}
              className="rounded-full border border-border-default px-3 py-1 text-xs text-text-secondary transition-colors hover:bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {suggestion}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button disabled={!ready || busy || !instruction.trim()} loading={busy} onClick={() => void submit()}>Draft it</Button>
          <Text role="metadata" muted>{ready ? 'Nothing changes until you approve it.' : 'Open a design to ask the assistant.'}</Text>
        </div>

        {error ? <p className="mt-3 text-sm text-red-700" role="alert">{error}</p> : null}

        {preview ? (
          <div className="mt-4 rounded-card border border-border-default bg-surface p-3" data-start-proposal={preview.status}>
            <p className="text-sm text-text-primary">{preview.summary}</p>
            <p className="mt-1 text-sm text-text-secondary">{preview.rationale}</p>
            {preview.clarification ? <p className="mt-2 text-sm text-amber-700">{preview.clarification}</p> : null}
            {preview.proposal && reviewHref ? (
              <a className="mt-3 inline-flex min-h-9 items-center rounded-control bg-accent px-3 text-sm font-medium text-white" href={reviewHref}>
                Review the suggestion
              </a>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 border-t border-border-subtle pt-4">
          <p className="text-sm text-text-secondary">Or start from scratch</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((kind) => {
              const spec = specFor(kind)
              return (
                <button
                  key={kind}
                  type="button"
                  data-quick-add={kind}
                  onClick={() => insert(kind)}
                  className="min-h-9 rounded-full border border-border-default bg-surface px-3.5 text-sm font-medium text-text-primary transition-colors hover:border-blue-500 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  Add {spec.label.toLowerCase()}
                </button>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
