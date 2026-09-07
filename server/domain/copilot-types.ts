import type { ComponentDefinition, ComponentInstance, DesignDocument, DesignIntent, DesignNode, DesignToken, Page, Project, TypographyDefinition } from './contracts'
import type { DesignChangeOperation } from './version-types'

export interface CopilotContext {
  project: Pick<Project, 'id' | 'name' | 'slug'>
  document: Pick<DesignDocument, 'id' | 'projectId' | 'name'>
  page: Pick<Page, 'id' | 'documentId' | 'name' | 'routeHint'>
  baseVersionId: string
  nodes: DesignNode[]
  componentDefinitions: ComponentDefinition[]
  componentInstances: ComponentInstance[]
  tokens: DesignToken[]
  typography: TypographyDefinition[]
  intents: DesignIntent[]
  selectedNodeIds: string[]
}

export interface CopilotPlan {
  operations: DesignChangeOperation[]
  rationale: string
}

export interface CopilotRequest {
  projectId: string
  documentId: string
  baseVersionId: string
  instruction: string
  selectedNodeIds?: readonly string[]
  author: string
}

export interface CopilotPlanner {
  plan(context: CopilotContext, instruction: string): Promise<CopilotPlan>
}
