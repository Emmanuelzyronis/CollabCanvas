import { Badge, Inline, Status, Text } from '../foundation'
import { useCanvasStore } from '../../store/store'

export default function StatusBar() {
  const zoom = useCanvasStore((state) => state.camera.zoom)
  const selectionCount = useCanvasStore((state) => state.selection.length)
  const agent = useCanvasStore((state) => state.agent)

  return (
    <footer className="relative z-30 flex min-h-9 items-center justify-between gap-3 border-t border-border-default bg-panel px-3 text-text-secondary sm:px-4" aria-label="Canvas status bar">
      <Inline gap="3" wrap>
        <Text as="span" role="metadata" muted>Canvas</Text>
        <Text as="span" role="metadata" muted>{Math.round(zoom * 100)}% zoom</Text>
        <Text as="span" role="metadata" muted>{selectionCount === 0 ? 'Nothing selected' : `${selectionCount} selected`}</Text>
      </Inline>
      <Inline gap="3" wrap justify="end">
        <Status tone={agent.status ? 'success' : 'neutral'} label={agent.status ?? 'Aria idle'} />
        <Badge tone="neutral">Local session</Badge>
      </Inline>
    </footer>
  )
}
