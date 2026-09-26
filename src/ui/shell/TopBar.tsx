import { useState } from 'react'
import clsx from 'clsx'
import { useCanvasStore } from '../../store/store'
import ViewportToggle from '../../features/editor/ViewportToggle'
import type { ShellWorkspaceContext } from './AppShell'
import { toast } from '../../hooks/use-toast'

interface TopBarProps {
  onToggleLeft: () => void
  onToggleRight: () => void
  leftOpen: boolean
  rightOpen: boolean
  workspace?: ShellWorkspaceContext
}

function ChromeButton({ onClick, title, children, active }: { onClick: () => void; title: string; children: React.ReactNode; active?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={clsx(
        'flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--cc-indigo-500)]',
        active
          ? 'bg-[var(--cc-chrome-700)] text-[var(--cc-chrome-text)]'
          : 'text-[var(--cc-chrome-muted)] hover:bg-[var(--cc-chrome-700)] hover:text-[var(--cc-chrome-text)]',
      )}
    >
      {children}
    </button>
  )
}

export default function TopBar({ onToggleLeft, onToggleRight, leftOpen, rightOpen, workspace }: TopBarProps) {
  const projectName = workspace?.project?.name ?? 'Untitled'
  const pageName = workspace?.page?.name
  const availability = workspace?.availability
  const undo = () => useCanvasStore.getState().undo()
  const redo = () => useCanvasStore.getState().redo()
  const [shareBusy, setShareBusy] = useState(false)

  const handleShare = async () => {
    setShareBusy(true)
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast('Link copied to clipboard', 'success')
    } catch {
      toast('Could not copy link — try copying the address bar', 'error')
    } finally {
      setShareBusy(false)
    }
  }

  const handlePublish = () => {
    toast('Publish is coming soon — export via Handoff in the meantime', 'info')
  }

  const ariaOnline = availability === 'GRAPH_AVAILABLE'

  return (
    <header
      className="relative z-30 flex min-h-[52px] shrink-0 items-center gap-2 px-3"
      style={{ background: 'var(--cc-chrome)', borderBottom: '1px solid var(--cc-chrome-border)' }}
      aria-label="Application top bar"
    >
      {/* Left section — hamburger + logo + project name */}
      <div className="flex min-w-0 items-center gap-2">
        {/* Hamburger (compact only) */}
        <button
          type="button"
          id="project-navigation-toggle"
          aria-label={leftOpen ? 'Close project navigation' : 'Open project navigation'}
          aria-expanded={leftOpen}
          aria-controls="project-navigation-panel"
          onClick={onToggleLeft}
          className="cc-shell-compact-only h-8 w-8 items-center justify-center rounded-lg text-[var(--cc-chrome-muted)] hover:bg-[var(--cc-chrome-700)] hover:text-[var(--cc-chrome-text)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--cc-indigo-500)] transition-colors"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </svg>
        </button>

        {/* Logo mark */}
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--cc-indigo-500)] to-[var(--cc-violet-600)] shadow-sm shrink-0">
          <svg viewBox="0 0 18 18" fill="none" className="h-4 w-4">
            <rect x="3" y="3" width="5" height="5" rx="1" fill="white" opacity="0.9" />
            <rect x="10" y="3" width="5" height="5" rx="1" fill="white" opacity="0.6" />
            <rect x="3" y="10" width="5" height="5" rx="1" fill="white" opacity="0.6" />
            <rect x="10" y="10" width="5" height="5" rx="1" fill="white" opacity="0.9" />
          </svg>
        </div>

        {/* Project breadcrumb */}
        <div className="hidden min-w-0 flex-col sm:flex">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="truncate text-sm font-semibold leading-none" style={{ color: 'var(--cc-chrome-text)' }}>
              {projectName}
            </span>
            {pageName && (
              <>
                <svg viewBox="0 0 6 12" fill="none" className="h-3 w-1.5 shrink-0 opacity-30">
                  <path d="M1 1l4 5-4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="truncate text-sm leading-none" style={{ color: 'var(--cc-chrome-muted)' }}>{pageName}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Separator */}
      <div className="mx-1 hidden h-5 w-px sm:block" style={{ background: 'var(--cc-chrome-border)' }} />

      {/* Undo / Redo */}
      <div className="hidden items-center gap-0.5 sm:flex">
        <ChromeButton title="Undo (⌘Z)" onClick={undo}>
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M3 10a6 6 0 1 0 1.8-4.2L3 3" />
            <path d="M3 3v4h4" />
          </svg>
        </ChromeButton>
        <ChromeButton title="Redo (⌘⇧Z)" onClick={redo}>
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M15 10a6 6 0 1 1-1.8-4.2L15 3" />
            <path d="M15 3v4h-4" />
          </svg>
        </ChromeButton>
      </div>

      {/* Center — viewport toggle */}
      <div className="flex min-w-0 flex-1 items-center justify-center px-2">
        {availability === 'GRAPH_AVAILABLE'
          ? <ViewportToggle />
          : (
            <div className="text-xs font-medium" style={{ color: 'var(--cc-chrome-muted)' }}>
              {availability === 'GRAPH_LOADING' ? 'Loading design…' : 'CollabCanvas'}
            </div>
          )
        }
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Aria status chip */}
        <div
          className={clsx(
            'hidden items-center gap-1.5 rounded-full px-2.5 py-1 sm:flex',
            ariaOnline ? 'aria-active' : '',
          )}
          style={{
            background: ariaOnline ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${ariaOnline ? 'rgba(124,58,237,0.35)' : 'rgba(255,255,255,0.1)'}`,
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: ariaOnline ? 'var(--cc-violet-500)' : 'var(--cc-chrome-muted)' }}
          />
          <span className="text-[11px] font-medium" style={{ color: ariaOnline ? '#c4b5fd' : 'var(--cc-chrome-muted)' }}>
            Aria
          </span>
        </div>

        {/* Share */}
        <button
          type="button"
          onClick={() => void handleShare()}
          disabled={shareBusy}
          className="hidden h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors sm:flex focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--cc-indigo-500)] disabled:opacity-60"
          style={{
            background: 'rgba(255,255,255,0.08)',
            color: 'var(--cc-chrome-text)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
            <path d="M11 2.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5M5 8a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5M11 10.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5" />
            <path d="M8.5 6.5l-3 2M8.5 9.5l-3-2" />
          </svg>
          Share
        </button>

        {/* Publish */}
        <button
          type="button"
          onClick={handlePublish}
          className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--cc-indigo-500)]"
          style={{ background: 'var(--cc-indigo-600)' }}
        >
          Publish
        </button>

        {/* Inspector toggle (compact only) */}
        <button
          type="button"
          id="inspector-toggle"
          aria-label={rightOpen ? 'Close inspector' : 'Open inspector'}
          aria-expanded={rightOpen}
          aria-controls="inspector-panel"
          onClick={onToggleRight}
          className="cc-shell-compact-only h-8 w-8 items-center justify-center rounded-lg text-[var(--cc-chrome-muted)] hover:bg-[var(--cc-chrome-700)] hover:text-[var(--cc-chrome-text)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--cc-indigo-500)] transition-colors"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
            <rect x="13" y="4" width="4" height="12" rx="1" fill="currentColor" opacity="0.8" />
            <rect x="3" y="4" width="8" height="12" rx="1" fill="currentColor" opacity="0.4" />
          </svg>
        </button>
      </div>
    </header>
  )
}
