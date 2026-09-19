# CollabCanvas — Product Vision

This document is authoritative for the intended product experience. It sits
above implementation convenience: `AGENTS.md`, `ARCHITECTURE.md` and
`frontend-architecture.md` describe how the system is built; this file
describes what the human is supposed to feel while using it.

The previous implementation work proved the architecture can support a visual
editor. The product target is narrower and more demanding than "a canvas with a
toolbar, layers panel, and inspector".

## 1. Who this is for, and what it promises

The primary user is not a UI/UX designer. It is a developer, founder or builder
who knows exactly what they want and cannot turn it into an interface.

They can describe it in words. They can sketch it badly on paper. They can get
a rough idea out of ChatGPT. What they cannot do is produce a real, working
frontend from that intent.

CollabCanvas is where that intent becomes real design:

```text
the human brings raw intent
        ↓
the assistant turns it into visible, selectable, editable design state
        ↓
the human changes anything they want, with full control
        ↓
the design is handed off to a coding agent and becomes the frontend
```

Two entry points, one design state. **Human-first** (build it yourself) and
**intent-first** (describe it, or bring it in from an AI conversation, then
refine it yourself) must converge on the same canonical design and the same
editing surfaces. An intent-first path that produces something the human cannot
then edit exactly as if they had drawn it themselves is a failure, not a
feature.

The unit of value is the pipeline — raw intent in, shipped frontend out — not
any individual canvas capability. A capability that "works" but that a
non-designer cannot use naturally is not finished.

### Output scope

CollabCanvas produces complete frontend builds end to end: pages, navigation,
heroes, sections, components, typography, spacing, color, layout and assets. It
also produces non-web visual artifacts — flyers/posters and logos — from the
same editor and the same canonical design representation.

One editor. One representation. Several output types. Never three separate
tools or three separate codebases.

None of the machinery that makes this possible (the Design Graph, node IDs,
versions, projections, manifests, gateways, WebMCP, agent runtimes) may appear
in a human-facing surface. It stays invisible — see section 3.

## 2. CollabCanvas is not a desktop editor

Do not optimize toward "a canvas with a toolbar, a layers panel, and an
inspector". That is only the shell of a design application.

The goal is a seamless visual design environment where a normal person can
create meaningful frontend UI. The user should feel that they are designing a
real interface. They should **not** feel that they are operating an engineering
tool.

## 3. The design graph is invisible infrastructure

The human user should never need to see or understand:

- the Design Graph
- graph nodes
- node IDs
- graph schemas
- command buses
- version IDs
- projections
- canonical mutations
- WebMCP
- agent gateways
- internal architecture

Those systems exist to make the product powerful. They are not the user
interface.

```text
HUMAN
  │
  ▼
VISUAL DESIGN ENVIRONMENT
  │
  ▼
CANONICAL DESIGN STATE
  │
  ├── AI
  ├── WEBMCP
  ├── AGENTS
  └── CODE GENERATION
```

The human sees only the first layer. The machine operates on the deeper layers.

## 4. The actual interaction model

Two equally valid entry points into the same design state.

**Human-first.** A user opens a blank design and builds it manually: frames,
sections, text, images, shapes, cards, buttons, arrangement, resizing, styling,
layout, refinement. The human remains completely in control.

**Intent-first (AI-assisted).** A user describes what they want — "Create a
modern SaaS landing page" — and the assistant drafts it inside the design
environment. The user can approve it, reject it, ask for changes, modify it
manually, select individual elements, and continue designing themselves.

Intent does not have to be typed into CollabCanvas. It can arrive from
elsewhere — a description written in a ChatGPT conversation, a plugin, or
another tool — as structured design intent rather than as a picture of a
design. Intent-first intake is a first-class path, and it must land in the same
editable design state as the human-first path: real elements, real layers,
everything the human could have drawn themselves.

A later intake path — a rough sketch or screenshot as input — is future work,
not current scope.

AI suggestions must become visible design state. They must not become an opaque
AI-generated page the human cannot meaningfully manipulate.

## 5. The critical rule about AI

AI cannot replace the design environment.

```text
Human designs → AI assists → Human evaluates → Human modifies → AI assists again
```

Not:

```text
User talks to AI → AI produces an inaccessible blob
```

The human must always have a meaningful visual representation of what AI is
proposing, and must be able to take control at any point.

## 6. Why the design graph exists

The architecture becomes valuable precisely because the design is represented
canonically.

```text
Human / AI
     ↓
Visual Design
     ↓
Canonical Design Representation
     ↓
Understandable Machine State
     ↓
Code Generation
     ↓
Software
```

This is what lets CollabCanvas bridge design tools and software engineering
tools.

## 7. Code handoff is a major part of the vision

A completed design should eventually be exportable to coding agents.

```text
CollabCanvas Design
       │
       ▼
Export / Handoff
       │
   ┌───┴────┐
   ▼        ▼
 Codex   Claude Code
   │        │
   └───┬────┘
       ▼
Frontend implementation
```

The point is not exporting an image. The system preserves enough structured
design intent — hierarchy, layout, typography, spacing, components, assets,
colors, dimensions, relationships, design intent — for a coding agent to build
the frontend. This is why the canonical representation matters.

This holds whether the design was drawn by hand or drafted by the assistant:
handoff reads the same canonical representation either way.

## 8. The long-term vision is larger

Future mediums may include frontend interfaces, 3D scenes, video, richer media,
and interactive experiences. **Do not build these now.** They are expansion
paths. The current objective is narrower: make 2D frontend UI design genuinely
good.

## 9. Current objective: portfolio readiness

We are not trying to finish the ultimate CollabCanvas. We are trying to reach a
strong, credible portfolio milestone that demonstrates:

1. **Human visual design** — a person can genuinely create frontend UI.
2. **AI assistance** — AI participates without taking control away from the human.
3. **Shared design state** — human and AI operate against the same representation.
4. **Verification** — changes persist, can be inspected, behave predictably.
5. **Engineering handoff** — the architecture clearly supports design → code.
6. **Intent-first intake** — a non-designer can arrive with an idea (their own,
   or one produced with another AI) and end up with an editable design they own.

The demonstration must show the pipeline end to end, not a feature tour: intent
in → real design → human edits it → export → working frontend out. It should
make those ideas obvious without requiring the visitor to understand the
architecture.

## 10. Functional is not product-ready

```text
"A button works."                     ≠ "A normal person understands what the
                                        button does and can use it naturally."

"A design node can be created."        ≠ "A person can naturally create part of
                                        a frontend interface."
```

The second standard is the one that matters.

## 11. Portfolio acceptance bar

```text
Blank canvas → Create desktop frame → Create navigation → Create hero →
Add heading → Add supporting text → Add CTA → Add image → Create feature cards →
Style and arrange → Ask AI for an improvement → Review AI proposal →
Approve / modify / reject → Continue manual editing → Save → Reload → Same design
```

then:

```text
DESIGN → EXPORT → CODEX / CLAUDE CODE → FRONTEND IMPLEMENTATION
```

The same bar applies when the human never drew the first frame:

```text
Raw intent → Describe it, or paste it in from an AI conversation →
Assistant drafts the design → Human selects and edits anything →
Assistant refines → Save → Reload → Same design →
Export → CODEX / CLAUDE CODE → FRONTEND IMPLEMENTATION
```

The first walkthrough proves the human can build. The second proves a
non-designer can arrive with intent and still end up owning an editable design.
Both end in the same export.

## 12. What not to build now

3D, video, multiplayer collaboration, advanced vector illustration, animation
systems, a plugin marketplace, enterprise permissions, a cloud asset
marketplace, advanced prototyping, or parity with Figma/Adobe. Those belong to
the future.

The current question is: can CollabCanvas become a genuinely useful bridge
between visual frontend design, human control, AI assistance, and software
generation? If yes, that is already a powerful portfolio project.

## Final principle

The product is **not** "a Design Graph with a UI".

The product is a visual design environment that lets humans and AI
collaboratively turn ideas into structured software designs, while the
complexity underneath remains invisible. The user does not need to know the
architecture exists — and does not need to be a designer. They only need to
know what they want.
