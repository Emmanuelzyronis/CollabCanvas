import { once } from 'node:events'
import { describe, expect, it } from 'vitest'
import { loadRuntimeConfig, RuntimeConfigError } from '../server/config'
import { createApiServer } from '../server/api/http'
import { AgentGateway } from '../server/gateway'
import { DevelopmentGatewayAuthenticator } from '../server/gateway/auth'
import { InMemoryGatewayRateLimiter, MemoryAuditSink } from '../server/gateway/hardening'

describe('production hardening foundations', () => {
  it('validates runtime configuration without exposing database credentials', () => {
    expect(loadRuntimeConfig({ NODE_ENV: 'production', PORT: '9000', DATABASE_URL: 'postgres://user:password@example/db' })).toEqual({ environment: 'production', port: 9000, databaseUrl: 'postgres://user:password@example/db' })
    expect(() => loadRuntimeConfig({ NODE_ENV: 'production', PORT: '9000' })).toThrow(new RuntimeConfigError('DATABASE_URL is required in production.'))
    expect(() => loadRuntimeConfig({ NODE_ENV: 'development', PORT: '0' })).toThrow('PORT must be an integer')
  })

  it('rate-limits by authenticated agent, project, and operation with deterministic retry data', () => {
    let now = 1000
    const limiter = new InMemoryGatewayRateLimiter({ maxRequests: 1, windowMs: 1000, now: () => now })
    expect(limiter.check({ agentId: 'agent-a', projectId: 'project-a', operation: 'READ_MANIFEST' })).toEqual({ allowed: true })
    expect(limiter.check({ agentId: 'agent-a', projectId: 'project-a', operation: 'READ_MANIFEST' })).toEqual({ allowed: false, retryAfterMs: 1000 })
    expect(limiter.check({ agentId: 'agent-a', projectId: 'project-b', operation: 'READ_MANIFEST' })).toEqual({ allowed: true })
    now = 2000
    expect(limiter.check({ agentId: 'agent-a', projectId: 'project-a', operation: 'READ_MANIFEST' })).toEqual({ allowed: true })
  })

  it('records immutable, secret-free audit events and maps rate limits safely', async () => {
    const auth = new DevelopmentGatewayAuthenticator()
    auth.register({ id: 'credential', agentId: 'agent-a', projectIds: ['project-a'], capabilities: ['READ_MANIFEST'], secret: 'super-secret' })
    const audit = new MemoryAuditSink()
    const limiter = new InMemoryGatewayRateLimiter({ maxRequests: 1, windowMs: 1000, now: () => 1000 })
    const gateway = new AgentGateway(auth, {
      getDocumentManifest: async () => ({ manifestVersion: '1', project: { id: 'project-a', name: 'Project', slug: 'project' }, document: { id: 'document-a', projectId: 'project-a', name: 'Document' }, pages: [], nodes: [], componentDefinitions: [], componentInstances: [], tokens: [], typography: [], assets: [], intents: [] }),
    }, undefined, undefined, { auditSink: audit, rateLimiter: limiter, auditId: (() => { let id = 0; return () => `audit-${++id}` })(), now: () => '2026-09-06T00:00:00.000Z' })

    await gateway.readManifest({ requestId: 'request-a', credential: 'super-secret', projectId: 'project-a', documentId: 'document-a', capability: 'READ_MANIFEST' })
    await expect(gateway.readManifest({ requestId: 'request-b', credential: 'super-secret', projectId: 'project-a', documentId: 'document-a', capability: 'READ_MANIFEST' })).rejects.toMatchObject({ code: 'RATE_LIMITED' })

    const events = audit.list()
    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({ id: 'audit-1', recordedAt: '2026-09-06T00:00:00.000Z', context: { requestId: 'request-a', outcome: 'succeeded' } })
    expect(events[1]).toMatchObject({ id: 'audit-2', context: { requestId: 'request-b', outcome: 'denied' }, errorCode: 'RATE_LIMITED' })
    expect(JSON.stringify(events)).not.toContain('super-secret')
    expect(Object.isFrozen(events[0]?.context)).toBe(true)
  })

  it('serves safe liveness and readiness responses', async () => {
    const server = createApiServer({} as never).listen(0)
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Test server did not expose a port.')
    const base = `http://127.0.0.1:${address.port}`
    const health = await fetch(`${base}/healthz`)
    const ready = await fetch(`${base}/readyz`)
    expect(health.status).toBe(200)
    expect(await health.json()).toMatchObject({ data: { status: 'ok' } })
    expect(ready.status).toBe(200)
    expect(await ready.json()).toMatchObject({ data: { status: 'ready' } })
    server.close()
  })
})
