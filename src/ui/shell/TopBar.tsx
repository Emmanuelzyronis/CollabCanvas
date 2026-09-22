import { IconButton, Inline, Text } from '../foundation'
import { Icon } from '../icons'
import ViewportToggle from '../../features/editor/ViewportToggle'
import type { ShellWorkspaceContext } from './AppShell'

interface TopBarProps {
  onToggleLeft: () => void
  onToggleRight: () => void
  leftOpen: boolean
  rightOpen: boolean
  workspace?: ShellWorkspaceContext
}

export default function TopBar({ onToggleLeft, onToggleRight, leftOpen, rightOpen, workspace }: TopBarProps) {
  const contextLabel = workspace?.project && workspace.document && workspace.page
    ? `${workspace.project.name} / ${workspace.document.name} / ${workspace.page.name}`
    : workspace?.availability === 'GRAPH_LOADING' ? 'Loading design context' : 'Design context unavailable'
  const statusLabel = workspace?.availability === 'GRAPH_AVAILABLE' ? 'Design ready' : workspace?.availability === 'GRAPH_LOADING' ? 'Loading…' : workspace?.availability ?? 'No workspace context'
  return (
    <header className="relative z-30 flex min-h-14 items-center justify-between gap-3 border-b border-border-default bg-panel px-3 py-2 shadow-subtle sm:px-4" aria-label="Application top bar">
      <Inline gap="2" className="min-w-0">
        <div className="cc-shell-compact-only">
          <IconButton id="project-navigation-toggle" label={leftOpen ? 'Close project navigation' : 'Open project navigation'} aria-expanded={leftOpen} aria-controls="project-navigation-panel" variant="secondary" size="sm" onClick={onToggleLeft}>
            <Icon name="menu" size={17} />
          </IconButton>
        </div>
        <div className="min-w-0">
          <Text as="div" role="heading" className="truncate">CollabCanvas</Text>
          <Text as="div" role="metadata" muted className="truncate">{statusLabel}</Text>
        </div>
      </Inline>

      <div className="hidden min-w-0 flex-1 items-center justify-center px-4 md:flex">
        {workspace?.availability === 'GRAPH_AVAILABLE'
          ? <ViewportToggle />
          : <Text as="div" role="label" muted className="truncate">{contextLabel}</Text>
        }
      </div>

      <Inline gap="2" className="shrink-0 cc-shell-compact-only">
        <IconButton id="inspector-toggle" label={rightOpen ? 'Close inspector' : 'Open inspector'} aria-expanded={rightOpen} aria-controls="inspector-panel" variant="secondary" size="sm" onClick={onToggleRight}>
          <Icon name="panelRight" size={17} />
        </IconButton>
      </Inline>
    </header>
  )
}
