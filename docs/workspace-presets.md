# Human Editor Presets — Starter Designs

The start screen offers Blank canvas, Website, Flyer and Logo. Before this
slice the last three opened an empty canvas with a different project name, so
the preset promised a design it did not deliver. Website, Flyer and Logo now
seed a real starter composition; Blank stays empty.

```text
Human chooses a preset
        ↓
POST /api/v1/workspaces { preset }
        ↓
HumanWorkspaceService
        ↓
presetTemplate(preset)          (server/domain/preset-templates.ts)
        ↓
createNode domain operation
        ↓
DesignGraph validation
        ↓
Persistence (design_graphs aggregate)
        ↓
Initial draft version (starter design is the base)
        ↓
Canvas / Layers / Inspector
```

## Canonical extension

`server/domain/preset-templates.ts` holds presentation-only blueprints: node
type, name, layout, properties, semantic role and an optional asset reference.
A blueprint carries no id, page scope, order index, or timestamp, so the same
preset always seeds the same design.

`HumanWorkspaceService` assigns identity, page scope, sibling order and
timestamps, appends each node through the existing `createNode` domain
operation, and saves the validated graph before `createDraft` records the
initial version. The starter design is therefore the base version, not a
post-hoc mutation.

Assets are bundled: the starter artwork is an inline `data:` image registered
in `graph.assets`, so image nodes resolve without a network fetch, a client
asset store, or a second source of truth.

## Human surface

- Blank canvas — empty page, unchanged.
- Website — 1440-wide hero section, headline, subhead, primary CTA, image, and
  a feature card with title and copy.
- Flyer — portrait background, event title, photo, details block, CTA button.
- Logo — canvas, mark, wordmark and tagline.

Every node is a normal canonical node: selectable, movable, resizable, editable
in the Inspector, listed in Layers, and undoable through the canonical history
service. The editor fits the seeded composition into the viewport on open.

## Verification

- `tests/workspace-presets.test.ts` covers blank emptiness, validation and
  structural determinism for each preset, asset resolution, projection into
  visible canvas content, and the initial version snapshot.
- `npm test`, `npm run typecheck`, `npm run build`, `make check`.
- `npm run workflow:presets` — real browser proof (Playwright, real clicks)
  that each preset opens a real design, fits the viewport, lists the same nodes
  in Layers, selects and edits a seeded node through the inspector, and
  survives reload. Requires `npm run dev` and `npm run api`; screenshots land
  in `.playwright-mcp/`.

## Deferred

Multi-page documents, a user-editable template gallery, component/instance
templates, responsive variants of a preset, and client-side asset upload stay
out of this slice.
