import { Badge, Inline, Status, Text } from '../foundation'
import { useCanvasStore } from '../../store/store'
import { configFor, useViewportStore } from '../../features/editor/viewportStore'
import type { GraphAvailability } from '../../workspace'

export default function StatusBar({ workspaceStatus }: { workspaceStatus?: GraphAvailability }) {
  const zoom = useCanvasStore((state) => state.camera.zoom)
  const selectionCount = useCanvasStore((state) => state.selection.length)
  const agent = useCanvasStore((state) => state.agent)
  const viewportPreset = useViewportStore((s) => s.preset)
  const viewportConfig = configFor(viewportPreset)

  const statusLabel = workspaceStatus === 'GRAPH_AVAILABLE' ? 'Ready' : workspaceStatus === 'GRAPH_LOADING' ? 'Loading' : workspaceStatus === 'GRAPH_INVALID' ? 'Needs attention' : workspaceStatus === 'GRAPH_UNAVAILABLE' ? 'Unavailable' : 'No workspace'

  return (
    <footer className="relative z-30 flex min-h-9 items-center justify-between gap-3 border-t border-border-default bg-panel px-3 text-text-secondary sm:px-4" aria-label="Canvas status bar" data-availability={workspaceStatus ?? 'none'}>
      <Inline gap="3" wrap>
        <Text as="span" role="metadata" muted>{statusLabel}</Text>
        <Text as="span" role="metadata" muted>{Math.round(zoom * 100)}% zoom</Text>
        <Text as="span" role="metadata" muted>{selectionCount === 0 ? 'Nothing selected' : `${selectionCount} selected`}</Text>
        {workspaceStatus === 'GRAPH_AVAILABLE' && (
          <Text as="span" role="metadata" muted data-viewport-status="true">{viewportConfig.breakpointLabel}</Text>
        )}
      </Inline>
      <Inline gap="3" wrap justify="end">
        {agent.status ? <Status tone="success" label={agent.status} /> : null}
        <Badge tone="neutral">Local session</Badge>
      </Inline>
    </footer>
  )
}
