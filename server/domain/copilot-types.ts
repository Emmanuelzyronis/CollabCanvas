import type { ComponentDefinition, ComponentInstance, DesignDocument, DesignIntent, DesignNode, DesignToken, Page, Project, TypographyDefinition } from './contracts.js'
import type { DesignChangeOperation, DesignProposal } from './version-types.js'

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
  pageId?: string
  baseVersionId: string
  /** Client context hint; the server independently verifies it is current and approved. */
  trustedVersionId?: string
  instruction: string
  selectedNodeIds?: readonly string[]
  author: string
}

export type CopilotGenerationStatus = 'ready' | 'clarification' | 'blocked'

export interface CopilotProposalPreview {
  status: CopilotGenerationStatus
  projectId: string
  documentId: string
  pageId: string
  baseVersionId: string
  summary: string
  rationale?: string
  operations: DesignChangeOperation[]
  affectedResourceIds: string[]
  validation: { valid: boolean; issues: Array<{ code: string; path: string; message: string }> }
  proposal?: DesignProposal
  clarification?: string
}

export interface CopilotPlanner {
  /** Product-level label for which assistant is answering; never a credential. */
  readonly provider?: 'azure-openai' | 'builtin'
  plan(context: CopilotContext, instruction: string): Promise<CopilotPlan>
}
