import type { NodeType } from '../../../server/domain/contracts'

export type EditorToolKind = 'select' | 'hand' | 'text' | 'heading' | 'box' | 'frame' | 'section' | 'button' | 'card' | 'image'

export interface InsertSpec {
  readonly kind: EditorToolKind
  readonly nodeType: NodeType
  readonly label: string
  readonly name: string
  readonly defaultWidth: number
  readonly defaultHeight: number
  readonly text?: string
  readonly glyph: string
}

export const INSERT_SPECS: Record<EditorToolKind, InsertSpec> = {
  select: { kind: 'select', nodeType: 'container', label: 'Select', name: 'Select', defaultWidth: 0, defaultHeight: 0, glyph: '↖' },
  hand: { kind: 'hand', nodeType: 'container', label: 'Hand', name: 'Hand', defaultWidth: 0, defaultHeight: 0, glyph: '✋' },
  text: { kind: 'text', nodeType: 'text', label: 'Text', name: 'Text', defaultWidth: 220, defaultHeight: 40, text: 'Text', glyph: 'T' },
  heading: { kind: 'heading', nodeType: 'heading', label: 'Heading', name: 'Heading', defaultWidth: 320, defaultHeight: 56, text: 'Heading', glyph: 'H' },
  box: { kind: 'box', nodeType: 'container', label: 'Box', name: 'Box', defaultWidth: 180, defaultHeight: 120, glyph: '▭' },
  frame: { kind: 'frame', nodeType: 'frame', label: 'Frame', name: 'Frame', defaultWidth: 480, defaultHeight: 360, glyph: '⛶' },
  section: { kind: 'section', nodeType: 'section', label: 'Section', name: 'Section', defaultWidth: 640, defaultHeight: 200, glyph: '▤' },
  button: { kind: 'button', nodeType: 'button', label: 'Button', name: 'Button', defaultWidth: 160, defaultHeight: 48, text: 'Button', glyph: '◉' },
  card: { kind: 'card', nodeType: 'card', label: 'Card', name: 'Card', defaultWidth: 240, defaultHeight: 160, glyph: '▢' },
  image: { kind: 'image', nodeType: 'image', label: 'Image', name: 'Image', defaultWidth: 320, defaultHeight: 220, glyph: '▧' },
}

export const INSERT_TOOLS: readonly EditorToolKind[] = ['text', 'heading', 'box', 'frame', 'section', 'button', 'card', 'image']

export function specFor(kind: EditorToolKind): InsertSpec {
  return INSERT_SPECS[kind]
}
