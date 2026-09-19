# Versioning and Proposals

This layer establishes the trust boundary for mutable design state.

```text
Design Graph
    ↓
Draft version
    ↓ explicit approval
Approved immutable version
```

Agent or external mutations are proposal-first:

```text
Approved version + requested operations
              ↓
          Proposal
              ↓ review
       New draft version
              ↓ explicit approval
       New approved version
```

## Contracts

`DesignVersion` snapshots a complete canonical `DesignGraph`, its deterministic
SHA-256 hash, project/document scope, status, author, and approval metadata.
Draft versions may be created and approved. Once approved, a version record is
not edited.

`DesignProposal` contains the base approved version, supported semantic
operations (`moveNode` and `deleteNode` in this slice), affected resource IDs,
rationale, author, validation result, and review state.

Proposal approval applies the validated operations to the base graph, persists
that result as a new draft, and updates the canonical graph to the draft. The
previous approved snapshot remains unchanged. The draft must be approved
separately.

## Concurrency and immutability

Proposals must identify the current approved base version. Creating or
approving a proposal against a stale base returns `VERSION_CONFLICT`. The
canvas application service accepts an optional version mutation guard; when an
approved version exists without a draft, direct move/delete mutations return
`APPROVAL_REQUIRED` instead of silently editing approved state.
When a draft is present, graph-backed canvas mutations update both the
canonical graph and that mutable draft snapshot before the draft can be
approved.

Semantic comparisons use canonical graph serialization and report added,
removed, and updated project, document, page, node, component, token,
typography, asset, and intent entities. They never compare screenshots or
CanvasElement state.

## Persistence boundary

Migration `002_versioning.sql` defines PostgreSQL tables for version snapshots
and proposals. The current application implementation uses
`MemoryVersionRepository` for tests and local development for richer
version/proposal orchestration. B7 Level 2 separately verifies canonical graph
hydration through PostgreSQL's `design_graphs` aggregate. No partial production
version source is fabricated.

The frontend trust surface uses scoped version HTTP commands for draft creation
and approval. Proposal review remains proposal-first: the existing
`DesignProposal` is validated and approved through the application service,
which creates a new draft; it never edits an approved snapshot. Stale bases
return `VERSION_CONFLICT`, and cross-project/document requests are rejected at
the application boundary.

Agent write capabilities, authentication, synchronization, implementation
reporting, and automatic approval remain later layers.

## Copilot proposal generation

Copilot captures the current approved version and project/document/page scope,
resolves selected node IDs against the canonical graph, and creates a pending
typed `DesignProposal` only after validation. Generation and approval are
separate: unsupported, ambiguous, unavailable, invalid, or stale context
produces clarification/error state and no executable proposal. Approval
continues through `VersioningApplicationService`, including its authoritative
stale-version check and canonical graph write.

The Layer 19 HTTP proposal contract is tested directly. Client workspace and
trusted-version fields are hints only: the server resolves the current approved
version and canonical graph, then revalidates project, document, page,
selection, relationships, and operations. Drift, unavailable or invalid graph
state, scope violations, and malformed requests cannot create executable
proposals. Review links preserve workspace query context. The Agent Console may
report a proposal awaiting review, but cannot execute or approve it directly.
