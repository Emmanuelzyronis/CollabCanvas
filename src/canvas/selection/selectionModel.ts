export type SelectionMode = 'none' | 'single' | 'multiple'

export type SelectionInteraction =
  | 'idle'
  | 'selecting'
  | 'dragging'
  | 'resizing'
  | 'editing'

export interface SelectionState {
  readonly selectedNodeIds: readonly string[]
  readonly primaryNodeId: string | null
  readonly hoveredNodeId: string | null
  readonly mode: SelectionMode
  readonly interaction: SelectionInteraction
}

export type SelectionAction =
  | { readonly type: 'replace'; readonly nodeIds: readonly string[] }
  | { readonly type: 'toggle'; readonly nodeId: string }
  | { readonly type: 'clear' }
  | { readonly type: 'select-all' }
  | { readonly type: 'reconcile' }

function normalizeNodeIds(nodeIds: readonly string[], availableNodeIds: readonly string[]): string[] {
  const available = new Set(availableNodeIds)
  return [...new Set(nodeIds)].filter((nodeId) => available.has(nodeId))
}

/** Deterministic runtime selection reducer over stable graph/canvas identities. */
export function reduceSelection(
  selectedNodeIds: readonly string[],
  action: SelectionAction,
  availableNodeIds: readonly string[],
): string[] {
  const current = normalizeNodeIds(selectedNodeIds, availableNodeIds)
  switch (action.type) {
    case 'replace':
      return normalizeNodeIds(action.nodeIds, availableNodeIds)
    case 'toggle':
      if (!availableNodeIds.includes(action.nodeId)) return current
      return current.includes(action.nodeId)
        ? current.filter((nodeId) => nodeId !== action.nodeId)
        : [...current, action.nodeId]
    case 'clear':
      return []
    case 'select-all':
      return normalizeNodeIds(availableNodeIds, availableNodeIds)
    case 'reconcile':
      return current
  }
}

export function describeSelection(
  selectedNodeIds: readonly string[],
  hoveredNodeId: string | null,
  interaction: SelectionInteraction,
): SelectionState {
  return {
    selectedNodeIds: [...selectedNodeIds],
    primaryNodeId: selectedNodeIds[0] ?? null,
    hoveredNodeId,
    mode: selectedNodeIds.length === 0 ? 'none' : selectedNodeIds.length === 1 ? 'single' : 'multiple',
    interaction,
  }
}
