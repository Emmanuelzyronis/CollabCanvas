AGENTS.md — CollabCanvas

1. Mission

CollabCanvas is the design context layer for AI-built software.

The canvas is the interface.

The Design Graph is the canonical source of truth.

The Design Manifest is the deterministic machine-readable contract.

The Agent Gateway is the policy-enforcing bridge.

The version and proposal systems are the trust layer.

CollabCanvas is not intended to become a Figma/Canva clone.

The primary user is not a UI/UX designer: it is a builder who knows what they
want and cannot turn it into an interface. Both entry points — the human
drawing the design and the assistant drafting it from intent — must converge on
the same editable design state. See "docs/product-vision.md".

The primary product chain is:

Design
  ↓
Design Graph
  ↓
Manifest
  ↓
Agent
  ↓
Code
  ↓
Version
  ↓
Sync

The frontend is the human face of this architecture: a real visual design
environment built directly on the domain contracts, not a separate visual
system disconnected from the domain. The architecture itself stays invisible to
the user ("docs/product-vision.md").

---

2. Architectural Authority

The repository has three levels of architectural documentation.

"AGENTS.md"

This file is the repository-wide implementation constitution.

It defines:

- architectural invariants
- source-of-truth rules
- security boundaries
- version/proposal semantics
- agent boundaries
- WebMCP rules
- dependency rules
- testing requirements
- implementation workflow
- migration rules

"ARCHITECTURE.md"

"ARCHITECTURE.md" is authoritative for the overall system architecture.

It defines the relationship between:

- frontend
- application services
- domain
- Design Graph
- persistence
- Manifest Compiler
- Agent Gateway
- coding agents
- synchronization
- versioning

Do not contradict it without an explicit architectural decision.

"docs/product-vision.md"

"docs/product-vision.md" is authoritative for the intended product
experience. It defines what the human should feel while using CollabCanvas:
a visual design environment, not an engineering tool. The Design Graph,
versioning, WebMCP, Copilot, manifest, gateway, and agent infrastructure are
invisible infrastructure — the human sees only the design environment.
Implementation work must not expose graph, node-ID, version-ID, projection,
manifest, gateway, WebMCP, or agent-ecosystem vocabulary in human-facing
surfaces, and must not trade product usability for architectural
demonstrability.

"frontend-architecture.md"

"frontend-architecture.md" is authoritative for the frontend architecture and frontend implementation sequence.

It defines:

- frontend information architecture
- shell
- graph projection
- canvas
- selection
- layers
- inspector
- design system
- versions
- Copilot
- Agent Center
- responsive behavior
- frontend state ownership
- frontend component architecture
- frontend migration sequence

When implementing frontend work, follow "frontend-architecture.md".

Do not reinterpret the system-level implementation sequence in this file as the current frontend build sequence.

---

3. Current Implementation Position

The repository already contains substantial system infrastructure.

Do not restart completed system layers merely because the historical architecture describes them.

Before implementing anything:

1. Inspect the repository.
2. Inspect the existing implementation.
3. Identify which contracts already exist.
4. Determine the current frontend architecture stage.
5. Read the relevant section of "frontend-architecture.md".
6. Implement only the next required slice.

The current frontend migration has already established:

Frontend Foundation

Implemented and verified:

- semantic design tokens
- typography roles
- spacing/radius/elevation/motion tokens
- responsive breakpoint tokens
- primitive UI components
- accessibility focus behavior
- reduced-motion behavior

Application Shell

Implemented and verified:

- "AppShell"
- top bar
- left navigation panel
- right inspector panel
- status/context bar
- responsive shell behavior
- panel overlays
- shell layering and overflow containment
- existing canvas integration

These completed frontend foundations must not be rebuilt unnecessarily.

The next frontend architectural work should proceed from the graph-backed architecture defined by "frontend-architecture.md", beginning with the graph projection boundary.

The exact implementation status must always be verified against the repository before claiming a layer is complete.

---

3a. Current Execution Strategy (Human Editor First)

The current execution strategy is "Human Editor First" with "Fast Vertical
Slices". The product is the human's ability to design, not the architecture.
Do not interpret this repository as an agent-first implementation project.

- Immediate product objective: make CollabCanvas a usable visual design
  environment (frontend pages, flyers, logos) before expanding the agent
  ecosystem. The editor and the assistant are the same path, not competing
  ones: intent-first intake is in scope.
- The Design Graph, versioning, WebMCP, Copilot, manifest, gateway, and agent
  infrastructure exist to support the human editing experience; architecture
  work is only successful when it contributes to an executable human workflow
  (open → create → add → select → edit → save → reload → continue).
- Zustand/SVG remain runtime and projection infrastructure. Durable editor
  state must flow through the canonical editor command path
  (POST /api/v1/documents/:documentId/commands) with explicit base-version
  semantics; stale writes are conflicts, never silent overwrites.
- Copilot is hidden by default in the human editor and must never dominate
  the canvas. Do not expand Copilot/agent/gateway/WebMCP capabilities ahead of
  the human path they serve. Intent-first intake (a description becomes
  visible, editable design state) is part of that path and is in scope; agent
  plumbing, gateway surface and chat-window dominance are not.
- The current slice sequence (EMM-95 … EMM-101) and UI/UX direction are
  documented in "docs/execution-strategy.md". Read it before starting
  editor work and verify behavior in the browser, not just with tests.

---

4. Core Product Principle

A visual design must not be treated as a collection of pixels, arbitrary canvas coordinates, or React component state.

The canonical representation is a structured Design Graph.

The frontend renders and edits projections of that graph.

AI operates through structured design operations.

Coding agents consume a deterministic Design Manifest.

Approved design versions are immutable.

AI and external agents must not silently modify approved design state.

---

5. Canonical Architecture

The system must preserve this flow:

Human / AI Intent
       ↓
Frontend Interaction
       ↓
Feature Controller
       ↓
Application Command / Query
       ↓
Validated Design Graph Operation
       ↓
Canonical Design Graph
       ↓
Persistence / Versioning
       ↓
Projection Refresh
       ↓
Canvas / Inspector / Layers / Panels

For design-to-code:

Approved Design
       ↓
Deterministic Manifest
       ↓
Agent Gateway
       ↓
Coding Agent
       ↓
Implementation
       ↓
Implementation Status
       ↓
Sync Proposal
       ↓
Version / Approval Flow

Any implementation that bypasses these flows must be treated as an architectural violation.

---

6. Source of Truth

Canonical

Design Graph
    ↓
Design Manifest

The Design Graph is authoritative for design state.

The Manifest is a derived deterministic contract.

Non-canonical

The following must never become an alternate source of truth:

- Zustand state
- React component state
- SVG structures
- canvas coordinates
- DOM state
- generated HTML
- generated CSS
- screenshots
- AI responses
- component-local persistence
- URL state for persistent design data
- imported external design data

Runtime state may represent a projection or temporary interaction state.

It must not silently become persistent truth.

---

7. Frontend State Ownership

Frontend state belongs to one of three categories.

Server / domain state

Examples:

- projects
- pages
- nodes
- components
- tokens
- versions
- proposals
- design intent
- responsive constraints
- implementation status
- agent state

This state belongs to the backend/application/domain system.

URL state

Examples:

- current project
- current page
- selected node
- selected version
- active workspace surface

Example:

/projects/invoiceflow/pages/dashboard
/projects/invoiceflow/versions/9
/projects/invoiceflow/pages/dashboard?node=primary-button

Do not place ephemeral interaction state in URLs.

Local interaction state

Examples:

- hover
- drag position before commit
- pointer state
- resize handles
- open panel
- temporary input state
- keyboard interaction
- viewport presentation state

Local state is allowed.

It must not become an alternate persistence layer.

---

8. Design Graph Frontend Boundary

The frontend must introduce a clear projection boundary:

Design Graph DTO
      ↓
Graph Projection
      ↓
CanvasNodeModel
TreeNodeModel
InspectorModel
ResponsiveModel
AccessibilityModel
IntentModel
      ↓
React UI

Projection code may calculate:

- bounds
- coordinates
- layout measurements
- z-order
- hit regions
- derived dimensions
- selection geometry
- responsive presentation data
- visual state

Projection code must not invent persistent semantic meaning.

If a value affects the actual design model, it must come from or be written through the application/domain contract.

---

9. Canvas Rules

The canvas is a renderer and interaction surface.

It is not the database.

The canvas must:

- render graph projections
- resolve node identity
- support semantic selection
- support direct manipulation
- calculate temporary interaction state
- generate semantic deltas
- submit mutations through application commands
- reconcile against canonical graph state

A drag operation must conceptually follow:

Pointer Down
    ↓
Node ID
    ↓
Local Gesture State
    ↓
Temporary Projection
    ↓
Semantic Delta
    ↓
Application Command
    ↓
Domain Validation
    ↓
API
    ↓
Canonical Design Graph
    ↓
Projection Refresh
    ↓
Canvas Reconciliation

This is not acceptable:

Pointer Down
    ↓
setZustandPosition()
    ↓
done

Existing SVG/canvas infrastructure may be retained temporarily as a migration seam.

It must not become a permanent second architecture.

---

10. Selection Is First-Class

Selection must represent shared graph identity.

The same selected node must be understood by:

Canvas
  ↕
Layers Tree
  ↕
Inspector
  ↕
Copilot Context

Selection must reference stable graph identity.

Do not maintain independent incompatible selection models in different surfaces.

---

11. Layers / Document Tree

The Layers tree is a projection of Design Graph hierarchy.

It is not a second database.

Rows should be able to expose semantic information such as:

- node type
- human-readable name
- component status
- visibility
- lock state
- interaction state
- graph validation warnings

Do not create a parallel persistence model merely for the tree.

---

12. Inspector

The Inspector is a semantic editor, not a raw CSS/property dump.

Priority:

1. Semantic role
2. Content/component properties
3. Layout
4. Tokens
5. Responsive constraints
6. Accessibility
7. Interactions
8. Implementation metadata

Where possible, the inspector should explain why a value exists, not only expose raw implementation numbers.

All persistent inspector mutations must pass through application/domain operations.

---

13. Design System

The Design System UI is a graph-backed authoring surface.

It must represent:

- tokens
- typography
- components
- variants
- states
- templates
- design intent

Do not create a frontend-only design system database.

The design system UI must ultimately read and write through the canonical design model.

---

14. Versions and Trust

The version lifecycle is:

DRAFT
   ↓
VALIDATED
   ↓
PROPOSED
   ↓
APPROVED
   ↓
IMMUTABLE

Approved versions are read-only for destructive design mutation.

An approved version may be:

- inspected
- previewed
- compared
- used to create a new draft

A mutation against an approved version must create an appropriate proposal/change set or new draft according to domain rules.

Never silently modify approved state.

---

15. Semantic Diff

Version comparison must operate on semantic design state.

A diff should support:

- visual interpretation
- semantic interpretation
- affected resources
- changed nodes
- changed tokens
- changed components
- responsive changes
- accessibility changes
- design-intent changes

Screenshots alone are not sufficient.

---

16. Copilot

Copilot is a structured design-operation console, not a generic chatbot.

The lifecycle is:

User Request
    ↓
Context Build
    ↓
AI Plan
    ↓
Structured Operations
    ↓
Validation
    ↓
Preview
    ↓
Rationale
    ↓
Affected Resources
    ↓
Visual + Semantic Diff
    ↓
User Approval
    ↓
Application / Domain Operation
    ↓
Design Graph

AI must not silently mutate canonical design state.

AI should use the same mutation path as human-driven operations.

---

17. Agent Gateway

Agents must never receive unrestricted database access.

All agent access goes through the Agent Gateway.

The gateway enforces:

- identity
- project scope
- capabilities
- authorization
- version constraints
- auditability
- rate limits
- revocation

Capabilities include:

project.read
manifest.read
design.read
asset.read
proposal.create
proposal.read
implementation.write
sync.propose
version.read
webhook.manage

The frontend must never expose service-role credentials or agent secrets.

---

18. Manifest

The Design Manifest must be deterministic.

Equivalent Design Graph state must produce equivalent manifests.

It must contain enough information for an external coding agent to implement the intended interface without inspecting private database internals.

Manifest contents may include:

- design tokens
- typography
- pages
- components
- component anatomy
- variants
- props
- states
- layout hierarchy
- responsive constraints
- interactions
- accessibility
- assets
- design intent
- version/provenance

Never expose secrets in a manifest.

---

19. Proposal-First Mutations

AI-generated or externally generated mutations must be represented as proposals where required by the domain.

A proposal should contain:

- base version
- requested operation
- affected resources
- rationale
- generated changes
- validation result
- author/principal
- timestamps
- approval state

No external agent may silently modify approved design state.

---

20. Concurrency

Mutations must identify their base version where the domain requires it.

Reject or explicitly resolve stale writes.

Never silently overwrite newer design state.

Frontend optimistic UI is allowed.

Optimistic UI must never be treated as canonical truth.

---

21. API and Application Boundary

React components must not directly couple to persistence.

The dependency direction should remain conceptually:

UI
 ↓
Feature
 ↓
Application Commands / Queries
 ↓
Domain
 ↓
Infrastructure

Never:

React Component
 ↓
Database

or:

React Component
 ↓
Persistence Adapter

Application services own mutation semantics.

UI components should consume feature/application contracts.

Exact directory names may evolve, but dependency direction must not.

---

22. Frontend Directory Architecture

The frontend should converge toward a structure equivalent to:

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

The existing repository may differ.

Do not perform a giant directory rewrite merely to match this tree.

Move code when doing so creates a concrete architectural benefit.

---

23. Legacy UI Retirement Policy

This is a critical migration rule.

Existing legacy UI is not automatically protected merely because it currently works.

Preserve:

- domain contracts
- backend capabilities
- WebMCP behavior
- valid application behavior
- useful runtime infrastructure
- existing data
- stable integrations

Do not preserve obsolete presentation architecture merely for backward visual compatibility.

If legacy UI conflicts with the target frontend architecture:

1. identify the conflict
2. preserve the underlying capability
3. create the smallest migration seam required
4. implement the replacement architecture
5. migrate consumers
6. remove the obsolete UI
7. verify no required behavior was lost

Do not maintain two permanent competing UI architectures.

The old UI should not constrain the new design.

In particular:

- legacy toolbars are transitional
- legacy navigation is transitional
- legacy panel layouts are transitional
- legacy styling is transitional
- legacy canvas presentation is transitional where replaced by the new architecture

A compatibility adapter is acceptable during migration.

A compatibility adapter that becomes permanent without architectural justification is not.

---

24. Zustand and Existing SVG Architecture

Existing Zustand and SVG infrastructure may remain during migration.

Their role is:

Canonical Design Graph
        ↓
Graph Projection
        ↓
Canvas Adapter
        ↓
Existing Runtime / Renderer

Zustand may own runtime/editor concerns such as:

- viewport
- zoom
- camera
- temporary interaction state
- agent runtime state
- undo/redo runtime coordination where appropriate
- presentation state

Zustand must not become the canonical Design Graph.

SVG structures must not become the canonical Design Graph.

When the new graph-backed architecture replaces an old runtime path, remove the obsolete path rather than maintaining both indefinitely.

---

25. WebMCP

The existing WebMCP surface is a protected integration boundary.

Existing WebMCP tools must remain operational during frontend migration.

The browser-side model context registration must remain functional.

Existing tools must not be broken merely to reorganize frontend code.

WebMCP/MCP tools must not contain duplicated business logic.

They should route through the same application/domain contracts as other interfaces.

Domain-level tools include:

list_projects
get_project
get_manifest
get_page
get_component
get_tokens
get_asset
get_design_intent
compare_versions
propose_change
get_proposal
report_implementation_status
propose_sync

The current repository may expose additional tools.

Do not delete or silently alter existing tools without explicit architectural reason and verification.

---

26. Commands and Queries

Commands represent mutations.

Examples:

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

Queries represent reads.

Examples:

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

Names may evolve to match existing contracts.

The important rule is that persistent mutation semantics belong in application/domain operations, not React components.

---

27. Responsive Architecture

Responsive presentation may differ.

Domain semantics may not.

Target behavior:

Wide desktop

Navigation + Canvas + Inspector

Desktop

Reduced shell chrome while preserving workspace context.

Tablet

Collapsible navigation and contextual inspector.

Mobile

Focused single-surface workflow.

Responsive behavior must not create different underlying design meanings.

Do not duplicate domain state for mobile and desktop.

---

28. Panel Architecture

Reusable panel patterns include:

- side panel
- drawer
- bottom sheet
- modal
- popover
- command palette
- contextual toolbar

A panel should have:

- identity
- title
- context
- content
- actions
- dismissal behavior
- keyboard behavior
- responsive presentation

Panels should not become hidden persistence stores.

---

29. Interaction State Machine

Canvas interaction should be explicit.

Conceptually:

IDLE
 ↓
HOVER
 ↓
SELECTING
 ↓
DRAGGING
 ↓
VALIDATING
 ↓
COMMITTING
 ↓
RECONCILING

Other interaction states may include:

RESIZING
PANNING
EDITING
REVERTING

Temporary interaction state must not be mistaken for committed design state.

---

30. Error Model

Frontend errors must be expressed in product-level terms.

Recognized categories include:

- validation
- conflict
- permission
- network
- graph unavailable
- graph invalid
- version conflict
- agent unavailable
- unknown

Never expose raw database errors or stack traces as the primary user-facing error.

---

31. Major Surface States

Major product surfaces should explicitly account for:

LOADING
EMPTY
READY
SAVING
SAVED
ERROR
UNAVAILABLE
CONFLICT
READ_ONLY

Also distinguish:

- no data
- loading
- unavailable
- unauthorized
- invalid graph
- conflict

Do not fabricate partial graph data when the canonical graph cannot safely hydrate.

Graph availability should conceptually distinguish:

GRAPH_AVAILABLE
GRAPH_LOADING
GRAPH_UNAVAILABLE
GRAPH_INVALID

---

32. Accessibility

Accessibility is architectural, not a final polish pass.

Requirements include:

- keyboard operation
- visible focus
- screen-reader labels
- accessible dialogs/drawers
- reduced motion
- adequate target sizes
- color-independent state communication
- canvas alternatives
- semantic labels
- no keyboard traps
- graph-aware validation feedback

Do not make hover the only way to discover functionality.

Mobile interactions must not depend on hover.

---

33. Performance

Avoid unnecessary whole-canvas rerenders.

Where appropriate:

- separate viewport state from graph state
- memoize graph projections
- virtualize large layer trees
- use spatial indexing when justified
- maintain local drag state until commit
- batch semantic updates where valid
- avoid serializing the entire graph during every interaction
- lazy-load secondary panels
- measure interaction latency

Do not prematurely optimize without evidence.

---

34. Collaboration Readiness

Design entities should be capable of being associated with:

- stable node ID
- version context
- author/actor
- updated timestamp
- conflict state

Do not design frontend state in a way that assumes a single permanent user/editor.

---

35. Command Palette

The command surface should eventually support actions such as:

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

Do not build speculative commands before the underlying capability exists.

---

36. Feedback Hierarchy

Use the appropriate feedback surface.

Inline      → field validation
Contextual  → canvas / inspector feedback
Toast       → short-lived success
Banner      → persistent project/system state
Modal       → explicit decisions

Do not use toast notifications for critical decisions that require user understanding or approval.

---

37. Security

Treat the following as untrusted input:

- AI output
- imported design data
- agent-provided content
- external integration payloads
- user-supplied assets/content

Requirements:

- least privilege
- project-scoped credentials
- server-side authorization
- credential revocation
- secret management
- audit logs
- rate limiting
- capability checks
- no secrets in manifests
- no credentials in source control
- no agent secrets in client state
- sanitization of imported/untrusted content
- avoid leaking graph data through error messages

UI visibility is not permission enforcement.

Permissions must be enforced by the appropriate server/application boundary.

---

38. Testing Requirements

Every meaningful architectural layer requires verification.

Unit

Examples:

- token resolution
- graph projections
- selection reducers
- responsive decisions
- interaction state machines

Component

Examples:

- inspector
- panels
- navigation
- keyboard behavior
- major UI states

Contract

Examples:

- query payloads
- command payloads
- graph DTOs
- version contracts
- proposal contracts
- manifest contracts

Integration

Examples:

Graph
 ↓
Projection
 ↓
UI

and:

Command
 ↓
API
 ↓
Graph
 ↓
Projection

E2E

Critical path:

Create project
    ↓
Create page
    ↓
Create node
    ↓
Edit
    ↓
Create draft
    ↓
Approve
    ↓
Generate manifest
    ↓
Connect agent
    ↓
Report implementation
    ↓
Create next version
    ↓
Semantic diff
    ↓
Sync proposal

Visual regression

Important surfaces include:

- shell
- canvas selection
- inspector
- responsive modes
- version diff
- Copilot proposal preview

---

39. Observability

Where appropriate, instrument:

- project load
- graph hydration
- canvas first render
- interaction latency
- command success/failure
- graph validation failures
- version approval time
- Copilot generation time
- proposal acceptance
- agent connection failures
- manifest retrieval failures
- sync conflicts

Observability should help diagnose architectural failures, not merely infrastructure failures.

---

40. Flagship Proof — InvoiceFlow

The primary end-to-end demonstration is InvoiceFlow.

InvoiceFlow should prove:

1. Create project.
2. Define design system.
3. Create pages.
4. Create reusable components.
5. Define responsive behavior.
6. Define design intent.
7. Approve design version.
8. Generate deterministic manifest.
9. Connect coding agent.
10. Agent retrieves manifest.
11. Agent implements application.
12. Agent reports implementation.
13. User changes design.
14. New version is created.
15. System computes affected surfaces.
16. Agent receives sync proposal.
17. User approves.
18. Agent updates affected implementation.

The frontend should make this chain understandable to the user.

---

41. Do Not Build a Fake System

Do not use fake or mock Design Graph data as a substitute for an existing real contract.

Mocks are acceptable for:

- isolated unit tests
- component tests
- failure-state testing
- deterministic fixtures where a real service is intentionally unavailable

Mocks are not acceptable as a permanent substitute for:

- Design Graph
- Manifest
- Agent Gateway
- versioning
- proposals
- application commands
- real project state

If the real contract exists, use it.

If it does not exist, stop and identify the missing contract rather than silently inventing one.

---

42. Do Not Create Parallel Architectures

Avoid:

Old UI
   +
New UI
   +
Old state
   +
New state
   +
Old persistence
   +
New persistence

unless a temporary migration seam is explicitly required.

Migration seams must have an exit path.

Prefer:

Existing Contract
       ↓
Adapter / Boundary
       ↓
New Architecture

then remove the adapter when no longer needed.

---

43. Do Not Skip Ahead

Frontend implementation order is governed by:

"frontend-architecture.md"

The intended frontend sequence is approximately:

01  Tokens + visual language
02  Layout primitives
03  Shell
04  Responsive shell
05  Graph projection
06  Canvas shell
07  Selection + layer tree
08  Inspector
09  Real graph-backed editing
10  Version / approval UI
11  Semantic diff
12  Copilot proposal UI
13  Agent Center
14  Mobile optimization
15  Accessibility / performance
16  E2E + visual regression
17  Production readiness

This is the frontend sequence.

It does not replace or rewrite the overall system architecture.

Do not restart repository foundation, persistence, domain, Design Graph, Manifest, Gateway, or other system layers that already exist and are verified.

If a frontend task genuinely depends on a missing lower-level contract:

1. identify the missing dependency
2. inspect whether it already exists elsewhere
3. use the existing contract if available
4. implement only the minimum missing foundation if necessary
5. verify it
6. continue

Do not create speculative replacement infrastructure.

---

44. Legacy Migration Strategy

The frontend migration should follow this general seam:

Design Graph
     ↓
Graph Projection
     ↓
Canvas Adapter
     ↓
Existing Runtime / SVG / Zustand
     ↓
Existing UI

For writes:

Existing Gesture
     ↓
Canvas Adapter
     ↓
Application Command
     ↓
Design Graph
     ↓
Projection Refresh

As the new architecture becomes capable of replacing legacy surfaces:

Design Graph
     ↓
Graph Projection
     ↓
New Feature UI

The old presentation layer should then be removed.

Do not preserve obsolete UI indefinitely merely because it is easier than completing the migration.

---

45. Working Method for Codex / Agents

Before modifying code:

1. Inspect the repository structure.
2. Read "AGENTS.md".
3. Read "ARCHITECTURE.md" when system boundaries are relevant.
4. Read "frontend-architecture.md" for frontend work.
5. Inspect existing implementation.
6. Identify the current verified frontend stage.
7. Identify existing contracts.
8. Identify dependencies.
9. State the intended change.
10. Implement the smallest complete slice.
11. Avoid unrelated refactors.
12. Run relevant tests.
13. Run typecheck/build/lint where available.
14. Perform visual verification when the change affects UI.
15. Review the git diff.
16. Report exactly what changed, what was verified, and what remains.

Never assume an architectural component exists because documentation describes it.

Inspect the repository first.

Never rewrite working domain architecture merely to fit a preferred framework.

---

46. One Layer at a Time

A Codex task should normally implement one architectural layer/slice at a time.

Each task should have:

Scope

What is being implemented.

Non-goals

What must not be changed.

Dependencies

What existing contracts it consumes.

Acceptance criteria

What must be true when complete.

Verification

Which tests/checks must pass.

Do not combine unrelated frontend layers into a single implementation merely because they appear visually connected.

---

47. Definition of Done

A frontend architectural slice is not complete merely because the application compiles.

Before declaring it complete:

1. Implementation exists.
2. Relevant tests exist.
3. Tests pass.
4. Typecheck passes.
5. Build passes.
6. Lint passes if a lint script exists.
7. Relevant contracts are documented or reused correctly.
8. Error paths are handled.
9. Security boundaries remain intact.
10. No unrelated architecture was introduced.
11. Git diff has been reviewed.
12. Visual behavior has been checked when applicable.
13. Existing required WebMCP behavior remains operational.
14. No new hidden source of truth was introduced.
15. The next architectural slice can consume the result without bypassing the architecture.

A large build warning that already existed is not automatically a reason to block a layer, but it must not be ignored if the current change materially worsens it.

---

48. Final Frontend Definition of Done

The frontend architecture is successful when:

- the shell reflects project and version context
- the canvas is driven by graph projection
- selection uses graph identity
- the layer tree reflects graph hierarchy
- the inspector reads/writes through application operations
- tokens and components are graph-backed
- responsive preview reflects real constraints
- Copilot operates through structured graph context
- proposals can be previewed and approved
- approved versions are immutable
- semantic diffs are available
- Agent Center reflects real gateway state
- implementation status maps to design versions
- mobile behavior is intentional
- major states are explicit
- accessibility is first-class
- existing WebMCP tools remain operational
- Zustand/SVG remain runtime/projection infrastructure rather than canonical truth
- no hidden alternate source of truth exists
- the design → manifest → agent → implementation → sync chain is visible

---

49. System-Level Definition of Done

The complete product must preserve:

Human Design Intent
        ↓
Structured Design Graph
        ↓
Deterministic Manifest
        ↓
Policy-Enforced Agent Gateway
        ↓
Coding Agent
        ↓
Implementation
        ↓
Versioned Feedback
        ↓
Controlled Synchronization

If a proposed implementation bypasses this chain:

stop and reassess the architecture.

---

50. Non-Negotiable Rules

1. Design Graph is canonical.
2. Frontend state is never a second database.
3. Canvas is a projection and interaction surface.
4. Persistent mutations cross the application/domain boundary.
5. Approved designs are immutable.
6. AI uses proposal-first mutation semantics.
7. Responsive presentation may differ; domain semantics do not.
8. Inspector semantics come before raw implementation details.
9. Major application states are explicit.
10. WebMCP remains operational during migration.
11. No fake Design Graph becomes permanent once a real contract exists.
12. Frontend visibly connects design → manifest → agent → implementation → sync.
13. Legacy presentation may be retired when it obstructs the target architecture.
14. Migration adapters are temporary and must have an exit path.
15. Do not create parallel sources of truth.
16. Do not restart completed system layers without evidence that they are actually incomplete.
17. Frontend sequencing comes from "frontend-architecture.md".
18. System architecture comes from "ARCHITECTURE.md".
19. This file governs repository-wide architectural behavior.
20. When documentation and the actual repository disagree, inspect first and report the discrepancy rather than guessing.

51. Layer Execution Workflow

Each next-layer task follows this concise loop:

1. State the target layer and its non-goals.
2. Implement only that layer through existing contracts.
3. Run focused tests, `make check`, and applicable compilation/build checks.
4. Perform focused exit verification against the layer acceptance criteria.
5. If a defect is found, apply only surgical remediation for that defect.
6. Re-run the focused verification and required checks.
7. Advance to the next layer only in a subsequent task; never begin it in the same task.

Out-of-scope issues are recorded for later unless they block the current layer. A layer is complete only after its canonical boundary, error behavior, and required integration path have been verified.

---

Reference Documents

System Architecture

ARCHITECTURE.md

Authoritative for the overall CollabCanvas system.

Frontend Architecture

frontend-architecture.md

Authoritative for frontend structure, UX architecture, state ownership, migration strategy, and frontend implementation sequence.

This File

AGENTS.md

Repository-wide implementation constitution and Codex operating rules.
