import type {
  CreateDocumentInput,
  CreateNodeInput,
  CreatePageInput,
  CreateProjectInput,
  DesignDocument,
  DesignNode,
  PageGraph,
  Project,
} from '../domain/contracts.js'
import type { DesignManifest } from '../domain/manifest-types.js'

export type {
  CreateDocumentInput,
  CreateNodeInput,
  CreatePageInput,
  CreateProjectInput,
  DesignDocument,
  DesignNode,
  PageGraph,
  Project,
}
export type { DesignManifest }

export interface GetDocumentManifestRequest {
  documentId: string
}

export interface ApiMeta {
  requestId: string
  apiVersion: 'v1'
}

export interface ApiSuccess<T> {
  data: T
  meta: ApiMeta
}

export interface ApiFailure {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
  meta: ApiMeta
}

export type ManifestApiResponse = ApiSuccess<DesignManifest>
export type ManifestApiFailure = ApiFailure
