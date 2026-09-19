# Frontend Layer 17 — Semantic Diff UI

Layer 17 adds a projection-driven semantic diff surface for approved design
version comparisons.

`compareDesignGraphs` now returns `fieldChanges` in addition to the existing
entity-level `changes` contract. Each field change has a stable resource type,
resource ID, path, kind, and before/after values. This gives the frontend a
deterministic explanation of graph changes without relying on screenshots or
editor coordinates. Existing synchronization consumers continue to use the
unchanged entity-level list.

`projectSemanticDiff` groups fields by semantic resource and sorts resources
and paths deterministically. `SemanticDiffPanel` renders changed and
equivalent states plus loading, empty, and error states. It has no persistence
or version-store ownership. The workspace query boundary fetches comparisons
from the scoped API and activates the panel when `fromVersion` and `toVersion`
URL parameters are present.

Focused coverage is in `tests/semantic-diff-ui.test.ts`.
