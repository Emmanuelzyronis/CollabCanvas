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
`MemoryVersionRepository` for tests and local development because PostgreSQL
does not yet hydrate the full Layer 2 graph aggregate. No partial production
version source is fabricated.

This layer does not implement agent write capabilities, authentication,
proposal APIs, synchronization, implementation reporting, or automatic
approval. Those remain later layers.
