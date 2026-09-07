import { createHash } from 'node:crypto'
import type { AgentIdentity, AuthenticatedAgent, GatewayCapability } from './contracts'
import { GatewayError, type AuditContext } from './contracts'

export interface GatewayAuthenticator {
  authenticate(credential: string | undefined, auditContext: AuditContext): Promise<AuthenticatedAgent>
}

export interface DevelopmentCredentialInput {
  id: string
  agentId: string
  label?: string
  projectIds: readonly string[]
  capabilities: readonly GatewayCapability[]
  /** Supplied by a test/development harness; never persisted by this class. */
  secret: string
  active?: boolean
}

export interface DevelopmentCredentialHandle {
  credentialId: string
  secret: string
}

interface StoredCredential {
  id: string
  identity: AgentIdentity
  projectIds: readonly string[]
  capabilities: readonly GatewayCapability[]
  secretHash: string
  active: boolean
}

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}

/**
 * Deterministic in-memory authenticator for tests and local development.
 * Only a SHA-256 hash is retained; this is not production credential storage.
 */
export class DevelopmentGatewayAuthenticator implements GatewayAuthenticator {
  private readonly credentials = new Map<string, StoredCredential>()

  register(input: DevelopmentCredentialInput): DevelopmentCredentialHandle {
    const secret = input.secret
    this.credentials.set(hashSecret(secret), {
      id: input.id,
      identity: { id: input.agentId, ...(input.label ? { label: input.label } : {}) },
      projectIds: [...input.projectIds],
      capabilities: [...input.capabilities],
      secretHash: hashSecret(secret),
      active: input.active ?? true,
    })
    return { credentialId: input.id, secret }
  }

  setActive(credentialId: string, active: boolean): void {
    for (const credential of this.credentials.values()) {
      if (credential.id === credentialId) credential.active = active
    }
  }

  async authenticate(credential: string | undefined, auditContext: AuditContext): Promise<AuthenticatedAgent> {
    if (!credential) throw new GatewayError('UNAUTHENTICATED', 'Gateway credentials are required.', auditContext)
    const stored = this.credentials.get(hashSecret(credential))
    if (!stored || stored.secretHash !== hashSecret(credential)) {
      throw new GatewayError('INVALID_CREDENTIAL', 'Gateway credentials are invalid.', auditContext)
    }
    if (!stored.active) throw new GatewayError('INVALID_CREDENTIAL', 'Gateway credentials are inactive.', auditContext)
    return {
      identity: { ...stored.identity },
      credentialId: stored.id,
      scope: { projectIds: [...stored.projectIds] },
      capabilities: [...stored.capabilities],
    }
  }
}
