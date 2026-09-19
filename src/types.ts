// Core domain types for CollabCanvas.

export type ElementType =
  | 'rectangle'
  | 'ellipse'
  | 'diamond'
  | 'text'
  | 'sticky'
  | 'frame'
  | 'connector'
  | 'line'

export type Author = 'human' | 'agent'

export type TextAlign = 'left' | 'center' | 'right'

export interface CanvasElement {
  id: string
  type: ElementType
  x: number
  y: number
  width: number
  height: number
  rotation: number
  // style
  fill: string
  stroke: string
  strokeWidth: number
  opacity: number
  dashed: boolean
  // text content (shapes, text, sticky, frame title)
  text: string
  fontSize: number
  fontWeight: number
  textColor: string
  textAlign: TextAlign
  fontFamily: string
  lineHeight: number
  borderRadius: number
  imageSrc?: string
  imageWidth?: number
  imageHeight?: number
  // connector endpoints (element ids); null => use bbox diagonal
  from: string | null
  to: string | null
  // meta
  groupId: string | null
  author: Author
  locked: boolean
  createdAt: number
  updatedAt: number
}

export interface Comment {
  id: string
  x: number
  y: number
  text: string
  author: Author
  targetId: string | null
  resolved: boolean
  createdAt: number
}

export type Tool =
  | 'select'
  | 'hand'
  | 'rectangle'
  | 'ellipse'
  | 'diamond'
  | 'text'
  | 'sticky'
  | 'frame'
  | 'connector'
  | 'comment'

export interface Camera {
  x: number // world coordinate at viewport top-left
  y: number
  zoom: number
}

export type ActivityKind =
  | 'create'
  | 'update'
  | 'delete'
  | 'style'
  | 'group'
  | 'arrange'
  | 'comment'
  | 'view'
  | 'generate'
  | 'export'
  | 'presence'
  | 'select'

export interface ActivityEntry {
  id: string
  author: Author
  kind: ActivityKind
  message: string
  elementIds: string[]
  at: number
}

export interface AgentPresence {
  cursor: { x: number; y: number } | null
  status: string | null
  color: string
  name: string
}

/** Serializable board snapshot (used by export/import + history). */
export interface BoardSnapshot {
  version: 1
  elements: Record<string, CanvasElement>
  order: string[]
  comments: Comment[]
}

/** Input accepted by addElement — everything optional except type. */
export type ElementInput = Partial<Omit<CanvasElement, 'id' | 'type' | 'author' | 'createdAt' | 'updatedAt'>> & {
  type: ElementType
}
