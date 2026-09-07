# Design/Code Synchronization Foundation

Layer 13 establishes the first controlled synchronization foundation. It
connects approved design versions to implementation evidence and computes a
semantic impact for a later synchronization workflow.

```text
Approved Design Version A
          ↓
ImplementationStatusReport
          ↓
Semantic comparison with approved Design Version B
          ↓
SynchronizationImpact
          ↓
Pending SynchronizationProposal
```

## Implementation status

`SynchronizationApplicationService.reportImplementationStatus` records an
agent's evidence against an approved version:

- project and document scope;
- approved design version ID;
- authenticated reporting principal;
- repository, branch, commit, and environment when available;
- implementation status (`connected`, `reading_design`, `implementing`,
  `validating`, `implemented`, `drift_detected`, or `sync_proposed`);
- advisory implementation surfaces and notes;
- deterministic report timestamp supplied by the application boundary.

The report is evidence, not canonical design state. It cannot modify a graph
or an approved version.

## Semantic impact

`compareApprovedVersions` delegates to the existing versioning comparison
service. It compares canonical Design Graph state and returns stable hashes,
semantic changes, affected resource IDs, and semantic surfaces such as
`node:node_dashboard_title` or `componentDefinition:component_primary_button`.

No repository-file impact is inferred. Agent-provided implementation surfaces
remain advisory evidence; a future repository integration may map semantic
resources to verified files.

## Synchronization proposals

`proposeSynchronization` requires:

1. a project/document scope;
2. an approved implemented base version;
3. a second approved target version;
4. an implementation report tied to the base version;
5. a rationale.

It creates a `pending` proposal containing the semantic impact and does not
apply operations, mutate the Design Graph, approve a version, or edit code.
Equivalent versions cannot produce a proposal. The proposal is therefore a
reviewable synchronization request, not an automatic sync engine.

## Gateway boundary

The existing Agent Gateway exposes two explicit development capabilities for
this foundation:

- `REPORT_IMPLEMENTATION_STATUS`
- `PROPOSE_SYNC`

Authentication and project scope are reused from the existing gateway. The
reporting principal is taken from the authenticated identity rather than a
caller-supplied agent ID. Gateway methods call the synchronization application
service and never access persistence or the Manifest compiler directly.

The transport-neutral semantic synchronization registry exposes matching
`report_implementation_status` and `propose_sync` tools. It is separate from
the legacy browser WebMCP registry, which remains exactly 33 canvas/editor
tools. No standalone remote MCP transport is added here.

## Current persistence limitation

The current implementation uses `MemorySynchronizationRepository` for local
development and tests, matching the existing in-memory rich-graph/version
boundary. PostgreSQL still does not hydrate the complete Layer 2 graph, and
implementation links/proposals are not yet durably stored in production.

## Deferred

This layer does not implement automatic code changes, repository inspection,
framework adapters, proposal approval/application, webhooks, rate limiting,
production credentials, or visual diffing. Those require additional policy,
security, and implementation integration work.
