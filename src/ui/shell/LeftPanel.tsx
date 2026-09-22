import { useEffect, useState } from 'react'
import clsx from 'clsx'
import type { LayersProjection } from '../../graph/graphProjection'
import LayerTree from '../layers/LayerTree'

const NAV_SECTIONS = [
  { label: 'Canvas',          surface: 'canvas',        icon: canvasIcon() },
  { label: 'Design system',   surface: 'design-system', icon: tokenIcon() },
  { label: 'Assets',          surface: 'assets',        icon: assetsIcon() },
  { label: 'Versions',        surface: 'versions',      icon: versionsIcon() },
  { label: 'Handoff',         surface: 'handoff',       icon: handoffIcon() },
  { label: 'Implementation',  surface: 'implementation',icon: codeIcon() },
  { label: 'Overview',        surface: 'overview',      icon: overviewIcon() },
  { label: 'Assistant',       surface: 'assistant',     icon: assistantIcon() },
] as const

const SURFACE_ALIASES: Readonly<Record<string, string>> = { 'agent-center': 'assistant' }

function canvasIcon()       { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5 8h6M8 5v6"/></svg> }
function tokenIcon()        { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="8" r="2.5"/><circle cx="11" cy="8" r="2.5"/></svg> }
function assetsIcon()       { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg> }
function versionsIcon()     { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="5.5"/><path d="M8 5v3l2 2"/></svg> }
function handoffIcon()      { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3l4 5-4 5M3 8h10"/></svg> }
function codeIcon()         { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4L2 8l3 4M11 4l3 4-3 4M9 3l-2 10"/></svg> }
function overviewIcon()     { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="5.5"/><path d="M8 6v4M8 5.5V5"/></svg> }
function assistantIcon()    { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4h10a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H9l-3 2V11H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/></svg> }

export default function LeftPanel({ onClose, layersProjection }: { onClose?: () => void; layersProjection?: LayersProjection }) {
  const sectionFromUrl = () => {
    const raw = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('surface') ?? ''
    const value = SURFACE_ALIASES[raw] ?? raw
    return NAV_SECTIONS.find((s) => s.surface === value)?.label ?? 'Canvas'
  }
  const [activeSection, setActiveSection] = useState(sectionFromUrl)
  useEffect(() => {
    const onPopState = () => setActiveSection(sectionFromUrl())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = (section: string) => {
    const target = NAV_SECTIONS.find((candidate) => candidate.label === section)
    if (!target) return
    const params = new URLSearchParams(window.location.search)
    params.set('surface', target.surface)
    window.history.pushState({}, '', `?${params.toString()}`)
    setActiveSection(target.label)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-panel">
      {/* Nav — sits flush at top */}
      <nav className="min-h-0 flex-1 overflow-y-auto" aria-label="Project sections">
        {onClose && (
          <div className="flex justify-end px-2 pt-2">
            <button
              id="project-navigation-close"
              type="button"
              aria-label="Close project navigation"
              onClick={onClose}
              className="cc-shell-compact-only h-7 w-7 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-indigo-500)]"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="h-3.5 w-3.5">
                <path d="M4 4l8 8M12 4L4 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="space-y-0.5 p-2 pt-2">
          {NAV_SECTIONS.map(({ label, icon }) => {
            const active = activeSection === label
            return (
              <button
                key={label}
                type="button"
                onClick={() => navigate(label)}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-indigo-500)]',
                  active
                    ? 'bg-[var(--cc-indigo-50)] text-[var(--cc-indigo-700)]'
                    : 'text-text-secondary hover:bg-hover hover:text-text-primary',
                )}
              >
                <span
                  className={clsx(
                    'flex h-5 w-5 shrink-0 items-center justify-center',
                    active ? 'text-[var(--cc-indigo-600)]' : 'text-text-muted',
                  )}
                >
                  {icon}
                </span>
                {label}
              </button>
            )
          })}
        </div>

        {/* Layers section */}
        <div className="border-t border-border-subtle px-3 pt-4 pb-2">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Layers</span>
          </div>
          {layersProjection
            ? <LayerTree projection={layersProjection} />
            : (
              <div className="rounded-lg border border-dashed border-border-default px-3 py-4 text-center">
                <p className="text-xs text-text-muted">Layers appear as you add elements to the canvas.</p>
              </div>
            )
          }
        </div>
      </nav>
    </div>
  )
}
