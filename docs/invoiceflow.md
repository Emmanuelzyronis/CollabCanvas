# InvoiceFlow Proof

Layer 12 establishes the first end-to-end InvoiceFlow proof using the
canonical Design Graph. It is a development/test orchestration, not the
InvoiceFlow product application and not a production deployment.

```text
InvoiceFlow Design Graph fixture
             ↓
typed repositories (development graph source)
             ↓
VersioningApplicationService
             ↓
approved immutable DesignVersion
             ↓
AgentHandoffApplicationService
             ↓
AgentGateway (READ_VERSION)
             ↓
coding-agent handoff: deterministic Design Manifest + provenance
```

## What the proof demonstrates

`InvoiceFlowProofApplicationService` provisions the existing
`createInvoiceFlowGraph()` fixture through the typed project, document, page,
and node repository contracts. It registers the complete richer graph with
the development `DesignGraphWriter`, creates the first draft, approves it, and
produces the existing approved-version handoff.

The integration test then authenticates a project-scoped development agent,
grants only `READ_VERSION`, and retrieves the approved handoff through the
existing `AgentGateway`. The resulting manifest contains the dashboard
hierarchy, reusable components and instances, tokens, typography, responsive
constraints, accessibility metadata, interactions, assets, and design intent.

The manifest is compiled by the existing handoff/application path and remains
derived. The Design Graph and approved version snapshot remain canonical.

## Determinism

Equivalent fixture runs use the existing deterministic graph and manifest
serialization. Their serialized manifests, graph hashes, and manifest hashes
are byte/equality equivalent. Version IDs may differ in normal operation, but
they are not part of the manifest itself.

## Current limitation

This proof uses typed in-memory repositories for deterministic orchestration in
tests and local development. The canonical PostgreSQL workspace path is now
verified separately by B7 Level 2 using the `design_graphs` JSONB aggregate.
The proof remains a development/test orchestration and does not claim to be the
InvoiceFlow product application or a production deployment.

## Deferred

This layer does not implement the InvoiceFlow application UI, implementation
status reporting, design/code synchronization, agent writes, Copilot,
production credentials, or Azure/deployment changes. Those belong to later
layers and must continue to consume the canonical graph, approved versions,
and gateway/application boundaries established here.
