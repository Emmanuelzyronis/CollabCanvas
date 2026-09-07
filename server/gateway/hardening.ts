import { randomUUID } from 'node:crypto'
import type { AuditContext, GatewayErrorCode, GatewayOperation } from './contracts'

export interface AuditEvent {
  readonly id: string
  readonly recordedAt: string
  readonly context: AuditContext
  readonly errorCode?: GatewayErrorCode
}

export interface AuditSink {
  record(event: AuditEvent): void
}

export class MemoryAuditSink implements AuditSink {
  private readonly events: AuditEvent[] = []

  record(event: AuditEvent): void {
    this.events.push(Object.freeze({ ...event, context: Object.freeze({ ...event.context }) }))
  }

  list(): readonly AuditEvent[] {
    return this.events.map((event) => {
      const copy = structuredClone(event)
      return Object.freeze({ ...copy, context: Object.freeze({ ...copy.context }) })
    })
  }
}

export interface RateLimitRequest {
  readonly agentId: string
  readonly projectId: string
  readonly operation: GatewayOperation
}

export interface RateLimitDecision {
  readonly allowed: boolean
  readonly retryAfterMs?: number
}

export interface GatewayRateLimiter {
  check(request: RateLimitRequest): RateLimitDecision
}

interface Bucket {
  startedAt: number
  count: number
}

export interface InMemoryRateLimiterOptions {
  maxRequests: number
  windowMs: number
  now?: () => number
}

/** Development/test limiter; production should use a shared distributed policy. */
export class InMemoryGatewayRateLimiter implements GatewayRateLimiter {
  private readonly buckets = new Map<string, Bucket>()
  private readonly now: () => number

  constructor(private readonly options: InMemoryRateLimiterOptions) {
    if (!Number.isInteger(options.maxRequests) || options.maxRequests < 1) throw new Error('maxRequests must be a positive integer.')
    if (!Number.isInteger(options.windowMs) || options.windowMs < 1) throw new Error('windowMs must be a positive integer.')
    this.now = options.now ?? Date.now
  }

  check(request: RateLimitRequest): RateLimitDecision {
    const key = `${request.agentId}:${request.projectId}:${request.operation}`
    const timestamp = this.now()
    const current = this.buckets.get(key)
    if (!current || timestamp - current.startedAt >= this.options.windowMs) {
      this.buckets.set(key, { startedAt: timestamp, count: 1 })
      return { allowed: true }
    }
    if (current.count >= this.options.maxRequests) {
      return { allowed: false, retryAfterMs: Math.max(this.options.windowMs - (timestamp - current.startedAt), 0) }
    }
    current.count += 1
    return { allowed: true }
  }
}

export interface GatewayHardeningOptions {
  auditSink?: AuditSink
  rateLimiter?: GatewayRateLimiter
  auditId?: () => string
  now?: () => string
}

export function createAuditEvent(context: AuditContext, errorCode: GatewayErrorCode | undefined, options: GatewayHardeningOptions): AuditEvent {
  return Object.freeze({
    id: options.auditId?.() ?? randomUUID(),
    recordedAt: options.now?.() ?? new Date().toISOString(),
    context: Object.freeze({ ...context }),
    ...(errorCode ? { errorCode } : {}),
  })
}
