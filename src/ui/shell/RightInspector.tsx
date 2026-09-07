import { IconButton, Panel, Stack, Text } from '../foundation'
import { Icon } from '../icons'
import { useCanvasStore } from '../../store/store'

export default function RightInspector({ onClose }: { onClose?: () => void }) {
  const selectionCount = useCanvasStore((state) => state.selection.length)

  return (
    <Panel elevation="none" className="flex h-full min-h-0 flex-col rounded-none border-0 bg-panel">
      <div className="flex min-h-12 items-center justify-between border-b border-border-subtle px-3">
        <Stack gap="1">
          <Text as="h2" role="label">Inspector</Text>
          <Text as="div" role="metadata" muted>{selectionCount > 0 ? `${selectionCount} selected` : 'No selection'}</Text>
        </Stack>
        {onClose ? <div className="cc-shell-compact-only"><IconButton id="inspector-close" label="Close inspector" size="sm" onClick={onClose}><Icon name="close" size={16} /></IconButton></div> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="flex min-h-40 items-center justify-center rounded-card border border-dashed border-border-strong px-4 text-center">
          <Text role="caption" muted>{selectionCount > 0 ? 'Canvas selection active.' : 'Select a canvas element to inspect its context.'}</Text>
        </div>
      </div>
    </Panel>
  )
}
