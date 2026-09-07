import { useCallback, useEffect, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import LeftPanel from './LeftPanel'
import RightInspector from './RightInspector'
import StatusBar from './StatusBar'
import ShellTopBar from './TopBar'

export const SHELL_Z_INDEX = {
  canvas: 'z-0',
  panels: 'z-20',
  floating: 'z-30',
  overlay: 'z-40',
} as const

export default function AppShell({ children }: { children: ReactNode }) {
  const [leftOpen, setLeftOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)

  const focusControl = useCallback((id: string) => {
    requestAnimationFrame(() => document.getElementById(id)?.focus())
  }, [])

  const closeLeft = useCallback(() => {
    setLeftOpen(false)
    focusControl('project-navigation-toggle')
  }, [focusControl])

  const closeRight = useCallback(() => {
    setRightOpen(false)
    focusControl('inspector-toggle')
  }, [focusControl])

  const toggleLeft = () => {
    if (leftOpen) {
      closeLeft()
      return
    }
    setRightOpen(false)
    setLeftOpen(true)
  }

  const toggleRight = () => {
    if (rightOpen) {
      closeRight()
      return
    }
    setLeftOpen(false)
    setRightOpen(true)
  }

  useEffect(() => {
    const targetId = leftOpen ? 'project-navigation-close' : rightOpen ? 'inspector-close' : null
    if (!targetId) return
    const frame = requestAnimationFrame(() => document.getElementById(targetId)?.focus())
    return () => cancelAnimationFrame(frame)
  }, [leftOpen, rightOpen])

  useEffect(() => {
    if (!leftOpen && !rightOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      if (leftOpen) closeLeft()
      if (rightOpen) closeRight()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [closeLeft, closeRight, leftOpen, rightOpen])

  return (
    <div className="grid h-full min-h-0 w-full grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-canvas text-text-primary">
      <ShellTopBar onToggleLeft={toggleLeft} onToggleRight={toggleRight} leftOpen={leftOpen} rightOpen={rightOpen} />

      <div className="cc-shell-workspace relative grid min-h-0 min-w-0 overflow-hidden">
        <aside id="project-navigation-panel" data-open={leftOpen} className={clsx(SHELL_Z_INDEX.panels, 'cc-shell-panel cc-shell-panel-left inset-y-0 border-r border-border-default bg-panel shadow-floating')} aria-label="Project navigation">
          <LeftPanel onClose={closeLeft} />
        </aside>

        <main className={clsx(SHELL_Z_INDEX.canvas, 'relative min-h-0 min-w-0 overflow-hidden bg-canvas')} aria-label="Canvas workspace">
          {children}
        </main>

        <aside id="inspector-panel" data-open={rightOpen} className={clsx(SHELL_Z_INDEX.panels, 'cc-shell-panel cc-shell-panel-right inset-y-0 border-l border-border-default bg-panel shadow-floating')} aria-label="Inspector">
          <RightInspector onClose={closeRight} />
        </aside>

        {(leftOpen || rightOpen) ? <button type="button" tabIndex={-1} aria-label="Close open panel" className="cc-shell-compact-only absolute inset-0 z-10 cursor-default bg-slate-950/15" onClick={leftOpen ? closeLeft : closeRight} /> : null}
      </div>

      <StatusBar />
    </div>
  )
}
