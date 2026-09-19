# Frontend Layer 16 — Token Reference Editing

Layer 16 adds the first graph-backed token authoring control to the inspector.

The graph projection resolves each node's `tokenRefs` into stable token slots
and exposes a deterministic, name-sorted catalog of canonical project tokens.
The inspector renders a selector per existing slot. Read-only projections keep
the controls disabled; editable projections emit a `tokenRefs` patch through
the existing `onUpdateNode` application boundary. Clearing a selector removes
that slot reference.

The inspector does not fetch, persist, or invent token data. The application
service validates the resulting graph, saves it, and returns the canonical
graph for reprojection. Invalid token IDs therefore remain rejected by the
existing graph validation contract.

Focused coverage lives in `tests/token-reference-editing.test.ts` and covers
catalog ordering, read-only/editable control states, and persistence through
`CanvasGraphApplicationService`.
