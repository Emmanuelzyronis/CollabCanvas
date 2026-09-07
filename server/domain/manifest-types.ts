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
  TypographyDefinition,
} from './graph-types'

export const DESIGN_MANIFEST_VERSION = '1'

export interface ManifestProjectIdentity {
  id: string
  name: string
  slug: string
}

export interface ManifestDocumentIdentity {
  id: string
  projectId: string
  name: string
}

export interface ManifestPage {
  id: string
  documentId: string
  name: string
  routeHint: string | null
  rootNodeIds: string[]
}

export interface ManifestGeometry {
  x?: number
  y?: number
  width?: number
  height?: number
}

/** Layout constraints are kept separate from optional editor geometry. */
export interface ManifestNode {
  id: string
  pageId: string
  parentId: string | null
  children: string[]
  type: NodeType
  name: string
  orderIndex: number
  semantic: NodeSemantic
  properties: JsonObject
  geometry?: ManifestGeometry
  layout: Omit<LayoutConstraints, 'x' | 'y'>
  tokenRefs?: Record<string, string>
  typographyId?: string | null
  responsive?: ResponsiveConstraint[]
  interactions?: InteractionMetadata[]
  states?: StateMetadata[]
  accessibility?: AccessibilityMetadata
  assetRef?: AssetReference
  componentInstanceId?: string | null
  intentIds?: string[]
}

export interface ManifestComponentDefinition {
  id: string
  name: string
  description?: string
  anatomy: string[]
  variants: Record<string, string[]>
  props: string[]
  states: ComponentDefinition['states']
  tokenRefs: Record<string, string>
  accessibility?: AccessibilityMetadata
  intentIds?: string[]
}

export interface ManifestComponentInstance {
  id: string
  definitionId: string
  nodeId: string
  props: JsonObject
  variant?: Record<string, string>
  state?: ComponentInstance['state']
  contentOverrides?: JsonObject
  layoutOverrides?: LayoutConstraints
}

export interface ManifestToken {
  id: string
  name: string
  category: DesignToken['category']
  value: DesignToken['value']
  description?: string
}

export interface ManifestTypography {
  id: string
  name: string
  fontFamily: string
  fontSize: TypographyDefinition['fontSize']
  fontWeight: TypographyDefinition['fontWeight']
  lineHeight: TypographyDefinition['lineHeight']
  letterSpacing: TypographyDefinition['letterSpacing']
  style: TypographyDefinition['style']
}

export interface ManifestAsset {
  id: string
  kind: AssetReference['kind']
  name: string
  source: string
  altText?: string
}

export interface ManifestIntent {
  id: string
  targetType: DesignIntent['targetType']
  targetId: string
  statement: string
  priority?: DesignIntent['priority']
  rationale?: string
}

export interface DesignManifest {
  manifestVersion: string
  project: ManifestProjectIdentity
  document: ManifestDocumentIdentity
  pages: ManifestPage[]
  nodes: ManifestNode[]
  componentDefinitions: ManifestComponentDefinition[]
  componentInstances: ManifestComponentInstance[]
  tokens: ManifestToken[]
  typography: ManifestTypography[]
  assets: ManifestAsset[]
  intents: ManifestIntent[]
}
