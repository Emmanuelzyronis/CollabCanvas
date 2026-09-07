# Agent Handoff

Agent Handoff is the read-only bridge from an approved CollabCanvas design to
a coding agent. It is intentionally narrower than synchronization or code
generation.

```text
Coding agent
    ↓
AgentGateway.readApprovedVersion
    ↓
READ_VERSION + project scope
    ↓
AgentHandoffApplicationService
    ↓
approved DesignVersion snapshot
    ↓
deterministic Manifest compiler
    ↓
manifest + immutable version provenance
```

## Contract

The gateway request contains `projectId`, `documentId`, `versionId`, a
correlation `requestId`, and a credential. The gateway fixes the capability to
`READ_VERSION`; callers cannot request a write capability through this path.

The response contains:

- project and document identity;
- approved version ID and number;
- graph hash and manifest hash;
- version author and approval metadata;
- the deterministic `DesignManifest` compiled from that approved snapshot.

The manifest remains derived. The Design Graph and approved version snapshot
remain the sources of truth.

## Policy behavior

Authentication reuses the existing `GatewayAuthenticator`. Authorization
requires both explicit project scope and an explicit `READ_VERSION` grant. A
draft version, unknown version, or project/document mismatch is returned as a
safe `RESOURCE_NOT_FOUND` response. Internal compiler or repository failures
are mapped to `UPSTREAM_APPLICATION_ERROR`; credentials and stack traces are
never exposed.

The optional internal HTTP route is:

```text
GET /api/v1/gateway/approved-version
  ?projectId=:projectId
  &documentId=:documentId
  &versionId=:versionId
Authorization: Bearer <development credential>
```

This route is not enabled by the default production server wiring.

## Current limitation

The development implementation uses the in-memory version repository. The
PostgreSQL schema exists in `002_versioning.sql`, but full hydration of the
richer Layer 2 graph is not implemented. No production handoff is fabricated
when the canonical graph is unavailable.

This layer does not implement implementation reporting, synchronization,
framework adapters, code generation, production credentials, or automatic
agent writes. Those require later layers and explicit proposal/version rules.
