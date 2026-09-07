# Production Hardening Foundation

Layer 15 adds small operational contracts around the existing API and Agent
Gateway. These are foundations for production hardening, not a claim that the
system is production-ready.

## Runtime configuration

`loadRuntimeConfig` validates `NODE_ENV`, `PORT`, and `DATABASE_URL`. Production
requires a database URL; development and test environments may omit it for
isolated in-memory tests. Configuration errors do not print secret values.

The API uses the validated port and database URL in `server/index.ts`.

## Audit events

`AuditSink` receives immutable gateway events containing only an event ID,
recording time, safe `AuditContext`, and an optional machine-readable error
code. Credentials, authorization headers, SQL errors, and stack traces are not
recorded. `MemoryAuditSink` is for tests and local development; durable audit
storage remains deferred.

## Rate limiting

`GatewayRateLimiter` is an injectable policy evaluated after authentication and
before application execution. `InMemoryGatewayRateLimiter` keys buckets by
authenticated agent, project, and gateway operation. It returns a stable
`RATE_LIMITED` gateway error with optional retry timing. A distributed store and
production limits are intentionally deferred.

## Health endpoints

The API exposes safe process-level probes:

- `GET /healthz` → `{ data: { status: "ok" } }`
- `GET /readyz` → `{ data: { status: "ready" } }`

These endpoints do not expose database credentials or internal diagnostics. A
future readiness implementation can add dependency checks without changing
domain contracts.

## Error handling

Unexpected API errors are logged only with a request ID and error class name;
raw messages and stack traces are not returned or written to logs by the HTTP
adapter.

## Remaining production work

Production identity, secret management, distributed rate limiting, durable
audit persistence, database readiness checks, observability backends, backups,
deployment infrastructure, and security review are not implemented here.
