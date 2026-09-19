# CollabCanvas — The Seamless MVP

This document defines the MVP boundary. It is derived from
`docs/product-vision.md`, which stays authoritative for the intended product
experience; `docs/execution-strategy.md` stays authoritative for slice
sequencing and day-to-day priority.

Read this file when you need to decide whether something belongs in the
portfolio milestone.

## 1. What "seamless" means

Seamless does not mean "polished". It means the thread has no dead ends and no
cleanup labour:

- every step hands the next step something real, never a placeholder;
- machine output lands as design state the human owns — selectable, editable,
  movable — exactly as if they had drawn it;
- the human never has to repair the machine's output by hand;
- the human never has to know the architecture exists.

If a step requires the human to fix what the machine produced, the MVP is not
done. That is the whole acceptance standard.

## 2. The thread

The entire MVP is this one thread.

```text
1. Open CollabCanvas → choose Website            → a real empty design opens
2. Describe what you want                        → assistant proposes real elements
3. Review the proposal                           → approve / ask again / reject
4. Edit anything, by hand                        → behaves as if the human drew it
5. Ask for a refinement                          → real, visible design change
6. Save → reload                                 → identical design
7. Export → handoff                              → brief a coding agent
```

Status against the current implementation:

| Step | Status |
| --- | --- |
| 1. Workspace from a preset | implemented — `server/application/workspace-service.ts` creates project, document, page, draft and a real graph |
| 2. Describe → proposal | implemented — `createNode` is part of the proposal vocabulary, the built-in recipes and the Azure planner both emit it, and every create validates against the base graph |
| 3. Review / approve / reject | implemented — proposal review, approval, rejection, stale-base re-validation |
| 4. Hand editing | implemented — single canonical command bus (`create \| update \| move \| resize \| delete \| reorder \| duplicate`) |
| 5. Refinement | implemented — `updateNode` changes real layout (`gap`, `padding`) and style; the layout resolver reflows the projected canvas |
| 6. Save / reload | implemented — canonical graph persistence with base-version conflicts |
| 7. Export / handoff | implemented — the Handoff surface reads the manifest and the WebMCP export tools read the canonical graph through `src/graph/canonicalGraph.ts` |

Steps 2 and 5 were what the MVP was; they are now implemented. The sections
below are kept as the record of the gap they closed. `npm run workflow:mvp`
drives the thread in section 6 through a real browser.

## 3. Scope

### In scope

- One document, one page, website / flyer / logo presets.
- A described intent producing **new, real elements** with layout.
- The human editing every property of those elements by hand.
- One refinement instruction that changes layout or style, not only position.
- Persistence across reload.
- A handoff artefact that a coding agent can build from.

### Element vocabulary

Five kinds are enough for the MVP. Resist the urge to widen this:

```text
section   (frame / container)
heading
text
button
image
```

Anything beyond these five is post-MVP unless it is required by the demo
script in section 6.

### Out of scope

Multi-page documents, component authoring UI, vector/pen tools, boolean
operations, prototyping, animation, real-time collaboration, plugin
marketplace, cloud asset marketplace, enterprise permissions, sketch or
screenshot intake, 3D, video, and Figma parity.

Multi-page is explicitly blocked on a domain decision — see
`docs/execution-strategy.md`, EMM-100 status.

## 4. What is blocking it

### 4.1 The assistant cannot create anything

`DesignChangeOperation` is `moveNode | deleteNode`
(`server/domain/version-types.ts`), and the built-in planner emits only those
two (`server/application/copilot-planner.ts`). A user who says "create a hero
section" gets a clarification, because the vocabulary cannot express creation.

This is the single largest gap between the product promise and the product.

The architectural work is already done: the editor command bus executes
`create` through validated domain operations and persists canonically. The
proposal vocabulary needs to reach the same operations.

Done means: a described section becomes a proposal containing real create
operations, validating against the base graph, and applying on approval as
ordinary editable nodes.

### 4.2 Layout is decorative

The graph stores `display`, `direction`, `gap`, `padding`, `align` and
`justify` (`server/domain/graph-types.ts`), but the projection reads only
absolute `x/y/width/height` (`src/graph/canvasProjection.ts`).

Consequences: "hero" and "more spacious" are not meaningful instructions, and
the human positions everything by hand — the exact labour this product exists
to remove.

Done means: a minimum layout vocabulary that the projection honours — stack
row / column, gap, padding, fill / hug, alignment — applied to both
hand-created and assistant-created elements.

### 4.3 Text does not measure honestly

`wrapText()` estimates character width as `fontSize * 0.56`
(`src/canvas/ElementView.tsx`). Text wraps at the wrong point, so the human
hand-corrects wrapping and the result does not look designed.

Done means: real measurement for the text the product renders, so a heading
occupies the space it actually occupies.

### 4.4 Export does not read canonical state

`src/mcp/tools/export.ts` reads the runtime canvas store rather than the
canonical graph. The handoff promise — "enough structured design intent for a
coding agent to build the frontend" — is only kept by the Handoff surface.

Done means: one export path, reading canonical state, shared by every surface.

### 4.5 Not blocking, but visible

Undo/redo is in-memory (`EditorHistoryApplicationService`) and does not survive
a serverless restart. It is not part of the seamless thread, but a designer
without a reliable undo will not trust the tool, so it belongs in the polish
pass immediately after the thread closes.

### 4.6 The design material is too thin to compose with

This is the blocker that decides whether the assistant produces real interfaces
or flat rectangles. The assistant is only as good as the vocabulary the graph
can express: asking for "glassmorphism" or a "bento grid" is meaningless if the
schema cannot represent either.

Verified state of the material vocabulary:

| Material | In the graph | Rendered | Consequence |
| --- | --- | --- | --- |
| Flat fill, stroke, radius, opacity | yes | yes | works |
| Gradient | no | no | flat surfaces only; no depth or brand finish |
| Shadow / elevation | token category only (`{color, blur, y}`) | no | cards cannot lift off the page |
| Blur — layer or backdrop | no | no | glassmorphism is unrepresentable |
| Shape primitives — ellipse, line, polygon | no; only rectangular frame / section / card / container | partly | no logos, marks, dividers or icon-like forms |
| Grid tracks (columns, rows, gap) | `display: 'grid'` exists as a value, but no track definition exists anywhere | no | bento layouts are unrepresentable |
| Stack: direction, gap, padding, align, justify | yes | no — see 4.2 | "hero" cannot mean a real stack |
| Typography definitions | yes (family, size, weight, leading, tracking) | partially | only `Inter` is used; no curated catalogue, not editable in the Inspector |
| Colour tokens | yes, with real values and a full category set | tokens are not consumed by the renderer | no theme or palette to compose from |
| Effects as a list (multi-fill, inner shadow, noise) | no | no | no material variety at all |
| Device frames (phone, tablet, desktop) | no | no | no Android or iOS frame to design inside |
| Align, distribute, group, rotate | no | no | arrangement is manual pixel work (arrow-key nudge exists at 1px / 10px) |
| Asset pipeline | no — images are `data:` URIs inside the graph JSON | yes | large designs bloat the graph; no reusable assets |

The honest consequence today: the assistant can only compose flat rectangles
with text and images, placed at absolute coordinates. That is enough to be
demonstrable and not enough to look designed.

### 4.7 Engine order

The engine work is worth sequencing by what each addition unlocks, not by size:

```text
1  Layout resolver        stack direction, gap, padding, sizing, align/justify
                          → "hero", "spacious", responsive structure (blocks 4.2)
2  Style effects          gradient + shadow + blur as one effects list on the node
                          → glassmorphism, elevation, modern surfaces (blocks 4.6)
3  Grid tracks            columns and rows feeding the resolver
                          → bento and any multi-column composition (blocks 4.6)
4  Shape primitives       ellipse, line, polygon as real node types
                          → logos, marks, dividers (blocks 4.6)
5  Type and colour        a curated catalogue in tokens plus Inspector authoring
                          → the assistant composes from named styles, not hex literals
6  Arrangement commands   align, distribute, group, rotate
                          → deliberate composition instead of manual nudging
```

Item 5 is what makes "not generic" true: every recipe in
`server/domain/design-recipes.ts` currently hardcodes hex colours and one font
family. The assistant should compose from the design's own tokens and
typography instead, so the result belongs to the design rather than to the
recipe.

## 5. What must not be built to close the gap

- No second creation path. Assistant-created elements must go through the same
  domain operations as human-created ones.
- No fake proposal preview. If the vocabulary cannot express something, the
  assistant must say so rather than showing a preview that does nothing.
- No frontend-only layout. Layout must be stored in the graph or not claimed at
  all.
- No new vocabulary on human-facing surfaces. See §2 of
  `docs/product-vision.md`.
- No expansion of the element vocabulary, presets or panels while steps 2 and 5
  remain broken.

## 6. Acceptance test

A person who is not a designer, with no help and no explanation of the
architecture, must be able to do all of the following without a dead end:

```text
1.  Open CollabCanvas.
2.  Start a Website design.
3.  Describe a hero in one sentence.
4.  See a proposal naming what it will create.
5.  Approve it.
6.  See the hero on the canvas as separate, selectable elements.
7.  Change the heading text by hand.
8.  Move the button by hand.
9.  Ask for the section to be more spacious; see real spacing change.
10. Reload; the design is identical.
11. Open Handoff; copy a brief that names structure, layout, typography,
    spacing and colour.
12. Hand that brief to a coding agent and get a working frontend.
```

Every step must be reachable through the visible interface. If a step needs a
comment in the source, a console command or a test helper, it is not done.

## 7. Definition of done

The MVP is complete when:

1. The thread in section 2 runs end to end in the browser.
2. The acceptance test in section 6 passes without inside knowledge.
3. No step exposes graph, node-ID, version, projection, manifest or gateway
   vocabulary.
4. Assistant-created and human-created elements are indistinguishable in the
   graph, in Layers, in the Inspector and in the handoff.
5. `make check` passes and the workflow scripts
   (`npm run workflow:human`, `npm run workflow:presets`) still pass.
6. The story is demonstrable in a single screen recording without narration
   about architecture.

## 8. Decisions required

These are product decisions, not implementation details. They should be settled
before the corresponding work starts.

1. **Who interprets the sentence?** The built-in planner is deterministic and
   rule-based; the Azure planner is a model. The MVP needs at least one path
   that reliably turns a hero description into a composition. Decide whether
   the portfolio demo depends on a configured model or must work offline with
   the built-in planner.
2. **How much layout is enough?** The minimum that makes "hero" and "more
   spacious" true. Proposed: stack direction, gap, padding, width sizing
   (fill / hug / fixed) and alignment. Everything else waits.
3. **Placement for new sections.** Where a newly created section lands when the
   page already has content. Proposed: below the existing extent, never
   overlapping.
4. **Is inline approval required?** Today review is a separate surface reached
   by a link, followed by a reload. Decide whether that is acceptable for the
   demo or whether approval must be inline in the canvas.

## 9. Risks

- **Breadth.** The assistant could be widened into a generic "generate a whole
  page" feature, which would produce impressive screenshots that the human
  cannot edit — the exact failure the vision forbids.
- **Vocabulary.** Create operations tempt a schema-per-element-type system.
  Keep the existing node model.
- **Layout scope.** A layout engine can absorb unlimited time. The MVP needs
  stacking, gap, padding and sizing, nothing more.
- **Determinism.** If a model generates layout numbers, the same instruction
  may produce different designs. That is acceptable for the assistant, but the
  handoff must remain a deterministic projection of whatever was approved.

## 10. Relationship to the other documents

```text
docs/product-vision.md      what the human should feel
docs/mvp.md                 the smallest thread that delivers it   ← this file
docs/execution-strategy.md  the order work happens in
frontend-architecture.md    how the frontend is built
ARCHITECTURE.md             how the system is built
AGENTS.md                   the implementation constitution
```

When the MVP and a slice plan disagree about priority, the MVP wins: the
pipeline is the product, and a feature that does not appear in section 2's
thread is not on the critical path.
