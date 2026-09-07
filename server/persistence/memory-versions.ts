import type { DesignProposal, DesignVersion } from '../domain/version-types'
import type { VersionRepository } from './version-repository'

/** Test/local repository; durable PostgreSQL hydration is a later slice. */
export class MemoryVersionRepository implements VersionRepository {
  private readonly versions = new Map<string, DesignVersion>()
  private readonly proposals = new Map<string, DesignProposal>()

  async getVersion(id: string): Promise<DesignVersion | null> {
    const version = this.versions.get(id)
    return version ? structuredClone(version) : null
  }

  async listVersions(documentId: string): Promise<DesignVersion[]> {
    return [...this.versions.values()]
      .filter((version) => version.documentId === documentId)
      .sort((a, b) => a.number - b.number || a.id.localeCompare(b.id))
      .map((version) => structuredClone(version))
  }

  async saveVersion(version: DesignVersion): Promise<DesignVersion> {
    const duplicate = [...this.versions.values()].find((item) => item.documentId === version.documentId && item.number === version.number)
    if (duplicate) throw new Error(`Version number ${version.number} already exists.`)
    const stored = structuredClone(version)
    this.versions.set(version.id, stored)
    return structuredClone(stored)
  }

  async updateVersion(version: DesignVersion): Promise<DesignVersion> {
    if (!this.versions.has(version.id)) throw new Error(`Version "${version.id}" was not found.`)
    const stored = structuredClone(version)
    this.versions.set(version.id, stored)
    return structuredClone(stored)
  }

  async getProposal(id: string): Promise<DesignProposal | null> {
    const proposal = this.proposals.get(id)
    return proposal ? structuredClone(proposal) : null
  }

  async saveProposal(proposal: DesignProposal): Promise<DesignProposal> {
    const stored = structuredClone(proposal)
    this.proposals.set(proposal.id, stored)
    return structuredClone(stored)
  }

  async updateProposal(proposal: DesignProposal): Promise<DesignProposal> {
    if (!this.proposals.has(proposal.id)) throw new Error(`Proposal "${proposal.id}" was not found.`)
    const stored = structuredClone(proposal)
    this.proposals.set(proposal.id, stored)
    return structuredClone(stored)
  }
}
