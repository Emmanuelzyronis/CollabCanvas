# Agent Gateway Foundation (Layer 5)

The Agent Gateway is the controlled machine-access boundary around the
CollabCanvas application layer. Its initial read capabilities are
`READ_MANIFEST` and `READ_VERSION` (approved-version handoff). Layer 13 adds
the explicit synchronization-foundation capabilities
`REPORT_IMPLEMENTATION_STATUS` and `PROPOSE_SYNC`.

```text
Agent
 ↓
Agent Gateway
 ↓
Identity
 ↓
Project Scope
 ↓
Capability
 ↓
ManifestApplicationService
 ↓
Design Graph / Manifest
```

The Agent Gateway is a policy boundary, not a second domain or persistence
layer.

## Current operation

The optional gateway HTTP route is distinct from the normal Manifest API:

```text
GET /api/v1/gateway/manifest?projectId=:projectId&documentId=:documentId
Authorization: Bearer <development credential>
```

The route fixes the requested capability to `READ_MANIFEST`. The project and
document IDs are explicit request scope, while document ownership is verified
against the trusted manifest returned by `ManifestApplicationService`.

The gateway never reads PostgreSQL, `CanvasElement`, Zustand, SVG state, or
browser state. It never calls `compileDesignManifest` directly and never
constructs a manifest. It delegates to the existing application service.

Approved-version handoff uses a separate `READ_VERSION` operation and returns
an immutable approved version's manifest together with graph/manifest hashes
and provenance. It is distinct from the document-current `READ_MANIFEST`
operation and rejects drafts.

## Authentication boundary

`GatewayAuthenticator` is the replaceable authentication interface. The
current `DevelopmentGatewayAuthenticator` is an in-memory test/development
implementation:

- credentials are registered explicitly for tests or local development;
- only a SHA-256 hash is retained in memory;
- project IDs and capabilities are stored as the credential's scope;
- credentials can be marked inactive;
- raw credential values are never returned by gateway responses or audit
  contexts.

Development authentication exists only to exercise the gateway boundary.
Production machine authentication is intentionally deferred. API keys,
OAuth, workload identity, service principals, and secret-management systems
can replace the authenticator without changing domain logic.

## Authorization

Authentication and authorization are separate checks:

1. A credential must authenticate to an `AgentIdentity`.
2. The requested project must be in the credential's explicit `ProjectScope`.
3. `READ_MANIFEST` must be explicitly present in the credential's capability
   grants.
4. The returned resource's project and document IDs must match the request.

For implementation status and synchronization proposals, the application
service additionally validates approved-version identity and report/base
version relationships. The authenticated identity is used as the report or
proposal author.

The gateway does not infer access from route availability or caller-supplied
agent IDs.

## Audit context

Each gateway result or failure carries an immutable `AuditContext` containing
only request ID, agent ID (when authenticated), project ID, capability,
operation, and outcome. It contains no secrets and is not persisted yet. A
future audit subsystem can consume this context without changing gateway
policy code.

## Error model

Gateway errors are distinct from domain/application errors:

| Code | Meaning |
| --- | --- |
| `UNAUTHENTICATED` | No credential was supplied |
| `INVALID_CREDENTIAL` | Credential is unknown or inactive |
| `PROJECT_SCOPE_DENIED` | Agent is not scoped to the requested project |
| `CAPABILITY_DENIED` | The requested capability was not granted |
| `RESOURCE_NOT_FOUND` | Document or project identity does not match |
| `INVALID_REQUEST` | Required gateway request data is invalid |
| `UPSTREAM_APPLICATION_ERROR` | Application service failed |

HTTP mapping preserves request IDs and returns safe messages without SQL,
stack traces, credential values, or internal exception text.

## Deferred work

The synchronization-foundation methods create implementation evidence and
pending, non-mutating proposals only. They do not apply code or design
changes. HTTP/WebMCP transport changes, proposal approval/application, OAuth,
production credential issuance, rate limiting, billing, deployment, and
multi-agent orchestration remain deferred. The existing 33 WebMCP canvas tools
remain store-based and unchanged.
