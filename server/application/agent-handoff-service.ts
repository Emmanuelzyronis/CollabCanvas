import { createHash } from 'node:crypto'
import { DomainError } from '../domain/errors.js'
import { GraphValidationError } from '../domain/graph-validation.js'
import { compileDesignManifest, ManifestCompilationError } from '../domain/manifest-compiler.js'
import { serializeDesignManifest } from '../domain/manifest-serialization.js'
import type { DesignManifest } from '../domain/manifest-types.js'
import type { VersionRepository } from '../persistence/version-repository.js'

export interface AgentHandoff {
  handoffVersion: '1'
  project: DesignManifest['project']
  document: DesignManifest['document']
  version: {
    id: string
    number: number
    status: 'approved'
    graphHash: string
    manifestHash: string
    createdAt: string
    createdBy: string
    approvedAt?: string
    approvedBy?: string
  }
  manifest: DesignManifest
}

/** Application read boundary for handing an immutable approved design to an agent. */
export class AgentHandoffApplicationService {
  constructor(private readonly versions: Pick<VersionRepository, 'getVersion'>) {}

  async getApprovedVersionHandoff(versionId: string): Promise<AgentHandoff> {
    const version = await this.versions.getVersion(versionId)
    if (!version) throw new DomainError('NOT_FOUND', `Design version "${versionId}" was not found.`)
    if (version.status !== 'approved') throw new DomainError('VERSION_IMMUTABLE', 'Only approved versions can be handed to an agent.')

    let manifest: DesignManifest
    try {
      manifest = compileDesignManifest(version.graph)
    } catch (error) {
      if (error instanceof GraphValidationError) throw new DomainError('INVALID_GRAPH', 'The approved design graph is invalid.', { issues: error.issues })
      if (error instanceof ManifestCompilationError) throw new DomainError('MANIFEST_COMPILATION_ERROR', 'The approved design graph could not be compiled.')
      throw error
    }

    const manifestHash = createHash('sha256').update(serializeDesignManifest(manifest)).digest('hex')
    return {
      handoffVersion: '1',
      project: manifest.project,
      document: manifest.document,
      version: {
        id: version.id,
        number: version.number,
        status: 'approved',
        graphHash: version.graphHash,
        manifestHash,
        createdAt: version.createdAt,
        createdBy: version.createdBy,
        ...(version.approvedAt ? { approvedAt: version.approvedAt } : {}),
        ...(version.approvedBy ? { approvedBy: version.approvedBy } : {}),
      },
      manifest,
    }
  }
}
