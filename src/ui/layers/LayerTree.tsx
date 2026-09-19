import { useMemo, useState, type MouseEvent } from 'react'
import type { LayerNodeProjection, LayersProjection } from '../../graph/graphProjection'
import { useCanvasStore } from '../../store/store'

export interface LayerTreeProps {
  projection: LayersProjection
  selectedNodeIds?: readonly string[]
  onSelect?: (nodeId: string, additive: boolean) => void
}

function collectExpandableIds(nodes: readonly LayerNodeProjection[], ids: string[] = []): string[] {
  for (const node of nodes) {
    if (node.children.length > 0) {
      ids.push(node.id)
      collectExpandableIds(node.children, ids)
    }
  }
  return ids
}

function LayerRow({
  node,
  collapsed,
  selectedNodeIds,
  onToggle,
  onSelect,
}: {
  node: LayerNodeProjection
  collapsed: ReadonlySet<string>
  selectedNodeIds: ReadonlySet<string>
  onToggle: (nodeId: string) => void
  onSelect: (event: MouseEvent<HTMLButtonElement>, nodeId: string) => void
}) {
  const hasChildren = node.children.length > 0
  const expanded = !collapsed.has(node.id)
  const childrenId = `layer-children-${node.id}`

  return (
    <div role="treeitem" data-layer-node-id={node.id} data-node-type={node.type} data-order-index={node.orderIndex} aria-level={node.depth + 1} aria-selected={selectedNodeIds.has(node.id)} aria-expanded={hasChildren ? expanded : undefined}>
      <div className="flex min-w-0 items-center gap-1" style={{ paddingLeft: `${node.depth * 12}px` }}>
        {hasChildren ? (
          <button
            type="button"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-text-muted hover:bg-hover hover:text-text-primary focus-visible:outline-none"
            aria-label={expanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
            aria-expanded={expanded}
            aria-controls={childrenId}
            onClick={() => onToggle(node.id)}
          >
            <span aria-hidden="true" className="text-xs">{expanded ? '-' : '+'}</span>
          </button>
        ) : <span aria-hidden="true" className="h-7 w-7 shrink-0" />}

        <button
          type="button"
          className={`min-w-0 flex-1 rounded-control px-2 py-1.5 text-left transition-colors focus-visible:outline-none ${selectedNodeIds.has(node.id) ? 'bg-selected text-blue-800' : 'text-text-secondary hover:bg-hover hover:text-text-primary'}`}
          aria-label={`Select ${node.name}`}
          onClick={(event) => onSelect(event, node.id)}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-xs font-medium">{node.name}</span>
          </span>
          <span className="flex min-w-0 items-center gap-1.5 truncate text-[10px] text-text-muted">
            {node.component ? <span>{node.component.definitionName}</span> : null}
            {node.interactionCount > 0 ? <span>{node.interactionCount} interaction{node.interactionCount === 1 ? '' : 's'}</span> : null}
            {node.stateNames.length > 0 ? <span>{node.stateNames.length} state{node.stateNames.length === 1 ? '' : 's'}</span> : null}
            {node.hasResponsiveConstraints ? <span>responsive</span> : null}
          </span>
        </button>
      </div>

      {hasChildren && expanded ? (
        <div id={childrenId} role="group">
          {node.children.map((child) => (
            <LayerRow key={child.id} node={child} collapsed={collapsed} selectedNodeIds={selectedNodeIds} onToggle={onToggle} onSelect={onSelect} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** Selection-aware layer tree. It owns only ephemeral expansion state. */
export default function LayerTree({ projection, selectedNodeIds, onSelect }: LayerTreeProps) {
  const runtimeSelection = useCanvasStore((state) => state.selection)
  const select = useCanvasStore((state) => state.select)
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(() => new Set())
  const selected = useMemo(() => new Set(selectedNodeIds ?? runtimeSelection), [runtimeSelection, selectedNodeIds])
  const expandableIds = useMemo(() => collectExpandableIds(projection.roots), [projection.roots])
  const collapsed = useMemo(() => new Set([...collapsedIds].filter((id) => expandableIds.includes(id))), [collapsedIds, expandableIds])

  const toggle = (nodeId: string) => {
    setCollapsedIds((current) => {
      const next = new Set(current)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  const selectNode = (event: MouseEvent<HTMLButtonElement>, nodeId: string) => {
    if (onSelect) onSelect(nodeId, event.shiftKey)
    else select(nodeId, event.shiftKey)
  }

  return (
    <div role="tree" aria-label="Layers" aria-multiselectable="true" className="min-w-0">
      {projection.roots.length === 0 ? <p className="px-3 py-4 text-xs text-text-muted">No layers yet. Add an element to see it here.</p> : null}
      {projection.roots.map((node) => (
        <LayerRow key={node.id} node={node} collapsed={collapsed} selectedNodeIds={selected} onToggle={toggle} onSelect={selectNode} />
      ))}
    </div>
  )
}
