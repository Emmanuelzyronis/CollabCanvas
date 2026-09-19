import { IconButton, Panel, Stack, Text } from '../foundation'
import { Icon } from '../icons'
import { useCanvasStore } from '../../store/store'
import type { InspectorProjection } from '../../graph/graphProjection'
import type { DesignNode } from '../../../server/domain/contracts'
import { InspectorPanel } from '../inspector'

export interface RightInspectorProps {
  onClose?: () => void
  inspectorProjection?: InspectorProjection
  onUpdateNode?: (nodeId: string, patch: Partial<Omit<DesignNode, 'id' | 'pageId'>>) => Promise<void>
}

export default function RightInspector({ onClose, inspectorProjection, onUpdateNode }: RightInspectorProps) {
  const runtimeSelectionCount = useCanvasStore((state) => state.selection.length)
  const selectionCount = inspectorProjection?.count ?? runtimeSelectionCount

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
        <InspectorPanel projection={inspectorProjection} onUpdateNode={onUpdateNode} />
      </div>
    </Panel>
  )
}
