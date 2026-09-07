import { Divider, IconButton, Inline, Panel, Stack, Text } from '../foundation'
import { Icon } from '../icons'

export default function LeftPanel({ onClose }: { onClose?: () => void }) {
  return (
    <Panel elevation="none" className="flex h-full min-h-0 flex-col rounded-none border-0 bg-panel">
      <div className="flex min-h-12 items-center justify-between px-3">
        <Stack gap="1">
          <Text as="h2" role="label">Project</Text>
          <Text as="div" role="metadata" muted>Workspace navigation</Text>
        </Stack>
        {onClose ? <div className="cc-shell-compact-only"><IconButton id="project-navigation-close" label="Close project navigation" size="sm" onClick={onClose}><Icon name="close" size={16} /></IconButton></div> : null}
      </div>
      <Divider />
      <nav className="min-h-0 flex-1 overflow-y-auto p-3" aria-label="Project sections">
        <Stack gap="1">
          {['Overview', 'Canvas', 'Design system', 'Assets', 'Versions', 'Agent center'].map((item, index) => (
            <button key={item} type="button" className={`min-h-9 rounded-control px-3 text-left text-sm transition-colors focus-visible:outline-none ${index === 1 ? 'bg-selected font-medium text-blue-800' : 'text-text-secondary hover:bg-hover hover:text-text-primary'}`} aria-current={index === 1 ? 'page' : undefined}>
              {item}
            </button>
          ))}
        </Stack>
        <Divider className="my-4" />
        <Stack gap="2">
          <Inline justify="between">
            <Text as="h3" role="label" muted>Layers</Text>
            <Text as="span" role="metadata" muted>Projection</Text>
          </Inline>
          <div className="rounded-card border border-dashed border-border-strong px-3 py-4">
            <Text role="caption" muted>Graph-backed layer hierarchy will appear here.</Text>
          </div>
        </Stack>
      </nav>
    </Panel>
  )
}
