import { useState } from 'react'
import clsx from 'clsx'
import { createBlankWorkspace, WorkspaceApiError, type WorkspacePreset } from '../../application/commands'

const PRESETS: readonly { id: WorkspacePreset; title: string; description: string; glyph: string }[] = [
  { id: 'blank', title: 'Blank canvas', description: 'An empty canvas to start anything.', glyph: '▢' },
  { id: 'website', title: 'Website', description: 'Start from a landing page: hero, copy, CTA and image.', glyph: '◧' },
  { id: 'flyer', title: 'Flyer', description: 'Start from an event flyer you can restyle.', glyph: '▤' },
  { id: 'logo', title: 'Logo', description: 'Start from a mark and wordmark canvas.', glyph: '✦' },
]

const DEMO_HREF = '?projectId=project_invoiceflow&documentId=doc_invoiceflow&pageId=page_invoiceflow_dashboard&surface=canvas'

export default function NewDesignScreen() {
  const [busy, setBusy] = useState<WorkspacePreset | null>(null)
  const [error, setError] = useState<string>()

  const create = async (preset: WorkspacePreset) => {
    setBusy(preset)
    setError(undefined)
    try {
      const result = await createBlankWorkspace(preset)
      const params = new URLSearchParams()
      params.set('projectId', result.project.id)
      params.set('documentId', result.document.id)
      params.set('pageId', result.page.id)
      params.set('surface', 'canvas')
      window.history.pushState({}, '', `?${params.toString()}`)
      window.dispatchEvent(new PopStateEvent('popstate'))
    } catch (caught) {
      if (caught instanceof WorkspaceApiError && caught.status === 0) {
        setError('CollabCanvas could not reach its API. Run `npm run api` in a second terminal, then retry.')
      } else {
        setError(caught instanceof Error ? caught.message : 'The workspace could not be created.')
      }
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center overflow-y-auto bg-canvas p-6" data-new-design-screen="true">
      <main className="w-full max-w-3xl">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">CollabCanvas</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary">Start designing</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-text-secondary">Create a design, add elements, move and resize them, and keep working after you reload. Every change is saved as you work.</p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              data-preset={preset.id}
              disabled={busy !== null}
              onClick={() => void create(preset.id)}
              className={clsx('group rounded-2xl border border-border-default bg-panel p-6 text-left shadow-subtle transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 hover:-translate-y-0.5 hover:border-blue-500 hover:shadow-panel', busy === preset.id && 'opacity-70')}
            >
              <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface text-2xl text-blue-700 ring-1 ring-border-subtle transition-colors group-hover:bg-blue-50">{preset.glyph}</span>
              <span className="mt-4 block text-base font-semibold text-text-primary">{preset.title}</span>
              <span className="mt-1 block text-sm leading-5 text-text-secondary">{preset.description}</span>
              <span className="mt-4 block text-xs font-medium text-blue-700">{busy === preset.id ? 'Creating…' : 'Create design →'}</span>
            </button>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          {error ? <p role="alert" data-create-error="true" className="max-w-xl rounded-xl border border-error bg-panel px-4 py-2 text-sm text-error">{error}</p> : null}
          <a className="text-xs text-text-muted underline decoration-border-strong underline-offset-4 hover:text-text-secondary" href={DEMO_HREF}>Open the InvoiceFlow demo design</a>
        </div>
      </main>
    </div>
  )
}
