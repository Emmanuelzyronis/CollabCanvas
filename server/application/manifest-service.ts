import type { DesignDocument } from '../domain/contracts.js'
import { GraphValidationError } from '../domain/graph-validation.js'
import { compileDesignManifest, ManifestCompilationError } from '../domain/manifest-compiler.js'
import { DomainError } from '../domain/errors.js'
import type { DesignManifest } from '../domain/manifest-types.js'
import type { DesignGraphRepository, DesignRepository } from '../persistence/repository.js'

export interface ManifestApplication {
  getDocumentManifest(documentId: string): Promise<DesignManifest>
}

function requiredId(value: string): string {
  let decoded: string
  try {
    decoded = decodeURIComponent(value)
  } catch {
    throw new DomainError('VALIDATION_ERROR', 'documentId must be a valid URL path value.')
  }
  if (typeof value !== 'string' || decoded.trim().length === 0) {
    throw new DomainError('VALIDATION_ERROR', 'documentId must be a non-empty string.')
  }
  return decoded.trim()
}

/** Application boundary for retrieving a derived manifest by document scope. */
export class ManifestApplicationService implements ManifestApplication {
  constructor(
    private readonly resources: Pick<DesignRepository, 'getDocument'>,
    private readonly graphs: DesignGraphRepository,
  ) {}

  async getDocumentManifest(documentId: string): Promise<DesignManifest> {
    const id = requiredId(documentId)
    const document = await this.getDocument(id)
    const graph = await this.getGraph(document)
    try {
      return compileDesignManifest(graph)
    } catch (error) {
      if (error instanceof GraphValidationError) {
        throw new DomainError('INVALID_GRAPH', 'The canonical design graph is invalid.', {
          issues: error.issues,
        })
      }
      if (error instanceof ManifestCompilationError) {
        throw new DomainError('MANIFEST_COMPILATION_ERROR', 'The design graph could not be compiled into a manifest.')
      }
      throw error
    }
  }

  private async getDocument(id: string): Promise<DesignDocument> {
    const document = await this.resources.getDocument(id)
    if (!document) throw new DomainError('NOT_FOUND', `Design document "${id}" was not found.`)
    return document
  }

  private async getGraph(document: DesignDocument) {
    try {
      const graph = await this.graphs.getDesignGraph(document.id)
      if (!graph) throw new DomainError('GRAPH_UNAVAILABLE', `The canonical design graph for document "${document.id}" is unavailable.`)
      if (graph.document.id !== document.id || graph.document.projectId !== document.projectId) {
        throw new DomainError('GRAPH_UNAVAILABLE', 'The canonical design graph does not match the requested document.')
      }
      return graph
    } catch (error) {
      if (error instanceof DomainError) throw error
      throw new DomainError('GRAPH_UNAVAILABLE', 'The canonical design graph is unavailable.')
    }
  }
}
