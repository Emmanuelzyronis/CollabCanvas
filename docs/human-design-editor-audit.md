# CollabCanvas Human Design Editor Audit

**Audit date:** 2026-09-09  
**Scope:** Existing repository and running product only  
**Mode:** Audit only — no editor features, refactors, schema changes, DesignGraph changes, Copilot expansion, AI generation, or agent/plugin layer were implemented  

---

## Executive Summary

### Can a human currently use CollabCanvas as a proper visual design editor?

**NO.**

CollabCanvas currently has a credible architectural foundation and a narrow graph-backed editing slice, but the running product is not yet a usable human visual design editor.

A designer can:

- open a hardcoded InvoiceFlow fixture graph
- see a graph-backed canvas, layer tree, and inspector
- select canonical nodes with the mouse or layer tree
- inspect semantic metadata
- rename nodes and change a few existing token references through the canonical API
- move and resize canvas elements locally
- resize existing canonical nodes through the one wired graph mutation path
- use 33 legacy WebMCP board tools against transient Zustand canvas state

A designer cannot:

- start from a blank project/page
- create an artboard/frame through visible UI
- discover an insert toolbar
- add persistent text, shapes, buttons, cards, images, sections, or components
- build real layouts
- upload or place a photo
- edit typography, colors, spacing, borders, or effects in a meaningful way
- reorder, group, lock, hide, or rename layers from the layer tree
- copy/paste
- rely on undo/redo across canonical graph operations
- save a manually created design and continue editing it after reload

The strongest part of the system is the architecture: canonical graph contracts, persistence, deterministic manifests, versions, proposals, trusted Copilot context, and gateway policy concepts. The weakest part is the human editing experience. Those two layers are not yet fully connected.

---

## Current Product Reality

### Running-product audit

The frontend starts with `npm run dev`, but the default local experience initially shows:

```text
GRAPH_UNAVAILABLE
Design context unavailable
```

The cause is runtime wiring, not designer error. `fetchWorkspaceGraph()` calls the current origin unless `window.__COLLABCANVAS_API_BASE__` is explicitly configured, and Vite has no API proxy. As a result, the graph request receives the Vite HTML shell instead of JSON.

After starting the API on `127.0.0.1:8787` and setting the API base, the workspace hydrates correctly and shows:

```text
Canonical graph
InvoiceFlow / InvoiceFlow dashboard design / Dashboard
GRAPH_AVAILABLE
```

This means local onboarding is currently broken for a designer following the normal `npm run dev` path.

### There is no blank-canvas starting point

The app defaults to a hardcoded InvoiceFlow dashboard:

```text
project_invoiceflow
doc_invoiceflow
page_invoiceflow_dashboard
```

There is no visible UI to create a project, document, page, artboard, or blank design.

The API has some creation routes, but they are not connected into a coherent human workflow:

- project creation exists at the API level
- page creation exists at the API level
- node creation exists through a separate normalized-table path
- none of these are exposed as a usable blank-design workflow
- creating a page does not create a hydratable canonical `DesignGraph`
- the current `DesignGraph` aggregate represents one page, not a complete multi-page document

Therefore the blank-canvas test fails at the first step.

### The visible editor is a shell plus a read-heavy projection

The current product provides:

- an application shell
- left project navigation
- graph-backed layer tree
- canvas workspace
- right inspector
- status bar
- read-only Overview
- read-only Design System
- read-only Assets
- minimal Versions surface
- Copilot proposal form

It does not currently mount the legacy toolbar, style panel, or Agent Console. Those components exist in the repository, but the active application does not use them.

A normal designer sees no visible controls for:

- adding text
- adding shapes
- adding images
- creating frames
- creating sections
- styling elements
- grouping
- locking
- aligning
- distributing
- undo/redo
- zoom controls
- viewport presets

Some operations remain reachable through hidden keyboard shortcuts, but they are not discoverable and are not persisted canonically.

### Canvas interaction reality

Real browser pointer testing confirmed:

- click selection works
- layer-tree selection works
- selection syncs with the inspector
- drag movement updates the visible canvas
- resize handles exist
- zoom and pan logic exists
- marquee selection, shift-selection, keyboard movement, duplicate, delete, undo, and redo logic exists in the canvas runtime

However, most of this operates on the local Zustand `CanvasElement` model.

A real pointer drag of `node_metric_card` moved the visible overlay, but the canonical graph layout remained unchanged:

```text
Visible canvas: moved
API DesignGraph layout.x: -198.70961300244878
```

Only resize is wired from the canvas to `context.resizeNode()` in `src/App.tsx` and committed in `src/canvas/Canvas.tsx`.

Move, create, delete, duplicate, reorder, group, text editing, styling, and undo/redo do not currently flow through the canonical graph mutation path.

### Hidden insertion creates a split-brain editor

Using the hidden text shortcut and canvas pointer path created a local element with this observed result:

```text
Status bar: 1 selected
Canvas: selected local element
Layers panel: element absent
Inspector: No selection
```

After reload, the local element disappeared and only the canonical InvoiceFlow nodes returned.

This is the clearest current editor defect: the canvas can create and select runtime elements that the graph-backed layer tree and inspector do not understand.

### Inspector reality

For a selected canonical node, the inspector exposes meaningful semantic context:

- node name
- node ID
- type
- parent
- ancestry
- semantic role
- accessible name
- label
- component definition
- component props
- variants
- layout values
- token references
- responsive constraints
- accessibility
- interactions
- design intent
- implementation metadata

Only these are editable:

- name
- accessible name
- semantic label
- existing token references

The following are read-only or absent:

- X/Y position editing
- width/height editing
- text content editing
- font family
- font size
- font weight
- line height
- letter spacing
- text alignment
- fill color
- text color
- stroke color
- border width/style
- radius
- shadow
- opacity
- padding
- margin
- gap
- alignment
- sizing mode
- component property editing
- image source/fit/alt editing
- responsive constraint editing

The inspector is therefore useful as a graph inspector, but not yet as a design property editor.

### Layers reality

The layer tree works as a projection of the canonical graph.

It correctly shows the InvoiceFlow hierarchy and selection state. It supports:

- hierarchy display
- expand/collapse
- semantic type labels
- component names
- interaction/state/responsive badges
- selection synchronization

It does not support:

- inline rename
- drag reorder
- bring forward
- send backward
- grouping
- ungrouping
- visibility
- locking
- duplicate
- delete
- page navigation

It also excludes local elements created by the hidden canvas insertion path.

### Assets and photos

There is no real asset workflow.

The Assets surface displays one fixture metadata record:

```text
InvoiceFlow mark
icon · InvoiceFlow
```

There is no:

- upload
- import
- browse
- thumbnail
- reuse
- replacement
- deletion
- organization
- image preview
- icon library
- font library
- binary storage
- MIME type
- image dimensions
- crop
- mask
- fit/fill controls
- focal point
- licensing metadata

The graph’s `AssetReference` is only metadata with a string `source`; it does not represent an uploaded binary asset. The canvas projection maps image nodes to rectangles and ignores `assetRef`.

A human cannot currently add a real photo.

### Design system and components

The Design System surface lists 12 fixture tokens but is read-only.

It does not show or author:

- typography definitions
- component definitions
- variants
- states
- reusable styles
- themes
- presets

The graph contains four component definitions and four instances, but the UI does not let a human:

- create components
- insert instances
- edit component definitions
- switch variants
- override instance properties
- propagate changes from a definition to instances

Current component instances are static graph data, not a usable reusable component system.

### Versions, proposals, and Copilot

The version/proposal architecture is substantially more mature than the editor.

The product shows:

- approved version
- draft version
- create draft
- approve draft
- refresh

The server enforces:

- approved-version immutability at the version service level
- proposal base-version checks
- stale proposal rejection
- proposal approval into a new draft
- deterministic graph hashing
- semantic comparison

But the runtime editor still has important trust gaps:

- canvas update/resize services are instantiated without the version mutation guard in the actual API server
- direct canonical mutations can therefore occur without recording the associated draft version
- frontend mutations do not identify a base version
- conflict handling is not exposed in the UI
- resize errors are silently swallowed in the canvas
- undo/redo does not cover canonical graph commands

Copilot currently supports only two structured proposal operations:

- move/reparent a node
- delete a node

It explicitly does not support:

- creating nodes
- renaming/content edits
- styling
- resizing
- duplication
- component changes
- token changes
- responsive changes

### WebMCP reality

The browser registers 33 WebMCP tools successfully. A read-only `get_board_state` call returned the current projected board state.

However, these are legacy board tools operating on Zustand `CanvasElement` state:

- `create_shape`
- `create_text`
- `create_frame`
- `update_element`
- `move_elements`
- `set_style`
- `delete_elements`
- `group_elements`
- `arrange_grid`
- `export_svg`
- `export_json`
- `clear_board`
- and others

They do not mutate the canonical DesignGraph, do not persist through reload, and do not enter the version/proposal/manifest chain.

The server-side semantic tools and gateway exist in tests and application code, but the running local API and Vercel API handler do not currently wire the gateway into the HTTP server. The Vercel handler configures the manifest service, but not the gateway.

This means the browser WebMCP surface and the semantic agent architecture are currently two separate worlds.

---

## Capability Matrix

| Capability | Status | What actually works | What is missing | DesignGraph support | Priority |
|---|---|---|---|---|---|
| Text | PARTIAL | Existing heading/text nodes render; inline text editing exists in local runtime; inspector shows semantic text context | No visible insert control; no persistent content editing; no rich text; no typography controls; local edits do not persist | PARTIAL: `text`, `heading`, `properties.text`, typography ID | P0 |
| Images/photos | MISSING | Graph has an image node type | No upload, browse, place, crop, fit, mask, replace, or render; image nodes render as rectangles | PARTIAL: node type and asset reference only | P0 |
| Assets | MISSING | One fixture asset metadata record is displayed | No real asset library, upload, binary persistence, thumbnails, reuse, replacement, deletion, or organization | PARTIAL: metadata-only `AssetReference` | P0 |
| Shapes | PARTIAL | Hidden keyboard shortcuts can create rectangle, ellipse, diamond, sticky, frame, connector, comment in local runtime | No visible toolbar; no canonical insertion; no persistence; no line/divider controls; no styling workflow | PARTIAL: graph supports broad node types but not the full legacy shape model | P0 |
| Frames | PARTIAL | Frame graph type and local frame tool exist; fixture hierarchy renders | No visible frame creation; no artboard size/viewport presets; no persistent frame creation; no frame layout behavior | PARTIAL: `frame` node type and hierarchy | P0 |
| Sections | PARTIAL | Fixture sections render and appear in layer tree | No section insertion or editing; no semantic layout behavior | PARTIAL: `section` node type | P1 |
| Layout | MISSING | Layout metadata is visible in inspector | No usable layout engine, controls, or rendering; graph layout constraints are not applied; x/y fallbacks dominate | PARTIAL: flex/grid/stack schema exists | P0 |
| Grid | MISSING | Fixture graph declares a grid section | No grid editing or actual grid layout rendering | PARTIAL: `display: grid` exists in schema | P0 |
| Components | PARTIAL | Existing component definitions/instances are projected and displayed in inspector | No component creation, insertion, editing, variant switching, overrides, or propagation | PARTIAL: definitions/instances exist | P1 |
| Typography | PARTIAL | Typography definitions exist in graph; text renders with basic size/weight | No typography authoring or editing; typography tokens are not applied by the canvas renderer | PARTIAL: typography model exists | P0 |
| Colors | PARTIAL | Token references on existing nodes can be changed | No general color pickers, raw styling controls, or token application workflow; renderer mostly uses hardcoded/projection defaults | PARTIAL: color tokens and references exist | P0 |
| Spacing | MISSING | Spacing values are visible in inspector | No padding, margin, gap, or layout spacing controls; no layout solver | PARTIAL: spacing schema exists | P0 |
| Alignment | MISSING | Alignment metadata is visible | No alignment controls; no distribution; no auto-layout behavior | PARTIAL: align/justify schema exists | P0 |
| Resize | PARTIAL | Real selection handles work; resize is wired to canonical graph for existing nodes | No numeric W/H editing; errors are silently ignored; local-only elements cannot be canonically resized | PARTIAL: layout width/height/x/y | P1 |
| Rotate | MISSING | No visible rotate behavior | No rotation handles or inspector control; renderer ignores rotation | MISSING: no typed canonical rotation field | P2 |
| Layers | PARTIAL | Graph hierarchy, expand/collapse, semantic badges, and selection sync work | No reorder, inline rename, group, ungroup, visibility, lock, duplicate, delete; local runtime elements absent | COMPLETE for canonical hierarchy | P0 |
| Inspector | PARTIAL | Strong semantic inspection; name/semantic/token edits flow through application service | No position, size, content, typography, color, border, effects, layout, component, image, or responsive editors | PARTIAL: projection is rich, editing contract is narrow | P0 |
| Pages | MISSING | API can create a page record | No page UI, page list, rename, duplicate, delete, reorder, or usable blank page; graph aggregate is one page | PARTIAL: page record exists, graph does not model multi-page document editing | P0 |
| Responsive | MISSING | App shell is responsive; responsive constraints are displayed | No device viewport, breakpoint switching, adaptive layout preview, responsive typography, or responsive spacing | PARTIAL: responsive constraint schema exists | P1 |
| Undo/redo | PARTIAL | Local Zustand board history works through keyboard shortcuts | No visible controls; no canonical command history; does not cover graph mutations, inspector edits, versions, or proposals | MISSING for editor commands | P0 |
| Copy/paste | MISSING | Ctrl+D duplicates local runtime elements | No clipboard copy/paste; no canonical duplication | MISSING | P1 |
| Snapping | MISSING | Background dot grid exists | No snapping, smart guides, alignment guides, or rulers | MISSING | P1 |
| Design tokens | PARTIAL | Token graph and read-only token list exist; existing node token refs can be replaced | No token creation/editing/deletion, no semantic slot validation, no token-driven rendering | PARTIAL | P1 |
| Prototype/interactions | MISSING | Interaction metadata appears in inspector and manifests | No interaction authoring, linking, preview mode, or prototype player | PARTIAL: interaction metadata exists | P2 |
| Copilot proposal visibility | BROKEN | Panel renders on Canvas and Agent Center; proposal records persist once created | No hide/collapse; navigation clears instruction/preview state; no visible activity console; panel obstructs canvas, especially mobile | N/A | P1 |

---

## P0 Blockers

These prevent CollabCanvas from functioning as a human design editor:

1. **No blank project/page/design workflow**
   - A designer cannot start from scratch.
   - New pages do not receive a hydratable canonical graph.

2. **No visible insert system**
   - No toolbar.
   - No discoverable way to add text, shapes, images, frames, sections, buttons, cards, or components.

3. **No canonical create-node editor operation**
   - The API’s node creation route writes to normalized `design_nodes`.
   - It does not update the `design_graphs` snapshot used by the workspace.
   - Rich input fields are dropped by `DesignService.createNode()`.

4. **Runtime/canonical graph split**
   - Canvas gestures mutate Zustand.
   - Layers and inspector consume the canonical graph.
   - Local elements can be selected by the canvas but invisible to layers and inspector.
   - Local changes disappear after reload.

5. **No real layout editor or layout engine**
   - Flex/grid/gap/padding/alignment metadata exists but is not editable or rendered.
   - Current projection mostly relies on x/y and fallback dimensions.

6. **No image/photo workflow**
   - No upload.
   - No storage.
   - No browsing.
   - No image rendering.
   - No fit/crop/mask controls.

7. **No usable typography/color/spacing controls**
   - A designer cannot establish a professional visual hierarchy.

8. **No canonical undo/redo**
   - Existing undo/redo is local board history.
   - It does not cover application commands or graph persistence.

9. **Layer hierarchy cannot be edited**
   - No reorder, group, ungroup, lock, hide, or layer-level rename/delete workflow.

10. **Version/draft consistency is not enforced in the actual runtime**
    - The local and Vercel API servers construct `CanvasGraphApplicationService` without the version mutation guard.
    - Canonical edits can bypass draft recording.
    - Frontend commands do not carry base-version expectations.

---

## P1 Gaps

These are required for a credible professional design workflow:

- component creation and reusable instances
- responsive viewport and breakpoint preview
- copy/paste
- snapping and alignment guides
- numeric X/Y/W/H editing
- token authoring and semantic slot validation
- component property editing
- page management UI
- conflict and read-only states
- visible zoom/fit controls
- rotate
- asset organization, replacement, deletion, and alt text
- Copilot panel hide/collapse with state preservation
- visible Agent Console/activity history
- visual and semantic proposal previews
- richer error handling for canvas mutations
- multi-page document model

---

## P2/P3 Gaps

### P2

- prototype/interaction authoring
- component variant workflows
- advanced auto-layout
- image crop, masking, focal point
- visual regression tooling
- performance profiling for large graphs
- advanced semantic diff visualization
- collaborative presence and multi-user editing
- plugin/agent onboarding UI

### P3

- pro-level vector editing
- rich text
- design import from external tools
- advanced asset licensing/versioning
- team-level permissions and audit UI
- marketplace/plugin ecosystem
- production credential management beyond the current development authenticator

---

## Copilot Proposal UX

The Copilot proposal panel is rendered as an always-visible floating overlay in the canvas workspace and Agent Center.

Current behavior:

- it appears whenever the graph is available
- it has no hide button
- it has no collapse control
- it is not a docked panel, but it is permanently visible
- the canvas remains technically interactive around it
- on desktop it overlays a 384×329 area of the canvas
- on a 390px mobile viewport it occupies 358px width, approximately 92% of the viewport width and 329px of the 739px canvas height
- navigating from Canvas to Assets and back clears the typed instruction
- the generated preview state is component-local and is also destroyed by navigation
- the legacy Agent Console component exists but is not mounted
- no visible activity feed is available in the current shell

A created proposal record is persisted server-side and can be reopened through a proposal URL, but the current panel’s instruction and preview state are not preserved.

The desired requirement is correct:

> Copilot proposal UI should be hideable/collapsible without destroying proposal state.

The current implementation does not satisfy it. The fix should preserve both visibility state and draft/preview state, or rehydrate active proposal state from the server when the panel is reopened.

---

## DesignGraph Risks

### 1. Rich schema, incomplete editor behavior

The graph model supports:

- node types
- hierarchy
- semantic metadata
- component definitions/instances
- tokens
- typography
- assets
- responsive constraints
- interactions
- states
- accessibility
- design intent

But most of this is descriptive metadata rather than executable editor behavior.

### 2. Layout is represented but not solved

The layout model includes:

- flex
- grid
- stack
- row/column
- gap
- padding
- alignment
- justify
- fixed/auto/fill dimensions
- responsive constraints

The canvas projection does not implement this layout system. It primarily converts nodes into flat rectangles/text using x/y and fallback dimensions.

The graph also retains temporary x/y projection fields inside canonical `LayoutConstraints`, blurring the boundary between semantic layout and canvas geometry.

### 3. Persistence is split

There are two persistence paths:

- normalized `design_nodes` CRUD
- complete `design_graphs` JSON snapshots

The workspace, manifest, versions, and proposals use the graph snapshot. The node creation API uses the normalized table.

That means a newly created node can be persisted in one place while remaining absent from the graph the editor and agents consume.

### 4. Multi-page design is not properly modeled

A `DesignGraph` extends `PageGraph` and represents one page. The `design_graphs` table stores one `page_id` per document.

This does not support a normal multi-page design document where one canonical document contains many pages and shared design-system resources.

### 5. Asset representation is too thin

`AssetReference` contains:

- id
- kind
- name
- source
- altText

It lacks:

- binary/blob reference
- MIME type
- dimensions
- storage key
- upload metadata
- crop/focal data
- licensing
- replacement history

### 6. Component system is descriptive, not operational

The graph can describe component definitions and instances, but there are no complete editor workflows for:

- creating definitions
- inserting instances
- editing definitions
- overriding instances
- propagating definition changes
- variant/state application

### 7. Graph validation is incomplete

Current validation strongly checks:

- hierarchy
- cycles
- sibling order
- page scope
- token references
- typography references
- asset references
- component references
- intent references

It does not deeply validate:

- property schemas per node type
- layout constraint correctness
- token category/slot compatibility
- component prop types
- asset source validity
- responsive constraint validity
- interaction target validity
- semantic role correctness

The inspector even allows selecting any token for any existing token slot, regardless of category.

### 8. Direct mutations bypass draft/version integration

`CanvasGraphApplicationService` supports a mutation guard, but the actual API server does not pass one.

As a result, update and resize operations can mutate the canonical graph without recording the corresponding draft version. This can make the canonical graph and version history diverge.

### 9. No concurrency contract in the editor path

Frontend update and resize commands do not identify:

- base version
- expected graph hash
- draft ID
- revision

There is no robust stale-write handling in the human editor path.

### 10. Undo/redo is outside the graph command system

Zustand history stores local board snapshots. Canonical application commands do not emit an undoable command history.

This means undo could restore a canvas projection without restoring the canonical graph, or fail to reflect server-side state.

### 11. WebMCP and semantic architecture are disconnected

The browser WebMCP tools operate on the local board. The semantic tools and Agent Gateway operate on the server-side graph and manifest architecture.

An external WebMCP agent can currently “edit” a board that is not the canonical design and will not survive reload or enter the manifest.

### 12. Runtime integration is inconsistent

The local API server does not configure:

- manifest service
- Agent Gateway

The Vercel API handler configures:

- manifest service
- no Agent Gateway

Tests inject these services, but the actual runtime does not fully expose the intended agent chain.

---

## Recommended Build Sequence

This is a plan only; nothing below was implemented.

### 1. Fix runtime integration and onboarding

Before adding editor features:

- add a local Vite API proxy or stable API-base configuration
- source environment variables consistently for local API startup
- configure manifest and gateway services in every runtime
- make `/health` and graph hydration reliable
- remove the split between test wiring and actual server wiring

### 2. Establish a real blank workspace

Implement the smallest workspace bootstrap:

- create project
- create document
- create first page
- create an empty canonical graph
- hydrate the blank graph
- route to the new page
- support reload

This must create a graph, not only normalized page/node rows.

### 3. Define the editor command bus

Create one canonical command path for:

- create node
- update node
- move node
- resize node
- delete node
- reorder node
- duplicate node
- group/ungroup where represented

Each command should include:

- document/page scope
- node ID
- base version or expected revision
- operation payload
- validation result
- undo record
- conflict result

### 4. Build the visible insert toolbar

Expose the first core insertables:

- frame/artboard
- section/container
- text
- heading
- rectangle
- ellipse
- image
- button placeholder
- card placeholder

Every insertion must create a canonical node and refresh the projection.

### 5. Complete canvas gesture persistence

Wire these gestures to graph commands:

- click select
- shift select
- marquee select
- drag move
- resize
- keyboard nudge
- delete
- duplicate
- reorder
- text commit

The canvas should show optimistic temporary state, then reconcile from the canonical graph.

### 6. Implement layout rendering and editing

Start with:

- frame
- section
- vertical stack
- horizontal stack
- fixed size
- fill
- hug
- gap
- padding
- alignment
- z-order
- absolute fallback

Then add grid and responsive preview.

### 7. Build the semantic inspector

Required controls:

- name
- text/content
- X/Y
- W/H
- sizing mode
- layout parent
- typography
- text alignment
- fill
- stroke
- border
- radius
- opacity
- shadow
- image source/fit/alt
- responsive constraints

All persistent edits must go through application commands.

### 8. Complete layer editing

Add:

- inline rename
- reorder
- reparent
- group/ungroup
- lock
- hide
- duplicate
- delete
- selection sync
- graph validation warnings

### 9. Build the asset workflow

Minimum viable assets:

- upload
- browse
- thumbnail
- stable asset ID
- MIME type
- dimensions
- alt text
- place on canvas
- resize
- fit/fill
- replace
- delete
- reload persistence

### 10. Complete typography and token workflow

Allow designers to:

- view tokens
- create tokens
- edit tokens
- apply tokens by semantic slot
- validate token category
- author typography
- apply typography to text nodes
- see token-driven rendering

### 11. Add pages and screens

Support:

- page list
- create
- rename
- duplicate
- delete
- reorder
- route hint
- switch page
- shared document design system

### 12. Add canonical undo/redo and copy/paste

Undo/redo should operate on application command history, not local board snapshots.

Copy/paste should duplicate canonical nodes and child graphs with stable new IDs.

### 13. Add responsive preview

After real layout exists:

- desktop/tablet/mobile viewports
- breakpoint switching
- responsive constraint editing
- adaptive layout preview
- responsive typography/spacing
- responsive component behavior

### 14. Align WebMCP with the graph

The browser tools should stop being a separate board database. They should either:

- call the same application commands as the human editor, or
- be clearly labeled as transient canvas annotations until replaced

Agent-visible design mutations must enter the same graph, version, proposal, and manifest chain.

### 15. Then expand components and Copilot

Only after the editor can create and persist real design state should the product expand:

- reusable components
- variants
- Copilot create/style operations
- visual proposal previews
- semantic diff previews
- Agent Center

---

## Minimum Viable Human Design Editor

The smallest coherent editor for manually building a professional landing page would require:

### Toolbar

- select
- hand/pan
- text
- heading
- frame/artboard
- section/container
- rectangle
- ellipse
- image
- button
- card
- undo
- redo
- zoom in
- zoom out
- fit to screen
- save/saved state

### Insertable elements

- frame with viewport preset
- section/container
- heading
- paragraph
- label
- rectangle
- ellipse
- image
- button
- card
- divider

### Asset workflow

- upload image
- browse uploaded images
- thumbnail preview
- stable ID
- alt text
- place image
- resize image
- fit/fill
- replace image
- delete image
- reload persistence

### Canvas interactions

- click select
- shift select
- marquee select
- drag move
- resize handles
- keyboard nudge
- delete
- duplicate
- zoom
- pan
- fit to screen
- snapping
- basic alignment guides

### Layout primitives

- frame
- section
- vertical stack
- horizontal stack
- fixed width/height
- fill
- hug
- gap
- padding
- alignment
- distribution
- z-order
- absolute fallback

### Inspector controls

- name
- text content
- X/Y
- width/height
- sizing mode
- font family
- font size
- font weight
- line height
- letter spacing
- text alignment
- text color
- fill
- stroke
- border width/style
- radius
- opacity
- shadow
- image source/fit/alt
- parent/child context

### Layers functionality

- hierarchy
- expand/collapse
- rename
- reorder
- reparent
- lock
- hide
- duplicate
- delete
- selection sync

### Pages/screens

- create page
- rename page
- duplicate page
- delete page
- reorder pages
- switch page
- define frame size
- persist page hierarchy

### Undo/redo

- command-based
- graph-aware
- server-safe
- covers create/update/move/resize/delete/reorder/duplicate
- conflict-aware

### Persistence

- every persistent edit writes the canonical graph
- graph and version draft remain consistent
- reload restores the design
- transient gestures do not masquerade as saved design
- save/saving/error/conflict states are explicit

---

## First Real Human Test

**Scenario:** Start with a blank CollabCanvas page and manually build a professional SaaS landing page.

Required sections:

- navigation
- logo/text
- hero
- image/photo
- CTA
- feature cards
- spacing
- typography
- colors
- footer

### Current outcome

#### Navigation

Not practically possible.

A designer could fake it with hidden local text and rectangles, but there is no persistent frame, layout, alignment, spacing, or component workflow.

#### Logo/text

Not practically possible.

Text can render and be edited transiently, but there is no visible insert control, no persistent content editing workflow, and no typography controls.

#### Hero

Not possible as a professional layout.

There is no frame creation, responsive frame size, stack layout, alignment, spacing, or image placement.

#### Image/photo

Impossible.

There is no upload, asset library, image rendering, fit behavior, crop, or persistence.

#### CTA

Not possible as a real button.

The graph has a `button` type and fixture component instance, but the UI cannot create or edit one. A designer could only fake it with transient rectangles/text.

#### Feature cards

Not possible professionally.

There is no grid, card insertion, component reuse, spacing, alignment, or consistent token styling.

#### Spacing

Not possible.

Spacing is graph metadata only.

#### Typography

Not possible.

Typography definitions exist in the fixture, but there are no human editing controls or token-driven rendering.

#### Colors

Only narrowly possible for existing token references.

There is no general color workflow.

#### Footer

Not possible professionally.

It could only be approximated with transient shapes and text.

#### Save/reload/continue editing

Fails for manually inserted content.

Local additions disappear after reload.

### Test verdict

The first real human test fails before a usable landing page can be produced. The current InvoiceFlow fixture is a graph/projection proof, not evidence that a human can manually design and save a professional interface.

---

## Readiness Scores

- **Human design editor readiness: 2/10**
  - Shell, graph hydration, selection, layer projection, semantic inspector, and one canonical resize path exist.
  - The core create/layout/style/asset/persistence workflow is missing.

- **DesignGraph readiness for editor: 6/10**
  - Rich schema and validation are promising.
  - Editor operations, multi-page modeling, assets, layout execution, component lifecycle, and runtime persistence consistency are incomplete.

- **Frontend readiness: 3/10**
  - Strong shell and projection boundaries.
  - No visible editor toolbar, no real property editing, split runtime/canonical state, and no responsive design preview.

- **Copilot readiness: 5/10**
  - Trusted context, version-bound proposals, validation, and approval flow are solid.
  - Only move/delete operations are supported, proposal UX state is lost, and there is no visual/semantic preview.

- **Agent/plugin readiness: 3/10**
  - Manifest, gateway, and synchronization concepts are tested.
  - Gateway is not wired into the actual API runtime, browser WebMCP is legacy board state, and there is no plugin integration layer.

---

## Bottom Line

Before CollabCanvas is ready to be exposed to ChatGPT, Claude Code, and Codex as a serious design environment, it must first become a real human editor.

The minimum required work is:

1. reliable runtime API and manifest/gateway wiring
2. blank project/page/graph creation
3. visible insert toolbar
4. canonical create/update/move/resize/delete/reorder commands
5. graph-aware undo/redo
6. layout rendering and layout controls
7. semantic inspector controls for content, typography, colors, spacing, and size
8. editable layers
9. real image upload and asset persistence
10. token-driven visual rendering
11. responsive viewport preview
12. WebMCP tools that mutate the same canonical graph as the human editor
13. hideable Copilot proposal UI that preserves state
14. consistent version/draft mutation enforcement

Today, CollabCanvas is best described as a strong design-context architecture and agent-handoff proof with an early graph-backed canvas shell. It is not yet a proper visual design editor.

---

## Audit Verification

- The application was opened and tested in a browser.
- Real pointer selection and drag were tested.
- Layer selection, inspector exposure, Assets, Design System, Versions, Agent Center, and Copilot navigation were tested.
- Local insertion, move, undo, reload persistence, and state loss were tested.
- WebMCP registration and a read-only board query were verified.
- `make check` passed:
  - 197 tests
  - typecheck
  - production build
- The build’s large-chunk warning was pre-existing.
- No repository source files were changed during the audit itself.
- No database schema was modified.
- No canonical DesignGraph mutation was performed.
