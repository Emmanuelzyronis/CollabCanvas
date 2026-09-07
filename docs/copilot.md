# Structured Copilot Foundation

Layer 14 establishes the first framework-independent Copilot application
boundary. It is proposal-first and provider-neutral.

```text
Approved Design Version
        ↓
Deterministic CopilotContext
        ↓
Injected CopilotPlanner
        ↓
Typed DesignChangeOperation[]
        ↓
VersioningApplicationService.createProposal
        ↓
Pending DesignProposal
```

## Context assembly

`CopilotApplicationService.inspect` accepts an explicit project, document,
approved base version, and optional selected node IDs. It returns a stable,
framework-independent context containing:

- project/document/page identity;
- semantic nodes and hierarchy metadata;
- component definitions and instances;
- tokens and typography;
- design intent;
- selected node IDs;
- the approved base version ID.

Collections are sorted by stable IDs. The context excludes React, Zustand,
CanvasElement, SVG state, browser state, credentials, and transient editor
state.

## Planner boundary

`CopilotPlanner` is an injected interface:

```ts
plan(context, instruction) -> { operations, rationale }
```

The repository does not choose or call an AI provider yet. A deterministic
test planner or a future provider adapter can implement this interface without
changing domain or versioning code.

## Proposal behavior

`CopilotApplicationService.propose` validates the instruction and planner
output, then delegates all operation validation and persistence to the
existing `VersioningApplicationService.createProposal` boundary.

The approved Design Graph is never edited. Invalid operations remain subject
to the existing proposal validation result, and no operation is applied until
the normal approval flow creates a new draft and a reviewer approves it.

## Deferred

This layer does not implement model providers, prompt orchestration, chat UI,
automatic approvals, direct graph mutation, code generation, visual diffing,
production credentials, or Copilot-specific gateway capabilities. Those can
be added behind the planner/application boundaries later.
