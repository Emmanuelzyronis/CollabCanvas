# CollabCanvas Frontend Architecture
## Layered Product UI, Design System, Canvas Shell, Interaction Model, and Backend/Design Graph Integration

**Status:** Proposed implementation architecture  
**Scope:** Frontend only, grounded in the existing CollabCanvas architecture and Layers 1–15 implementation reality  
**Canonical backend model:** Design Graph  
**Frontend role:** interactive projection, authoring surface, visualization, and control plane — never the canonical source of design truth

---

## 0. Executive Decision

CollabCanvas should not receive a cosmetic “skin.” The frontend should be rebuilt as an **architectural twin of the Design Graph and application services**.

The key rule is:

```text
User intent
   |
   v
Frontend interaction
   |
   v
Feature/controller
   |
   v
Application/domain operation
   |
   v
Validated Design Graph
   |
   v
Persistence / versioning
   |
   v
Projection update
   |
   v
Canvas + Inspector + Panels
```

The browser must never promote Zustand, SVG structures, raw coordinates, or component-local UI state into the source of truth.

The frontend therefore has two responsibilities:

1. **Represent the Design Graph clearly enough for humans to design and inspect.**
2. **Invoke real domain/application operations so every meaningful change is backed by the canonical model.**

The result should feel less like a generic design editor and more like a **developer visual control plane**.

---

# 1. Product Experience Model

CollabCanvas has five primary frontend jobs:

1. **Orient** — tell the user where they are in a project and what version they are viewing.
2. **Design** — manipulate pages, nodes, components, tokens, layout, responsive constraints, assets, and intent.
3. **Inspect** — expose semantic meaning and implementation-relevant properties.
4. **Validate** — surface conflicts, invalid graph states, accessibility problems, and version/proposal boundaries.
5. **Handoff** — make approved design context understandable to Copilot and coding agents.

The primary experience loop is:

```text
OPEN PROJECT
    |
    v
PROJECT CONTEXT
    |
    +--> DESIGN SYSTEM
    |
    +--> PAGE / CANVAS
    |       |
    |       +--> SELECT NODE
    |       |      |
    |       |      +--> INSPECT
    |       |      +--> EDIT
    |       |      +--> PREVIEW
    |       |      +--> PROPOSE
    |       |
    |       +--> RESPONSIVE PREVIEW
    |
    +--> VERSION / DIFF
    |
    +--> COPILOT
    |
    +--> AGENT CENTER
```

Every major screen should answer:

> **What am I looking at? What is the current design state? What can I do next?**

---

# 2. Frontend Architecture Principles

### 2.1 Design Graph over pixels

Pixels are an output of the graph.

```text
DesignNode
  -> semantic properties
  -> layout constraints
  -> style/token references
  -> children
  -> interactions
  -> accessibility
  -> intent
```

The canvas renders that information. It does not own it.

### 2.2 Views compose; domain features own behavior

```text
App Shell
  -> Route/View
      -> Feature
          -> Domain entity projection
              -> UI primitive
```

A page should not directly contain database/API logic.

### 2.3 Three classes of frontend state

```text
SERVER STATE
  Design Graph, versions, projects, proposals
        |
        v
URL STATE
  project/page/version/node/filter
        |
        v
LOCAL INTERACTION STATE
  selection, viewport, panel openness, drag gesture
```

A value should have one authoritative home.

### 2.4 Optimistic UI is allowed; optimistic truth is not

The canvas may respond immediately to pointer movement, but persistence must reconcile through the application/domain boundary.

### 2.5 AI is a design-operation participant

Copilot does not bypass the same mutation path used by human actions.

```text
Human action --------\
                      > validated operation -> Design Graph
Copilot proposal ----/
```

---

# 3. Layer 1 — Application Shell

The shell is the stable frame around every project.

### Desktop

```text
+--------------------------------------------------------------------------------+
| Workspace | Project | Page breadcrumb              Search   Version   Copilot |
+-----------+--------------------------------------------------------------------+
|           |                                                                    |
| PROJECT   |                                                                    |
| NAV       |                         CANVAS / VIEWPORT                              |
|           |                                                                    |
| Overview  |                                                                    |
| Canvas    |                                                                    |
| Design    |                                                                    |
| Assets    |                                                                    |
| Versions  |                                                                    |
| Agents    |                                                                    |
|           |                                                                    |
| Settings  |                                                                    |
|           |                                                                    |
+-----------+------------------------------------------------------+-------------+
|           | status / selection / viewport / zoom                  | INSPECTOR    |
+-----------+------------------------------------------------------+-------------+
```

### Shell responsibilities

- workspace identity
- project identity
- page navigation
- current version state
- save/sync status
- global search
- Copilot entry
- Agent Center entry
- responsive navigation
- keyboard command surface

The shell should remain visually calm. The canvas is the dominant workspace.

---

# 4. Layer 2 — Navigation Architecture

Navigation is semantic, not feature-count driven.

## Primary project navigation

1. Overview
2. Canvas
3. Design System
4. Assets
5. Versions
6. Agent Center
7. Settings

### Canvas sub-navigation

```text
Project
  |
  +-- Pages
  |    +-- Dashboard
  |    +-- Settings
  |    +-- Login
  |
  +-- Components
  +-- Tokens
  +-- Typography
  +-- Assets
  +-- Templates
```

Navigation must reflect the Design Graph's conceptual model.

---

# 5. Layer 3 — Canvas Shell

The canvas is not merely an SVG surface. It is a **projection engine surrounded by semantic controls**.

## Canvas anatomy

```text
                 TOP CONTEXT BAR
+---------------------------------------------------------------+
| Page: Dashboard   Draft v9   [Preview] [Compare] [Copilot]  |
+---------------------------------------------------------------+
|                                                               |
|  TOOL RAIL       CANVAS VIEWPORT                    INSPECTOR |
|  +--------+       +--------------------------+      +-------+ |
|  | Select |       |                          |      | Node  | |
|  | Frame  |       |       ARTBOARD           |      |       | |
|  | Text   |       |                          |      | Props | |
|  | Comp   |       |                          |      | Layout| |
|  | Asset  |       |                          |      | Tokens| |
|  +--------+       +--------------------------+      | A11y  | |
|                                                       +-------+ |
+---------------------------------------------------------------+
| ZOOM | 100% | DEVICE | GRID | SNAP | UNDO | REDO | STATUS     |
+---------------------------------------------------------------+
```

### Canvas principles

- infinite workspace around finite design surfaces
- semantic selection
- visible hierarchy
- non-destructive editing
- keyboard-first interaction
- pointer and touch support
- stable zoom/pan behavior
- responsive preview as a first-class mode
- no hidden mutation outside domain operations

---

# 6. Layer 4 — Design Graph Projection

The frontend needs an explicit projection layer.

```text
Design Graph DTO
      |
      v
Graph Projection
      |
      +--> CanvasNodeModel
      +--> TreeNodeModel
      +--> InspectorModel
      +--> ResponsiveModel
      +--> AccessibilityModel
      +--> IntentModel
      |
      v
React UI
```

The projection adapts canonical graph data to rendering needs.

It may calculate:

- screen coordinates
- bounding boxes
- selection rectangles
- z-order
- hit-test regions
- derived layout measurements
- visual states

It must not invent persistent semantic meaning.

---

# 7. Layer 5 — Selection and Interaction Model

Selection is a first-class frontend subsystem.

## Selection states

```text
NONE
  |
  +--> HOVER
  |
  +--> SELECTED
          |
          +--> MULTI_SELECTED
          |
          +--> EDITING
          |
          +--> DRAGGING
          |
          +--> RESIZING
```

Selection should expose the same node identity everywhere:

```text
Canvas <-> Layers Tree <-> Inspector <-> Copilot Context
```

Selecting a node on canvas selects the corresponding Design Graph node.

Selecting it in the layer tree highlights the same canvas projection.

Copilot receives the selected node as structured context.

---

# 8. Layer 6 — Layers / Document Tree

The layer tree is the semantic bridge between the canvas and graph.

```text
Dashboard
├── Header
│   ├── Logo
│   └── Navigation
├── Main
│   ├── MetricGrid
│   │   ├── MetricCard
│   │   ├── MetricCard
│   │   └── MetricCard
│   └── InvoiceTable
└── Footer
```

Each row should show:

- semantic node type
- human-readable name
- component status
- visibility
- lock state
- interaction state
- graph validity warning where applicable

The tree should never become a separate hierarchy database.

---

# 9. Layer 7 — Inspector Architecture

The inspector is where the product becomes developer-oriented.

## Priority order

1. Semantic role
2. Content/component properties
3. Layout
4. Tokens
5. Responsive constraints
6. Accessibility
7. Interactions
8. Implementation metadata

### Inspector model

```text
Selected DesignNode
       |
       v
Inspector Controller
       |
       +--> Identity
       +--> Content
       +--> Layout
       +--> Appearance
       +--> Responsive
       +--> Accessibility
       +--> Interaction
       +--> Intent
       +--> Implementation
```

### Example

```text
BUTTON / PrimaryButton

Role
  Action

Content
  Label: "Pay invoice"

Component
  PrimaryButton
  Variant: Primary

Layout
  Width: Hug
  Height: 44
  Gap: 8

Tokens
  Surface: button.primary
  Text: button.primary.label
  Radius: control.md

Responsive
  Mobile: full-width
  Desktop: hug-content

Accessibility
  Accessible name: valid
  Keyboard: valid
```

The inspector should expose **why the value exists**, not merely its numeric value.

---

# 10. Layer 8 — Design System UI

The Design System is a graph-backed authoring surface, not a static style guide.

## Areas

```text
DESIGN SYSTEM
├── Tokens
│   ├── Color
│   ├── Spacing
│   ├── Radius
│   ├── Shadow
│   └── Motion
├── Typography
├── Components
│   ├── Components
│   ├── Variants
│   └── States
├── Templates
└── Design Intent
```

### Token editing

```text
UI value
   |
   v
Semantic token reference
   |
   v
Design Graph
   |
   v
Manifest
```

Raw values should be used sparingly. The UI should encourage semantic references.

---

# 11. Layer 9 — Visual Language

CollabCanvas should have a **developer-tool visual language**, not a design-suite imitation.

## Characteristics

- restrained
- information-dense but not noisy
- semantic
- precise
- calm
- high contrast where it communicates hierarchy
- minimal decorative chrome
- strong typography hierarchy
- consistent iconography
- clear state signaling

The visual language should communicate:

> **This is a control plane for intentional software design.**

Not:

> **This is a drawing application.**

---

# 12. Layer 10 — Design Tokens

The frontend design system itself should use tokens.

## Token hierarchy

```text
GLOBAL
  |
  +--> Semantic
          |
          +--> Component
```

### Global examples

```text
color.neutral.*
color.accent.*
space.1 ... space.12
radius.sm ... radius.xl
font.size.*
font.weight.*
shadow.*
motion.*
```

### Semantic examples

```text
surface.canvas
surface.panel
surface.elevated
text.primary
text.secondary
border.default
state.selected
state.warning
state.error
state.success
```

### Component examples

```text
button.primary.surface
button.primary.text
inspector.section.gap
canvas.selection.border
panel.header.height
```

The same token philosophy should eventually be expressible inside the Design Graph so CollabCanvas can design itself using its own model.

---

# 13. Layer 11 — Responsive Architecture

Responsive behavior must be structural, not a shrunken desktop UI.

## Breakpoint modes

| Mode | Primary behavior |
|---|---|
| Wide desktop | Full navigation + canvas + inspector |
| Desktop | Full shell, reduced chrome |
| Tablet | Collapsible navigation + contextual inspector |
| Mobile | Focused single-surface workflow |

### Desktop

```text
NAV | CANVAS | INSPECTOR
```

### Tablet

```text
NAV COLLAPSED | CANVAS | INSPECTOR DRAWER
```

### Mobile

```text
+-------------------------+
| Page / Version     ...  |
+-------------------------+
|                         |
|        CANVAS           |
|                         |
+-------------------------+
| Select | Layers | More  |
+-------------------------+
```

Mobile should not attempt to preserve every desktop panel simultaneously.

---

# 14. Layer 12 — Responsive Interaction Model

Responsive UI must preserve task continuity.

## Example: editing a node

Desktop:

```text
Select -> Inspector -> Change -> Save
```

Mobile:

```text
Select -> Bottom Sheet -> Change -> Apply
```

Same domain operation:

```text
updateNodeProperty(nodeId, property, value)
```

Different presentation.

This is critical: **responsive behavior changes presentation, not domain semantics.**

---

# 15. Layer 13 — Panel System

All secondary surfaces should use a common panel architecture.

Panel types:

- side panel
- drawer
- bottom sheet
- modal
- popover
- command palette
- contextual toolbar

### Panel contract

```text
Panel
├── identity
├── title
├── context
├── content
├── actions
├── dismissal
├── keyboard behavior
└── responsive presentation
```

A panel should never own persistent domain state independently.

---

# 16. Layer 14 — Copilot UI

Copilot should not be a generic chatbot bolted onto the right side.

It is a **structured design-operation console**.

## Desktop

```text
+-----------------------------------+
| Copilot                           |
| Context: Dashboard / Button      |
|-----------------------------------|
| What do you want to change?      |
|                                   |
| [ Make this hierarchy clearer ]  |
|                                   |
| Proposed operation                |
| 1. Increase heading contrast      |
| 2. Reduce card density            |
| 3. Adjust spacing token           |
|                                   |
| [Preview] [Reject] [Approve]      |
+-----------------------------------+
```

## Operation lifecycle

```text
REQUEST
  |
  v
CONTEXT BUILD
  |
  v
AI PLAN
  |
  v
STRUCTURED OPERATIONS
  |
  v
VALIDATION
  |
  v
PREVIEW
  |
  +--> RATIONALE
  +--> AFFECTED RESOURCES
  +--> VISUAL DIFF
  +--> SEMANTIC DIFF
  |
  v
APPROVAL
  |
  v
DOMAIN OPERATION
  |
  v
DESIGN GRAPH
```

No silent approved-design mutation.

---

# 17. Layer 15 — Version and Trust UI

Version state must be visible at all times.

### State model

```text
DRAFT
  |
  v
VALIDATED
  |
  v
PROPOSED
  |
  v
APPROVED
  |
  +--> IMMUTABLE
```

The UI should make the current state unmistakable.

Example:

```text
Dashboard
Version 9
APPROVED

Implementation
Synced with commit abc123

[Compare] [Create Draft]
```

For drafts:

```text
Dashboard
Draft v10

3 changes
2 affected components
1 accessibility warning

[Review] [Submit for approval]
```

---

# 18. Layer 16 — Semantic Diff UI

Traditional pixel diff is insufficient.

CollabCanvas needs two simultaneous views.

## Visual diff

```text
BEFORE                  AFTER
Button blue             Button teal
16px gap                12px gap
```

## Semantic diff

```text
PrimaryButton
  appearance.background
    token.button.primary
      -> token.button.accent

layout.gap
    16
      -> 12
```

The semantic diff is what enables safe design-to-code synchronization.

---

# 19. Layer 17 — Agent Center

Agent Center is part of the frontend control plane.

## Connection flow

```text
Project
  |
  v
Agent Center
  |
  v
Choose runtime
  |
  v
Capabilities
  |
  v
Credential
  |
  v
Test connection
  |
  v
Connected
```

Agent status should include:

- connected/disconnected
- last manifest retrieval
- implementation status
- last commit
- current design version
- current implementation version
- sync drift

---

# 20. Layer 18 — Backend Integration Boundary

The frontend must not directly couple components to persistence.

Recommended structure:

```text
src/
├── app/
│   └── routes
├── features/
│   ├── canvas/
│   ├── inspector/
│   ├── versions/
│   ├── copilot/
│   ├── agents/
│   └── design-system/
├── domain/
│   ├── design-graph/
│   ├── versions/
│   ├── proposals/
│   └── projects/
├── application/
│   ├── commands/
│   ├── queries/
│   └── projections/
├── infrastructure/
│   ├── api/
│   ├── websocket/
│   └── persistence-adapters/
├── ui/
│   ├── primitives/
│   ├── panels/
│   ├── navigation/
│   └── feedback/
└── canvas/
    ├── renderer/
    ├── viewport/
    ├── hit-testing/
    └── projection/
```

The exact directory names may change. The dependency direction must not.

---

# 21. Layer 19 — Command / Query Model

Frontend actions should map to explicit operations.

### Commands

```text
createNode
updateNode
moveNode
deleteNode
updateToken
createComponentVariant
setResponsiveConstraint
setDesignIntent
createDraft
submitForApproval
approveVersion
createProposal
approveProposal
```

### Queries

```text
getProject
getPage
getDesignGraph
getNode
getTokens
getComponents
getVersion
getDiff
getManifest
getImplementationStatus
```

The canvas should not invent ad-hoc API calls.

---

# 22. Layer 20 — Interaction State Machine

Canvas gestures should have explicit state.

```text
IDLE
 |
 +--> HOVER
 |
 +--> SELECTING
 |
 +--> DRAGGING
 |      |
 |      +--> VALIDATING
 |      +--> COMMITTING
 |      +--> REVERTING
 |
 +--> RESIZING
 |
 +--> PANNING
 |
 +--> EDITING
```

A pointer gesture may be local and continuous, but the final semantic state transition must pass through the domain/application boundary.

---

# 23. Layer 21 — Error and Recovery Model

Errors must be understandable at the point of action.

## Categories

```text
Validation error
Conflict
Permission denied
Network failure
Graph unavailable
Version conflict
Agent unavailable
Unknown failure
```

Example:

```text
Couldn't save this move.

The selected node changed on another client.

[Review change] [Keep mine] [Cancel]
```

Never show raw database or stack-trace errors to users.

---

# 24. Layer 22 — Loading and Empty States

Every major surface needs explicit states:

```text
LOADING
EMPTY
READY
SAVING
SAVED
ERROR
UNAVAILABLE
CONFLICT
READ_ONLY
```

The frontend must never confuse:

- no data
- data unavailable
- loading
- unauthorized
- invalid graph

This matters especially because the backend intentionally refuses to fabricate partial graph/Manifest data when richer hydration is unavailable.

---

# 25. Layer 23 — Accessibility

Accessibility metadata is already part of the Design Graph, so the frontend must expose it.

Requirements:

- keyboard navigation
- visible focus
- screen-reader labels
- logical heading structure
- accessible dialogs/drawers
- reduced-motion support
- minimum interactive target sizes
- color-independent state communication
- canvas alternatives where required
- inspector fields with explicit labels
- no keyboard trap

Accessibility warnings should appear as graph-aware validation feedback, not only as frontend linting.

---

# 26. Layer 24 — Performance Architecture

The canvas is the highest-risk rendering surface.

Performance rules:

1. Do not re-render the whole canvas for a local selection change.
2. Separate viewport state from graph state.
3. Memoize graph projections.
4. Virtualize large layer trees.
5. Use spatial indexing/hit-testing when necessary.
6. Keep drag interaction local until commit.
7. Batch semantic updates where the domain contract allows.
8. Avoid serializing the entire graph for every interaction.
9. Lazy-load secondary panels.
10. Measure interaction latency, not only page-load metrics.

Target mental model:

```text
Pointer movement
   |
   v
local viewport/gesture update
   |
   v
60fps visual feedback
   |
   v
semantic commit
   |
   v
graph persistence
```

---

# 27. Layer 25 — Collaboration Readiness

Even if advanced multiplayer is deferred, the frontend architecture should avoid assumptions that make collaboration impossible.

Every meaningful projection should have:

- node ID
- version context
- author/actor context
- updated timestamp where available
- conflict state

Presence can later be added around the same identity model.

---

# 28. Layer 26 — URL and Deep-Link State

URLs should encode durable navigation context.

Example:

```text
/projects/invoiceflow/pages/dashboard
/projects/invoiceflow/pages/dashboard?node=primary-button
/projects/invoiceflow/pages/dashboard?version=9
/projects/invoiceflow/versions/9
```

Do not encode ephemeral drag state in the URL.

---

# 29. Layer 27 — Command Palette

The command palette becomes the keyboard control plane.

Examples:

```text
Open page
Select component
Find token
Create component
Duplicate node
Create draft
Compare versions
Open Copilot
Open Agent Center
Preview mobile
Fit canvas
Zoom to selection
```

Commands should invoke the same application actions as buttons.

---

# 30. Layer 28 — Notifications and System Feedback

Use a consistent feedback hierarchy.

### Inline
Validation and field-level problems.

### Contextual
Canvas/inspector state.

### Toast
Short-lived successful operations.

### Banner
Persistent project/system conditions.

### Modal
Decisions that cannot safely be inferred.

Do not turn every action into a toast.

---

# 31. Layer 29 — Frontend-to-Graph Runtime Diagram

```text
                         COLLABCANVAS FRONTEND
+-------------------------------------------------------------------+
|                         APPLICATION SHELL                         |
|                                                                   |
|  Navigation     Canvas Workspace       Inspector    Copilot       |
|                     |                    |             |           |
+---------------------+--------------------+-------------+-----------+
                      |
                      v
               FEATURE CONTROLLERS
                      |
                      v
              APPLICATION CLIENT
               /             \
              /               \
       Queries                 Commands
          |                       |
          v                       v
   Projection Cache       Domain Operation
          |                       |
          |                       v
          |                Agent/Gateway/API
          |                       |
          |                       v
          +--------------> DESIGN GRAPH
                                  |
                         +--------+--------+
                         |                 |
                         v                 v
                    PostgreSQL        Version System
                         |
                         v
                    Manifest/API
                         |
                         v
                    Agent Gateway
```

---

# 32. Layer 30 — Canonical Boundary With Existing Zustand/SVG

The current 33 WebMCP browser tools and Zustand/SVG editor are preserved during migration.

The new architecture must wrap them, not silently redefine them as canonical.

```text
                    DESIGN GRAPH
                         |
                         v
                 GRAPH PROJECTION
                         |
                         v
                 CANVAS ADAPTER
                         |
                         v
                 Zustand / SVG
                         |
                         v
                  Existing UI
```

For writes:

```text
Existing gesture
      |
      v
Canvas adapter
      |
      v
Application command
      |
      v
Design Graph
      |
      v
Projection refresh
```

This is the migration seam.

---

# 33. Layer 31 — Frontend Testing Architecture

Testing must follow the architecture.

## Unit

- token resolution
- projection functions
- selection reducer
- responsive layout decisions
- interaction state machines

## Component

- inspector behavior
- panel behavior
- keyboard navigation
- empty/error states

## Contract

- frontend query/command payloads
- Design Graph DTOs
- version/proposal contracts
- Manifest contracts

## Integration

- graph -> projection -> UI
- command -> API -> graph -> projection

## E2E

Critical journeys:

```text
Create project
 -> create page
 -> create node
 -> edit node
 -> save draft
 -> approve version
 -> retrieve manifest
 -> connect agent
 -> report implementation
 -> create next version
 -> semantic diff
 -> sync proposal
```

## Visual regression

Use only where visual stability has high product value:

- shell
- canvas selection
- inspector
- responsive modes
- version diff
- Copilot proposal preview

---

# 34. Layer 32 — Observability

Frontend telemetry should map to product operations.

Track:

- project load duration
- graph hydration duration
- canvas first render
- interaction latency
- command success/failure
- graph validation failures
- version approval time
- Copilot proposal generation time
- proposal acceptance
- agent connection failures
- manifest retrieval failures
- sync conflicts

The goal is to understand **where design work breaks**, not merely whether JavaScript threw an exception.

---

# 35. Layer 33 — Security

Frontend security boundaries:

- never expose service-role credentials
- never trust client-side project IDs for authorization
- never treat UI visibility as permission enforcement
- never embed agent secrets in client state
- sanitize imported/untrusted content
- use server-side capability checks
- avoid leaking graph data through error messages
- clear sensitive transient state where appropriate

The frontend is a client of the security boundary, not the security boundary itself.

---

# 36. Layer 34 — Design-System Component Inventory

Build in this order.

### Foundation

- Typography
- Icon
- Stack
- Inline
- Grid
- Divider
- ScrollArea

### Controls

- Button
- IconButton
- Input
- Select
- Checkbox
- Switch
- SegmentedControl

### Surfaces

- Panel
- Card
- Dialog
- Drawer
- BottomSheet
- Popover
- Tooltip

### Feedback

- Badge
- Status
- Alert
- Toast
- Skeleton
- EmptyState
- ErrorState

### Product-specific

- ProjectSwitcher
- PageTree
- LayerTree
- CanvasToolbar
- SelectionOverlay
- Inspector
- TokenEditor
- VersionBadge
- DiffViewer
- ProposalCard
- AgentStatus
- CopilotPanel

Do not build all components speculatively. Extract reusable APIs from real product usage.

---

# 37. Layer 35 — Frontend Folder Architecture

Recommended implementation shape:

```text
src/
├── app/
├── features/
│   ├── project/
│   ├── canvas/
│   ├── inspector/
│   ├── design-system/
│   ├── versions/
│   ├── copilot/
│   └── agents/
├── graph/
│   ├── types/
│   ├── projections/
│   ├── selectors/
│   └── adapters/
├── application/
│   ├── commands/
│   ├── queries/
│   └── workflows/
├── api/
│   ├── client/
│   └── contracts/
├── ui/
│   ├── primitives/
│   ├── layout/
│   ├── overlays/
│   └── feedback/
├── canvas/
│   ├── viewport/
│   ├── renderer/
│   ├── interaction/
│   └── selection/
└── styles/
    ├── tokens.css
    └── globals.css
```

---

# 38. Layer 36 — Data Flow for a Human Edit

Example: moving a button.

```text
1. Pointer down
2. Canvas identifies node ID
3. Local gesture state begins
4. Pointer moves update local projection
5. Pointer up produces semantic delta
6. Application command: moveNode(...)
7. Domain validates hierarchy/constraints
8. API persists Design Graph
9. Server returns canonical result
10. Projection updates
11. Canvas reconciles
12. Inspector reflects canonical position
13. Audit/version state updates
```

The frontend should never make step 8 equivalent to “set Zustand state and call it done.”

---

# 39. Layer 37 — Data Flow for Copilot

```text
User request
   |
   v
Copilot UI
   |
   v
Context Builder
   |
   +--> selected node
   +--> page
   +--> relevant components
   +--> tokens
   +--> intent
   +--> current version
   |
   v
AI provider
   |
   v
Structured operations
   |
   v
Validator
   |
   v
Proposal
   |
   v
Preview
   |
   v
User approval
   |
   v
Application command
   |
   v
Design Graph
```

---

# 40. Layer 38 — Design-to-Code Handoff

The frontend should make the handoff state legible.

```text
DESIGN
Version 8 APPROVED
        |
        v
MANIFEST
Deterministic
        |
        v
AGENT
Connected
        |
        v
IMPLEMENTATION
Commit abc123
        |
        v
SYNC
Version 9 affects:
- PrimaryButton
- CheckoutHeader
```

The user should be able to answer:

> “What does the agent currently know, and is the implementation aligned with the approved design?”

without leaving CollabCanvas.

---

# 41. Layer 39 — Responsive Product Matrix

| Capability | Desktop | Tablet | Mobile |
|---|---|---|---|
| Canvas | Full | Full | Focused |
| Inspector | Persistent | Drawer | Bottom sheet |
| Layer tree | Persistent | Drawer | Sheet |
| Navigation | Sidebar | Collapsible | Bottom nav |
| Copilot | Side panel | Drawer | Full screen |
| Version controls | Header | Header | Context menu |
| Command palette | Full | Full | Full |
| Multi-select | Yes | Yes | Limited/optimized |
| Drag editing | Yes | Yes | Touch optimized |
| Fine numeric editing | Direct | Panel | Sheet |

---

# 42. Layer 40 — Visual Hierarchy Rules

The UI should have three levels.

### Level 1 — Workspace

Canvas and current task.

### Level 2 — Context

Inspector, layers, responsive preview, Copilot.

### Level 3 — System

Version state, project state, agent state, warnings.

The UI should avoid making Level 3 louder than Level 1.

---

# 43. Layer 41 — Motion Language

Motion exists to communicate state.

Use:

- short transitions for panels
- subtle selection transitions
- direct manipulation during drag
- restrained modal transitions
- no decorative animation in the core editor
- reduced-motion alternative

Motion should answer:

> What just changed?

not:

> Look at this animation.

---

# 44. Layer 42 — Mobile Touch Model

Touch interactions need explicit targets.

Primary mobile actions:

```text
Select
Move
Inspect
Edit
Undo
Redo
Preview
Copilot
```

Secondary actions move into contextual sheets.

Avoid hover-dependent controls.

---

# 45. Layer 43 — Read-Only and Approval States

Approved versions should be visually and behaviorally distinct.

```text
APPROVED VERSION
  |
  +--> inspect
  +--> preview
  +--> compare
  +--> create draft
  |
  X direct destructive editing
```

The UI must make illegal actions impossible or clearly explain why they are unavailable.

---

# 46. Layer 44 — Graph Availability Boundary

Because richer PostgreSQL hydration is not yet complete, the frontend needs an honest state:

```text
GRAPH_AVAILABLE
GRAPH_LOADING
GRAPH_UNAVAILABLE
GRAPH_INVALID
```

If the graph cannot be safely hydrated:

```text
Design context unavailable

CollabCanvas cannot safely render or edit this project
because the canonical Design Graph is incomplete.

[Retry] [View status]
```

Never fabricate a partial graph and make it look authoritative.

---

# 47. Layer 45 — Implementation Sequence

The frontend rebuild should happen in vertical layers.

### Stage A — Foundation

1. Token system
2. Typography
3. UI primitives
4. layout primitives
5. shell
6. responsive navigation

### Stage B — Graph-backed workspace

7. project/page context
8. graph projection
9. canvas shell
10. selection
11. layers tree
12. inspector

### Stage C — Real editing

13. move
14. resize
15. property editing
16. token references
17. responsive constraints
18. undo/redo

### Stage D — Trust surfaces

19. draft state
20. approval state
21. version comparison
22. semantic diff
23. proposal preview

### Stage E — Intelligence

24. Copilot
25. structured operations
26. rationale
27. selective approval

### Stage F — Agent control plane

28. Agent Center
29. manifest status
30. implementation status
31. commit traceability
32. sync proposals

### Stage G — Production hardening

33. accessibility
34. performance
35. visual regression
36. E2E
37. telemetry
38. resilience
39. security review

---

# 48. Layer 46 — Definition of Done

The frontend architecture is successfully implemented when:

- the shell reflects project/version state
- canvas renders from Design Graph projection
- selection is graph-identity based
- inspector reads/writes through application operations
- layer tree reflects graph hierarchy
- tokens and components are graph-backed
- responsive preview uses real constraints
- Copilot uses structured graph context
- proposals are previewable and approval-gated
- approved versions are visibly immutable
- semantic diffs are understandable
- Agent Center reflects real gateway state
- implementation status maps to design versions
- mobile is intentionally designed, not merely compressed
- loading/error/conflict states are explicit
- accessibility is first-class
- existing 33 WebMCP tools remain operational during migration
- Zustand/SVG remains projection/runtime state
- no frontend component becomes a hidden alternate source of truth

---

# 49. Final Architecture Diagram

```text
                         HUMAN / AI USER
                                |
                                v
                    +-----------------------+
                    |   COLLABCANVAS UI     |
                    |-----------------------|
                    | Shell                 |
                    | Canvas                |
                    | Layers                |
                    | Inspector             |
                    | Design System         |
                    | Versions              |
                    | Copilot               |
                    | Agent Center          |
                    +-----------+-----------+
                                |
                                v
                    +-----------------------+
                    | FRONTEND APPLICATION  |
                    |-----------------------|
                    | Feature controllers   |
                    | Commands / Queries    |
                    | UI state              |
                    | Graph projections     |
                    +-----------+-----------+
                                |
                                v
                    +-----------------------+
                    | APPLICATION SERVICES  |
                    |-----------------------|
                    | validated operations  |
                    | permissions           |
                    | proposals             |
                    | version semantics     |
                    +-----------+-----------+
                                |
                                v
                    +-----------------------+
                    |    DESIGN GRAPH        |
                    |   CANONICAL TRUTH      |
                    +-----------+-----------+
                                |
              +----------------+----------------+
              |                                 |
              v                                 v
       PostgreSQL / Storage              Manifest Compiler
                                                |
                                                v
                                         Agent Gateway
                                                |
                                                v
                                      Coding Agents / AI
                                                |
                                                v
                                        Implementation
                                                |
                                                v
                                         Sync Proposal
                                                |
                                                +----> back to
                                                       version flow
```

---

# 50. Architectural Non-Negotiables

1. **Design Graph remains canonical.**
2. **Frontend state is never a second database.**
3. **Canvas is a projection and interaction surface.**
4. **All persistent mutations cross application/domain boundaries.**
5. **Approved designs are immutable.**
6. **AI mutations are proposal-first.**
7. **Responsive layouts share semantics, not necessarily presentation.**
8. **The Inspector explains semantic meaning before raw implementation detail.**
9. **Every major interaction has loading, success, error, unavailable, and conflict states.**
10. **Existing WebMCP tools are migrated incrementally through the explicit canvas boundary.**
11. **No frontend redesign should depend on fake/mock graph data once the real backend contract exists.**
12. **The frontend must make the design → manifest → agent → implementation → sync loop visible.**

---

# 51. Immediate Build Order

The next implementation sequence should therefore be:

```text
01  Frontend tokens + visual language
02  Layout primitives
03  Application shell
04  Responsive shell
05  Graph projection layer
06  Canvas shell
07  Selection + layer tree
08  Inspector
09  Real graph-backed editing
10  Version/approval UI
11  Semantic diff
12  Copilot proposal UI
13  Agent Center
14  Mobile optimization
15  Accessibility/performance
16  E2E + visual regression
17  Production readiness
```

**Important:** this is not a request to rewrite the backend. It is the frontend architecture that sits on top of the Layers 1–15 foundation already implemented.

