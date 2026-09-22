import { useRef, useState } from 'react'
import clsx from 'clsx'
import { createBlankWorkspace, WorkspaceApiError, type WorkspacePreset } from '../../application/commands'
import { isLlmConfigured } from '../../agent/llm'

interface RecentWorkspace {
  href: string
  title: string
  savedAt: number
}

const RECENTS_KEY = 'cc_recent_workspaces'

function readRecents(): RecentWorkspace[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]') as RecentWorkspace[]
  } catch {
    return []
  }
}

function saveRecent(href: string, title: string): void {
  try {
    const recents = readRecents().filter((r) => r.href !== href)
    recents.unshift({ href, title, savedAt: Date.now() })
    localStorage.setItem(RECENTS_KEY, JSON.stringify(recents.slice(0, 5)))
  } catch { /* ignore */ }
}

const PRESETS: readonly { id: WorkspacePreset; title: string; description: string }[] = [
  { id: 'blank',   title: 'Blank canvas',  description: 'Start from zero — total creative freedom.' },
  { id: 'website', title: 'Website',        description: 'Landing page: hero, copy, call-to-action.' },
  { id: 'flyer',   title: 'Flyer',          description: 'Event or promo flyer you can restyle.' },
  { id: 'logo',    title: 'Logo',           description: 'Mark and wordmark canvas to shape your identity.' },
]

const DEMO_HREF = '?projectId=project_invoiceflow&documentId=doc_invoiceflow&pageId=page_invoiceflow_dashboard&surface=canvas'

const ARIA_PROMPTS = [
  'Build a SaaS pricing page with 3 tiers',
  'Create a dashboard for a finance app',
  'Design a hero section for a startup',
  'Make a mobile app onboarding flow',
]

export default function NewDesignScreen() {
  const [busy, setBusy] = useState<WorkspacePreset | null>(null)
  const [error, setError] = useState<string>()
  const [ariaInput, setAriaInput] = useState('')
  const [ariaBusy, setAriaBusy] = useState(false)
  const [ariaError, setAriaError] = useState<string>()
  const [recents, setRecents] = useState<RecentWorkspace[]>(() => readRecents())
  const aiOn = isLlmConfigured()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
      saveRecent(`?${params.toString()}`, PRESETS.find((p) => p.id === preset)?.title ?? 'Design')
      setRecents(readRecents())
    } catch (caught) {
      if (caught instanceof WorkspaceApiError && caught.status === 0) {
        setError('CollabCanvas could not reach its API. Run `npm run api` in a terminal, then retry.')
      } else {
        setError(caught instanceof Error ? caught.message : 'The workspace could not be created.')
      }
    } finally {
      setBusy(null)
    }
  }

  const sendAriaPrompt = async (prompt?: string) => {
    const text = (prompt ?? ariaInput).trim()
    if (!text || ariaBusy) return
    setAriaBusy(true)
    setAriaError(undefined)
    try {
      const result = await createBlankWorkspace('blank')
      const params = new URLSearchParams()
      params.set('projectId', result.project.id)
      params.set('documentId', result.document.id)
      params.set('pageId', result.page.id)
      params.set('surface', 'canvas')
      params.set('aria', encodeURIComponent(text))
      window.history.pushState({}, '', `?${params.toString()}`)
      window.dispatchEvent(new PopStateEvent('popstate'))
    } catch {
      setAriaError('Could not start workspace. Make sure the API is running (`npm run api`).')
    } finally {
      setAriaBusy(false)
    }
  }

  return (
    <div
      className="flex min-h-full flex-col overflow-y-auto px-4 pb-16 pt-12 sm:px-6"
      style={{ background: 'var(--cc-canvas)' }}
      data-new-design-screen="true"
    >
      <div className="mx-auto w-full max-w-3xl">

        {/* Brand mark */}
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--cc-indigo-600)] to-[var(--cc-violet-600)] shadow-lg">
            <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
              <rect x="3" y="3" width="7" height="7" rx="1.5" fill="white" opacity="0.9" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" fill="white" opacity="0.55" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" fill="white" opacity="0.55" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" fill="white" opacity="0.9" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--cc-text-primary)', letterSpacing: '-0.02em' }}>
            What will you design today?
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed" style={{ color: 'var(--cc-text-secondary)' }}>
            Start from a template, or describe what you want and let Aria build it.
          </p>
        </div>

        {/* Aria prompt bar */}
        <div
          className="mb-10 rounded-2xl p-4"
          style={{
            background: 'var(--cc-panel)',
            border: '1px solid var(--cc-border-default)',
            boxShadow: 'var(--cc-shadow-panel)',
          }}
        >
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-[var(--cc-violet-500)] to-[var(--cc-violet-700)]">
              <svg viewBox="0 0 14 14" fill="none" className="h-3.5 w-3.5">
                <circle cx="7" cy="5" r="3" fill="white" opacity="0.85" />
                <path d="M2 12a5 5 0 0 1 10 0" stroke="white" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
              </svg>
            </div>
            <span className="text-xs font-semibold" style={{ color: 'var(--cc-violet-600)' }}>
              Aria — AI designer
            </span>
            {!aiOn && (
              <span
                className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ background: 'var(--cc-surface)', color: 'var(--cc-text-muted)', border: '1px solid var(--cc-border-subtle)' }}
              >
                Configure AI to enable
              </span>
            )}
          </div>

          <div
            className="flex items-end gap-2 rounded-xl px-3 py-2 transition-colors focus-within:ring-2 focus-within:ring-[var(--cc-violet-500)]"
            style={{ background: 'var(--cc-surface)', border: '1px solid var(--cc-border-default)' }}
          >
            <textarea
              ref={textareaRef}
              rows={2}
              value={ariaInput}
              onChange={(e) => setAriaInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void sendAriaPrompt()
                }
              }}
              placeholder="Describe what you want to design… (e.g. 'SaaS dashboard with nav and stats')"
              className="max-h-32 flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-[var(--cc-text-muted)]"
              style={{ color: 'var(--cc-text-primary)' }}
            />
            <button
              type="button"
              onClick={() => void sendAriaPrompt()}
              disabled={ariaBusy || !ariaInput.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white transition-all focus-visible:outline-none disabled:opacity-30"
              style={{ background: 'var(--cc-violet-600)' }}
              title="Generate with Aria — Enter"
            >
              {ariaBusy
                ? <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z"/></svg>
                : <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M3 9h12M11 5l4 4-4 4"/></svg>
              }
            </button>
          </div>

          {/* Suggestion chips */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {ARIA_PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => void sendAriaPrompt(p)}
                className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors hover:text-[var(--cc-violet-700)] focus-visible:outline-none"
                style={{
                  background: 'var(--cc-violet-50)',
                  color: 'var(--cc-violet-600)',
                  border: '1px solid var(--cc-violet-100)',
                }}
              >
                {p}
              </button>
            ))}
          </div>

          {ariaError && (
            <p role="alert" className="mt-2 text-xs" style={{ color: 'var(--cc-error)' }}>{ariaError}</p>
          )}
        </div>

        {/* Recent workspaces */}
        {recents.length > 0 && (
          <div className="mb-8">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--cc-text-muted)' }}>
              Recent
            </div>
            <div
              className="overflow-hidden rounded-2xl"
              style={{ border: '1px solid var(--cc-border-default)', background: 'var(--cc-panel)' }}
            >
              {recents.map((r, i) => (
                <a
                  key={r.href}
                  href={r.href}
                  onClick={(e) => { e.preventDefault(); window.history.pushState({}, '', r.href); window.dispatchEvent(new PopStateEvent('popstate')) }}
                  className={clsx(
                    'flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-[var(--cc-hover)]',
                    i > 0 && 'border-t',
                  )}
                  style={{ borderColor: 'var(--cc-border-subtle)' }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium" style={{ color: 'var(--cc-text-primary)' }}>{r.title}</div>
                    <div className="mt-0.5 text-xs" style={{ color: 'var(--cc-text-muted)' }}>
                      {new Date(r.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" style={{ color: 'var(--cc-text-muted)' }}><path d="M4 8h8M9 5l3 3-3 3"/></svg>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Template list */}
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--cc-text-muted)' }}>
          Start from a template
        </div>
        <div
          className="overflow-hidden rounded-2xl"
          style={{ border: '1px solid var(--cc-border-default)', background: 'var(--cc-panel)' }}
        >
          {PRESETS.map(({ id, title, description }, i) => (
            <button
              key={id}
              type="button"
              data-preset={id}
              disabled={busy !== null}
              onClick={() => void create(id)}
              className={clsx(
                'group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--cc-indigo-500)] hover:bg-[var(--cc-hover)]',
                i > 0 && 'border-t',
                busy === id ? 'opacity-60' : '',
              )}
              style={{ borderColor: 'var(--cc-border-subtle)' }}
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium" style={{ color: 'var(--cc-text-primary)' }}>
                  {busy === id ? 'Creating…' : title}
                </div>
                <div className="mt-0.5 text-xs" style={{ color: 'var(--cc-text-muted)' }}>
                  {description}
                </div>
              </div>
              {busy === id
                ? <svg className="h-4 w-4 shrink-0 animate-spin" style={{ color: 'var(--cc-indigo-600)' }} viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z"/></svg>
                : <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" style={{ color: 'var(--cc-text-muted)' }}><path d="M4 8h8M9 5l3 3-3 3"/></svg>
              }
            </button>
          ))}
        </div>

        {/* Error + demo link */}
        <div className="mt-8 flex flex-col items-center gap-3">
          {error && (
            <p role="alert" data-create-error="true" className="w-full max-w-md rounded-xl border px-4 py-2.5 text-xs" style={{ borderColor: 'var(--cc-error)', background: 'var(--cc-panel)', color: 'var(--cc-error)' }}>
              {error}
            </p>
          )}
          <a
            href={DEMO_HREF}
            className="text-xs underline underline-offset-4 transition-colors"
            style={{ color: 'var(--cc-text-muted)', textDecorationColor: 'var(--cc-border-strong)' }}
          >
            Open the InvoiceFlow demo design
          </a>
        </div>
      </div>
    </div>
  )
}
