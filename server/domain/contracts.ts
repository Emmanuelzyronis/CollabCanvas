import type {
  AccessibilityMetadata,
  AssetReference,
  ComponentDefinition,
  ComponentInstance,
  DesignIntent,
  DesignToken,
  InteractionMetadata,
  JsonObject,
  LayoutConstraints,
  NodeSemantic,
  NodeType,
  ResponsiveConstraint,
  StateMetadata,
  TokenReferenceMap,
  TypographyDefinition,
} from './graph-types'

export type { JsonObject, JsonPrimitive, JsonValue } from './graph-types'
export type {
  AccessibilityMetadata,
  AssetReference,
  ComponentDefinition,
  ComponentInstance,
  DesignIntent,
  DesignToken,
  InteractionMetadata,
  LayoutConstraints,
  NodeSemantic,
  NodeType,
  ResponsiveConstraint,
  StateMetadata,
  TokenReferenceMap,
  TypographyDefinition,
} from './graph-types'
export { NODE_TYPES } from './graph-types'

export interface Project {
  id: string
  name: string
  slug: string
  createdAt: string
  updatedAt: string
}

export interface DesignDocument {
  id: string
  projectId: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface Page {
  id: string
  documentId: string
  name: string
  routeHint: string | null
  createdAt: string
  updatedAt: string
}

/**
 * The first persisted graph primitive. Geometry is deliberately data inside
 * `layout`/`properties`; identity and hierarchy are explicit fields.
 */
export interface DesignNode {
  id: string
  pageId: string
  parentId: string | null
  type: NodeType
  name: string
  orderIndex: number
  semantic: NodeSemantic
  properties: JsonObject
  layout: LayoutConstraints
  tokenRefs?: TokenReferenceMap
  typographyId?: string | null
  responsive?: ResponsiveConstraint[]
  interactions?: InteractionMetadata[]
  states?: StateMetadata[]
  accessibility?: AccessibilityMetadata
  assetRef?: AssetReference
  componentInstanceId?: string | null
  intentIds?: string[]
  createdAt: string
  updatedAt: string
}

export interface PageGraph {
  page: Page
  nodes: DesignNode[]
}

export interface DesignGraph extends PageGraph {
  /** Owning identities required when compiling an agent-facing manifest. */
  project: Project
  document: DesignDocument
  componentDefinitions: ComponentDefinition[]
  componentInstances: ComponentInstance[]
  tokens: DesignToken[]
  typography: TypographyDefinition[]
  assets: AssetReference[]
  intents: DesignIntent[]
}

export interface CreateProjectInput {
  name: string
  slug?: string
}

export interface CreateDocumentInput {
  name: string
}

export interface CreatePageInput {
  name: string
  routeHint?: string | null
}

export interface CreateNodeInput {
  parentId?: string | null
  type: NodeType
  name: string
  orderIndex?: number
  semantic?: NodeSemantic
  properties?: JsonObject
  layout?: LayoutConstraints
  tokenRefs?: TokenReferenceMap
  typographyId?: string | null
  responsive?: ResponsiveConstraint[]
  interactions?: InteractionMetadata[]
  states?: StateMetadata[]
  accessibility?: AccessibilityMetadata
  assetRef?: AssetReference
  componentInstanceId?: string | null
  intentIds?: string[]
}
