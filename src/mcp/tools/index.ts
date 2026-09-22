import { useCanvasStore, type CanvasStore } from '../../store/store'
import type { ToolDef } from './create'
import { createTools } from './create'
import { editTools } from './edit'
import { queryTools } from './query'
import { viewTools } from './view'
import { exportTools } from './export'
import { generateTools } from './generate'
import { boardTools } from './board'
import { canonicalTools } from './canonical'

const getStore = (): CanvasStore => useCanvasStore.getState()

/** The full CollabCanvas WebMCP tool suite, in a sensible presentation order. */
export function allTools(): ToolDef[] {
  return [
    ...canonicalTools(),
    ...createTools(getStore),
    ...editTools(getStore),
    ...generateTools(getStore),
    ...queryTools(getStore),
    ...exportTools(getStore),
    ...viewTools(getStore),
    ...boardTools(getStore),
  ]
}

export type { ToolDef }
