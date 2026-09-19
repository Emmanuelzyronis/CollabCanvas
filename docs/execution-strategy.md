# Execution Strategy — Human Editor First

This is the current execution/product strategy for CollabCanvas. Historical
architecture documents (`ARCHITECTURE.md`, `frontend-architecture.md`,
`AGENTS.md`, `docs/*.md`) remain authoritative for their domains; this file
sets the current priority and slice ordering for day-to-day work.

## Product vision alignment

`docs/product-vision.md` is authoritative for the intended product experience
and sits above this execution strategy. CollabCanvas is a visual design
environment, not a desktop editor and not an engineering tool: the Design
Graph, versions, projections, WebMCP, gateway and agent systems are invisible
infrastructure. Human-facing surfaces must never expose that vocabulary.

Concretely, for every slice:

- the primary user is not a UI/UX designer: it is a builder who knows what they
  want and cannot build it. Success is the pipeline — raw intent in, editable
  design, handoff out — not a feature checklist;
- the human sees design language (layers, elements, styles, assistant), never
  graph/node/version/projection/WebMCP/agent vocabulary;
- AI produces visible, selectable, editable design state — never an opaque blob
  the human cannot take control of;
- intent-first intake is in scope and first-class: a description (typed here or
  produced in another AI conversation) becomes visible, selectable, editable
  design through the same canonical path as human-drawn elements;
- a capability that "works" but that a normal person cannot use naturally is
  not finished;
- portfolio readiness means the story (design → AI assist → human control →
  export → code) is obvious without explaining the architecture.

`tests/product-language.test.ts` guards the human-facing surfaces against
architecture leakage.

## Strategy

**Human Editor First.** CollabCanvas must first become a real human visual
design editor. The primary product chain remains Design → DesignGraph →
Manifest → Agent → Code, but the human editing experience is the product
milestone. Do not complete agent/architecture layers in isolation.

**Fast Vertical Slices.** Build the smallest complete human workflow per
change: open → create → add element → select → move/resize → edit properties →
Layers → Inspector → save → reload → continue. Small implementations with
focused tests and browser proof beat large abstractions.

## Current objective

A human can open CollabCanvas and intuitively create and edit a design:

- **Website / frontend pages** — navigation, hero, heading, paragraph, image,
  CTA/button, cards, sections, footer, typography, colors, spacing, layout.
- **Flyers / posters** — custom canvas, text, images, shapes, backgrounds,
  positioning, alignment, layering.
- **Logos** — shapes, text, grouping, alignment, resizing, colors, strokes.

These are presets/templates over one coherent editor, never three separate
editors or codebases.

Every one of those outcomes must be reachable two ways — the human drawing it,
or the assistant drafting it from intent — and both must land in the same
editable design state.

## Direction statement

> CollabCanvas is being developed through fast vertical slices. The immediate
> priority is human editor usability rather than completing the agent
> ecosystem or architectural layers independently. DesignGraph, versioning,
> WebMCP, Copilot, manifest, and gateway capabilities must converge behind the
> human editor rather than delaying it.

Architecture work is successful only when it contributes to an executable
human editing workflow. Do not mark success by test count; the primary
evidence is a human actually designing something in the browser.

Keep separate: **architecture maturity ≠ product maturity ≠ portfolio
readiness ≠ production readiness**.

## Slice sequence

The product slice is the unit of progress. Current mapping to EMM issues:

```text
EMM-95  Blank workspace + canonical command path     (done: foundation)
EMM-96  Visible element insertion
EMM-97  Persistent canvas editing (move/resize/delete/duplicate/reorder)
EMM-98  Layout engine
EMM-99  Inspector + Layers
EMM-100 Assets + Typography + Tokens + Pages (Website/Flyer/Logo presets)
EMM-101 History + WebMCP + Copilot convergence
```

Product-first ordering used internally:

```text
1  Editor shell + blank state
2  Insert toolbar + real elements
3  Selection + move + resize + delete
4  Inspector + Layers
5  Images + assets
6  Layout + spacing + typography
7  Pages + Website/Flyer/Logo presets
8  Save/reload + history
9  Copilot containment + canonical convergence
10 Polish + portfolio-quality demo
```

### EMM-100 status

Assets, typography, tokens and preset start designs are implemented (see
`docs/visual-design-slice.md`, `docs/token-reference-editing.md`,
`docs/workspace-presets.md`). The remaining EMM-100 item is **Pages**.

Pages is not a frontend slice yet: the canonical DesignGraph is one page per
document (`graph.page`, and `CanvasGraphApplicationService.getWorkspaceGraph`
requires the requested page to equal `graph.page`). Supporting multiple pages
needs an explicit domain decision first — page-scoped graphs or a multi-page
aggregate. Until that decision exists, do not add a frontend-only page list or
a second page store.

## EMM-95 scope and state

EMM-95 established the foundation for the human editor slice. It is the
reference for the canonical mutation path the later slices build on.

- Reliable local runtime: Vite dev proxy to `npm run api`
  (`127.0.0.1:8787`, override `VITE_API_PROXY_TARGET`); no browser globals.
- Blank workspace: `POST /api/v1/workspaces` with presets
  `blank | website | flyer | logo` → Project + Document + Page + empty
  canonical DesignGraph + draft version. InvoiceFlow remains a demo fixture.
- Canonical editor command bus: `POST /api/v1/documents/:documentId/commands`
  supporting `create | update | move | resize | delete | reorder | duplicate`.
  One mutation path; Canvas/Layers/Inspector/Copilot/WebMCP converge on it.
- Version contract: every command names its base version; stale base →
  `VERSION_CONFLICT`; approved-version edits require a draft
  (`APPROVAL_REQUIRED` until one exists).
- First canonical node: blank page → one `heading` node via the command bus →
  DesignGraph mutation → persistence → Canvas/Layers/Inspector reconciliation
  → reload keeps the node.
- Zustand owns transient UI state only (selection, tool, hover, viewport);
  durable design state lives in the DesignGraph.

## UI/UX direction

The editor must not feel like an architecture demo. Keep graph terminology,
semantic internals, and agent/gateway details underneath the product.

- The default experience is a blank workspace with an approachable start
  screen (Blank canvas / Website / Flyer / Logo).
- The editor shows a visible toolbar (Select, Hand, Text, Heading, Box, Frame,
  Section, Button, Card, Fit) — hidden shortcuts are never the primary
  workflow.
- The canvas communicates "this is where I design": clear empty state,
  selection boxes, insertion feedback.
- Layers and Inspector are graph projections of the same canonical nodes.
- The assistant is reachable from the first screen and never dominates the
  canvas. Intent-first intake (describe it → editable design state) is
  first-class; a permanent chat window taking over the workspace is not. When
  hidden the editor stays fully functional; reopening preserves its state.
- Priority for every change: human usability > canonical state correctness >
  persistence > runtime reliability > architecture elegance > future agent
  capability.

## Rules that remain in force

- DesignGraph is the canonical design state; no hidden alternate source of
  truth.
- Persistent mutations cross the application/domain boundary through the
  editor command path.
- Approved versions are immutable; AI/external mutations stay proposal-first.
- WebMCP tools stay operational and route through the same domain contracts.
- Do not expand Copilot/agent/gateway/WebMCP capabilities ahead of the human
  path they serve. Intent-first intake is part of that path and is in scope;
  agent plumbing, gateway surface and chat-window dominance are not.
- Do not silently expand EMM-95/96-style slices into unrelated refactors;
  record the boundary and continue.
- Browser verification is required for UI-affecting work.

## Recent audit context

`docs/human-design-editor-audit.md` documents the audit that preceded this
strategy (the editor being read-heavy/architecture-centric, local-only canvas
mutations, non-canonical insert paths, read-only Layers/Inspector, and
always-visible Copilot). EMM-95 fixes the canonical skeleton; EMM-96+ build the
visible editor on it.
