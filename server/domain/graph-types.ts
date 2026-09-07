export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[]
export type JsonObject = { [key: string]: JsonValue }

export const NODE_TYPES = [
  'page',
  'container',
  'section',
  'frame',
  'text',
  'heading',
  'button',
  'input',
  'image',
  'icon',
  'list',
  'table',
  'card',
  'component-instance',
] as const

export type NodeType = (typeof NODE_TYPES)[number]

export type SemanticRole =
  | 'banner'
  | 'button'
  | 'cell'
  | 'complementary'
  | 'form'
  | 'heading'
  | 'img'
  | 'list'
  | 'main'
  | 'region'
  | 'table'
  | 'textbox'

export interface NodeSemantic {
  role?: SemanticRole
  label?: string
  accessibleName?: string
  description?: string
  level?: number
}

export type Dimension = number | 'auto' | 'fill' | { tokenId?: string; min?: number; max?: number }
export type LayoutDisplay = 'block' | 'flex' | 'grid' | 'stack'
export type LayoutDirection = 'row' | 'column'
export type LayoutPosition = 'flow' | 'absolute' | 'sticky'
export type Alignment = 'start' | 'center' | 'end' | 'stretch'
export type Justify = Alignment | 'space-between' | 'space-around' | 'space-evenly'

export interface SpacingConstraints {
  top?: number | string
  right?: number | string
  bottom?: number | string
  left?: number | string
}

export interface LayoutConstraints {
  display?: LayoutDisplay
  direction?: LayoutDirection
  width?: Dimension
  height?: Dimension
  padding?: SpacingConstraints
  gap?: number | string
  align?: Alignment
  justify?: Justify
  position?: LayoutPosition
  /** Temporary projection fields retained for the current canvas adapter. */
  x?: number
  y?: number
}

export type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'wide'

export interface ResponsiveConstraint {
  breakpoint: Breakpoint
  layout?: LayoutConstraints
  hidden?: boolean
  orderIndex?: number
}

export type StateName = 'default' | 'hover' | 'focus' | 'disabled' | 'loading' | 'error' | 'selected' | 'active'

export interface StateMetadata {
  name: StateName
  tokenRefs?: TokenReferenceMap
  properties?: JsonObject
}

export type InteractionType = 'click' | 'submit' | 'navigate' | 'open' | 'close'

export interface InteractionMetadata {
  type: InteractionType
  targetId?: string
  destination?: string
  intent?: string
}

export interface AccessibilityMetadata {
  role?: SemanticRole
  accessibleName?: string
  description?: string
  keyboard?: 'native' | 'button' | 'link' | 'custom'
  focusable?: boolean
  required?: boolean
  disabled?: boolean
}

export type AssetKind = 'image' | 'icon' | 'font'

export interface AssetReference {
  id: string
  kind: AssetKind
  name: string
  source: string
  altText?: string
}

export type TokenCategory = 'color' | 'spacing' | 'typography' | 'radius' | 'border' | 'shadow'
export type TokenValue = string | number | JsonObject
export type TokenReferenceMap = Partial<Record<'fill' | 'stroke' | 'text' | 'spacing' | 'radius' | 'border' | 'shadow' | 'typography', string>>

export interface DesignToken {
  id: string
  name: string
  category: TokenCategory
  value: TokenValue
  description?: string
}

export type TextStyle = 'normal' | 'italic' | 'oblique'

export interface TypographyDefinition {
  id: string
  name: string
  fontFamily: string
  fontSize: number | string
  fontWeight: number | string
  lineHeight: number | string
  letterSpacing: number | string
  style: TextStyle
}

export interface ComponentDefinition {
  id: string
  name: string
  description?: string
  anatomy: string[]
  variants: Record<string, string[]>
  props: string[]
  states: StateName[]
  tokenRefs: TokenReferenceMap
  accessibility?: AccessibilityMetadata
  intentIds?: string[]
}

export interface ComponentInstance {
  id: string
  definitionId: string
  nodeId: string
  props: JsonObject
  variant?: Record<string, string>
  state?: StateName
  contentOverrides?: JsonObject
  layoutOverrides?: LayoutConstraints
}

export type IntentTargetType = 'project' | 'page' | 'component' | 'node'

export interface DesignIntent {
  id: string
  targetType: IntentTargetType
  targetId: string
  statement: string
  priority?: 'low' | 'medium' | 'high'
  rationale?: string
}
