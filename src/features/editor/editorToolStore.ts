import { create } from 'zustand'
import type { EditorToolKind } from './editorModel'

interface EditorToolState {
  tool: EditorToolKind
  setTool: (tool: EditorToolKind) => void
  resetTool: () => void
}

/** Transient UI state only: the active insert tool is never durable design state. */
export const useEditorToolStore = create<EditorToolState>((set) => ({
  tool: 'select',
  setTool: (tool) => set({ tool }),
  resetTool: () => set({ tool: 'select' }),
}))
