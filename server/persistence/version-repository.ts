import type { DesignProposal, DesignVersion } from '../domain/version-types.js'

export interface VersionRepository {
  getVersion(id: string): Promise<DesignVersion | null>
  listVersions(documentId: string): Promise<DesignVersion[]>
  saveVersion(version: DesignVersion): Promise<DesignVersion>
  updateVersion(version: DesignVersion): Promise<DesignVersion>
  getProposal(id: string): Promise<DesignProposal | null>
  saveProposal(proposal: DesignProposal): Promise<DesignProposal>
  updateProposal(proposal: DesignProposal): Promise<DesignProposal>
}
