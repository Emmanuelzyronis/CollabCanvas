# 🎨 CollabCanvas

**A real-time collaborative infinite canvas where a human and their AI agent work the same live board — through [WebMCP](https://openai.com/webmcp-challenge/).**

You draw, arrange, and comment. Your agent — **Aria** — creates shapes, generates whole layouts from a sentence, restyles selections, tidies the board, answers questions about what's on it, and exports it. Both of you act on the *same* document, in real time, each with your own colored identity. No screen-sharing, no copy-paste, no "let me regenerate the whole thing" — just two collaborators on one canvas.

> Built for the **OpenAI WebMCP Challenge**. Every capability the UI has, the agent has too — because they call the exact same code.

---

## 🧭 Current strategy — Human Editor First

CollabCanvas is being developed through **fast vertical slices**. The
immediate priority is **human editor usability** rather than completing the
agent ecosystem or architectural layers independently. DesignGraph,
versioning, WebMCP, Copilot, manifest, and gateway capabilities must converge
behind the human editor rather than delaying it.

- **Strategy** — Human Editor First
- **Execution model** — Fast Vertical Slices
- **Immediate objective** — Make CollabCanvas a usable visual design editor
  before expanding the agent ecosystem.
- **Design targets** — frontend/web pages, flyers/posters, and logos over one
  coherent editor with preset document start points.
- **Engineering principle** — Architecture exists to support the human editing
  experience; it is not the product milestone by itself. Architecture work is
  only considered successful when it contributes to an executable human
  editing workflow (open → create → add → select → edit → save → reload →
  continue).

Current slice sequence (internally EMM issues; the product slice is the unit
of progress):

```text
EMM-95  Blank workspace + canonical command path  (this slice)
EMM-96  Visible element insertion
EMM-97  Persistent canvas editing (move/resize/delete/duplicate/reorder)
EMM-98  Layout engine
EMM-99  Inspector + Layers
EMM-100 Assets + Typography + Tokens + Pages (Website/Flyer/Logo presets)  (preset start designs: this slice)
EMM-101 History + WebMCP + Copilot convergence
```

Product acceptance direction:

> The product is not the DesignGraph. The product is a human's ability to
> design. Build what the human sees and uses first; make the architecture
> support it; move vertically; move fast.

The near-term acceptance test is a new human opening CollabCanvas, choosing a
blank/preset start, adding and editing elements, seeing them in Layers and the
Inspector, saving, reloading, and continuing — without needing Copilot, an
agent, WebMCP, or implementation knowledge.

Keep separate: **architecture maturity ≠ product maturity ≠ portfolio
readiness ≠ production readiness**. See
[`docs/execution-strategy.md`](docs/execution-strategy.md) for the full
strategy.

---

## ✨ Why this is different

Most "AI + canvas" demos bolt a chatbot onto a drawing app: the model spits out an image or a blob of JSON and you take it or leave it. CollabCanvas is built the other way around.

- **One board, two authors.** The human and the agent are peers on a shared infinite canvas. Every element records who made it, and the agent has a live, animated cursor and presence chip so you can *see* it working.
- **WebMCP-native.** The page publishes **33 tools** on `document.modelContext`. Any WebMCP-aware agent — ChatGPT's in-app browser, a WebMCP-flagged Chrome, or the built-in Aria console — discovers and drives them automatically. The agent isn't scripted against a hidden API; it uses the same public tool surface anyone can inspect.
- **Symmetric architecture.** There is no separate "agent path." A WebMCP tool call and a button click both invoke the *same* Zustand store action, tagged with `author: 'agent' | 'human'`. That's why the agent can never do something the human can't, and vice-versa — and why undo/redo, styling, and history work identically for both.
- **The human stays in control.** The agent proposes and builds; you edit, undo, or clear anything. Say *"clear the board"* and start fresh.

---

## 🚀 Live demo

**▶️ Try it:** https://salmon-sea-0f045f10f.6.azurestaticapps.net

The board seeds a short welcome scene on first visit so the collaboration model is obvious the moment it loads. Open the **Aria** console (bottom-right) and type a request, or hit **Connect** (top bar) to see how to drive it from an external agent.

### Run it locally

```bash
npm install
npm run api          # API on http://localhost:8787 (needs DATABASE_URL)
npm run dev          # → http://localhost:5173
```

Vite proxies `/api`, `/healthz`, and `/readyz` to the API (`127.0.0.1:8787` by
default; override with `VITE_API_PROXY_TARGET` if the API runs elsewhere).
Load `.env.local` into the API process (`set -a; source .env.local; set +a`)
so it can reach PostgreSQL. Without the API, the editor shows a clear
`GRAPH_UNAVAILABLE`/network message instead of failing silently.

```bash
npm run build        # type-check + production build → dist/
npm run preview      # serve the production build locally
npm test              # run the server/domain test suite
```

Requires Node 18+.

---

## 🤝 How the human and agent share the board

| The human does… | Aria (the agent) does… |
| --- | --- |
| Draw shapes, text, sticky notes, frames | Create the same elements via WebMCP tools |
| Drag, resize, restyle, group | `arrange_grid`, `align_elements`, `set_style`, `group_elements` |
| Sketch a rough idea | `generate_layout` — flowcharts, kanban, mind maps, grids, timelines, org charts from one line |
| Ask "what's on here?" | `summarize_board` — reads the canvas back to you |
| Want it out of the app | `export_svg` / `export_png` / `export_json` |
| Stay in control — undo, edit, clear | Signs its work, keeps a colored cursor + presence, logs every action to the shared activity feed |

Everything both parties do streams into a **live activity feed** in the Aria console, color-coded by author (violet = agent, blue = human), so the collaboration is legible at a glance.

---

## 🧰 WebMCP tool catalog (33 tools)

All tools are registered on `document.modelContext` and callable by any WebMCP host. Grouped by intent:

**Create (6)** — `create_shape` · `create_text` · `create_sticky_note` · `create_frame` · `create_connector` · `add_comment`

**Edit & arrange (10)** — `update_element` · `move_elements` · `set_style` · `delete_elements` · `duplicate_elements` · `group_elements` · `ungroup_elements` · `arrange_grid` · `align_elements` · `distribute_elements`

**Generate (2)** — `generate_layout` · `suggest_alternatives`

**Query & select (5)** — `get_board_state` · `find_elements` · `get_selection` · `select_elements` · `summarize_board`

**Export & load (4)** — `export_svg` · `export_png` · `export_json` · `load_board`

**View / camera (3)** — `set_camera` · `zoom_to_fit` · `focus_element`

**Board & agent identity (3)** — `clear_board` · `set_agent_presence` · `agent_say`

Inspect the live surface any time:

```js
document.modelContext.getTools()          // full definitions + JSON schemas
```

---

## 🧪 Testing it

### 1. The built-in agent (no setup)
Open the **Aria** console (bottom-right) and try:
- *"generate a kanban with To Do, Doing, Done"*
- *"make a flowchart: Start, Validate, Ship"*
- *"make everything blue"* (select some elements first, or say *"make everything…"* for the whole board)
- *"tidy everything into a grid"*
- *"what's on the board?"*
- *"export as SVG"*
- *"clear the board"*

### 2. In ChatGPT's in-app browser (WebMCP host)
1. Open the live URL inside ChatGPT's in-app browser.
2. The tools register automatically — ChatGPT discovers them via `document.modelContext`.
3. Ask ChatGPT to build something on the canvas ("add three sticky notes for our sprint goals and connect them"). It calls the tools directly; you watch the board update live.

### 3. From the DevTools console (any browser)
```js
await window.CollabCanvas.callTool('generate_layout', {
  kind: 'flowchart',
  items: ['Start', 'Validate?', 'Ship'],
})
```
`window.CollabCanvas` is exposed in both dev and the production bundle, so this works on the live site too.

---

## 🎬 Demo script (≈90s)

1. **Load** → the welcome board is already there. "The agent seeded this — notice it has its own cursor and identity."
2. **One sentence → a layout.** In Aria: *"generate a kanban with Backlog, In Progress, Review, Done."* Board fills instantly.
3. **Collaborate.** Grab a card, drag it, restyle it by hand — then tell Aria *"align the top row"* and *"make the headers violet."* Human and agent editing the same objects.
4. **Ask about the board.** *"What's on here?"* → Aria summarizes it back.
5. **Show the machinery.** Hit **Connect** → the modal lists all 33 live WebMCP tools and shows the exact `document.modelContext` handshake. "This is a public tool surface — any WebMCP agent can drive it."
6. **Export & reset.** *"Export as PNG"*, then *"clear the board."*

---

## 🧭 Current architecture and implementation status

Layer 19 Copilot proposal hardening is implemented and verified for the current
two-operation vocabulary (`moveNode`, `deleteNode`). The HTTP proposal route,
server-authoritative approved-version grounding, scope/version conflict paths,
workspace-preserving review navigation, and Agent Console activity boundary are
covered by the test suite. Live PostgreSQL-backed browser hydration remains
environment-dependent when `DATABASE_URL` is not configured.

The repository now has two deliberately distinct surfaces. The browser canvas
is working editor software and remains a projection/runtime surface. The
server-side Design Graph is the canonical representation used by application,
manifest, and agent boundaries.

```mermaid
flowchart TB
    subgraph browser["Browser editor (working, non-canonical)"]
        Human["Human editor"]
        Aria["Aria console"]
        Legacy["33 existing canvas WebMCP tools"]
        Store["Zustand runtime state"]
        SVG["Existing SVG canvas"]
        Human --> Store
        Aria --> Legacy
        Legacy --> Store
        Store --> SVG
    end

    subgraph canonical["Canonical server-side design path"]
        DB[("PostgreSQL persistence")]
        Repo["DesignGraphRepository"]
        Graph["Design Graph<br/>canonical source of truth"]
        Projection["Canvas projection adapter"]
        Compiler["Deterministic Manifest compiler"]
        Manifest["Design Manifest<br/>derived contract"]
        App["Application services"]
        Gateway["Agent Gateway<br/>policy boundary"]
        Semantic["Semantic tools<br/>get_manifest"]
        DB --> Repo --> Graph
        Graph --> Projection
        Projection -. "migration boundary" .-> Store
        Graph --> Compiler --> Manifest
        Manifest --> App --> Gateway --> Semantic
    end

    Store -. "move/delete vertical slice" .-> Projection
```

The intended mutation direction is:

```text
Canvas interaction
    -> canvas/domain application service
    -> validated Design Graph operation
    -> persisted graph
    -> Canvas projection
    -> existing Zustand/SVG renderer
```

The browser tools have not been silently converted into semantic graph tools.
They still operate against the existing Zustand editor model. The graph-backed
canvas adapter is the explicit migration boundary, and future tool migration
must route through domain operations rather than making `CanvasElement`
canonical again.

### Layer progress

| Layer | Result | Status |
| --- | --- | --- |
| 1. Persistence | Project → DesignDocument → Page → DesignNode contracts, PostgreSQL migrations, repositories, API CRUD | Implemented |
| 2. Design Graph | Semantic nodes, hierarchy validation, components/instances, tokens, typography, layout/responsive constraints, interactions, accessibility, assets, intent, graph operations | Implemented; graph is canonical |
| 3. Manifest compiler | Explicit contract, deterministic compilation and serialization | Implemented; derived artifact only |
| 4. Manifest API | `GET /api/v1/documents/:documentId/manifest` application/API boundary | Implemented; complete graph snapshots hydrate through PostgreSQL |
| 5. Agent Gateway | Identity boundary, project scope, capability checks, safe gateway errors | Implemented; development authentication only |
| 6. Semantic WebMCP/MCP | Transport-neutral `get_manifest` over the gateway | Implemented; no standalone MCP transport |
| 7. Canvas vertical slice | Graph load, projection, move/delete operations, deterministic re-projection | Implemented as a narrow migration slice |
| 8–11. Trust and handoff | Draft/approved immutability, proposal-first rules, approved-version handoff, implementation/sync contracts | Implemented in typed services; richer repositories are in-memory |
| 12. InvoiceFlow proof | Canonical fixture, approved version, manifest and gateway handoff | Implemented as development/test orchestration |
| 13. Design/code synchronization | Implementation reports, semantic impact, pending synchronization proposals | Implemented; no automatic code changes |
| 14. Structured Copilot | Provider-neutral context and injected planner producing typed proposal operations | Implemented; no AI provider or automatic mutation |
| 15. Production hardening | Runtime config, audit events, injectable rate limits, health/readiness probes, redacted errors | Implemented as development/test foundations |

The frontend execution ledger uses its own numbering: frontend Layer 17 is the
semantic diff UI slice described in `frontend-architecture.md`; Layer 16 is
the graph-backed token-reference editing slice. The production-hardening entry
above is the historical system-layer numbering; it is not part of this
frontend task.

### Verification

```text
npm run typecheck  -> pass
npm test           -> 197 tests passed across 32 files
npm run build      -> pass (non-failing Vite chunk-size warning)
git diff --check   -> pass
Browser WebMCP    -> original 33 canvas tools preserved
```

The test suite covers persistence, graph invariants, deterministic
serialization, manifest compilation, API contracts, gateway policy, semantic
tool delegation, canvas projection, version/proposal rules, handoff,
synchronization, Copilot boundaries, and production-hardening seams.

### Architectural decisions

- Design Graph is canonical; canvas coordinates, SVG, React, and Zustand are
  projections/runtime state.
- The Manifest is compiled and derived; it is not an editable source of truth
  and has no separate persistence table.
- HTTP, semantic tools, and gateway code delegate to application services and
  never query PostgreSQL or compile manifests directly.
- Approved versions are immutable; agent/Copilot mutations are proposal-first.
- The existing 33 browser tools and SVG renderer remain intact so migration can
  proceed incrementally without breaking the working editor.
- In-memory authentication, audit, rate limiting, version repositories, and
  rich-graph fixtures are intentional development/test seams.

### Known limitations

1. Rich graph entities are stored as a validated document-scoped JSONB
   aggregate until dedicated relational tables are introduced. Run
   `npm run db:migrate` to apply migration 003 before using graph hydration.
2. `server/index.ts` composes the PostgreSQL graph application service and
   exposes the scoped workspace graph route; manifest and gateway services
   remain injectable boundaries.
3. Authentication is development-only. There is no production API-key, OAuth,
   workload identity, revocation store, or external identity provider.
4. Audit events and rate limits are in-memory. Durable audit storage and shared
   distributed limits are deferred.
5. `/readyz` is a process-level probe and does not yet check PostgreSQL health.
6. There is no standalone remote MCP server; `server/mcp/` is transport-neutral.
7. The existing Zustand/SVG editor remains a projection model and not all 33
   browser tools have migrated to graph operations.
8. Version, synchronization, and Copilot repositories are development/test
   implementations and do not provide durable production history.

### Build issue resolved

The first Layer 15 test run reported `100 passed, 1 failed`. `MemoryAuditSink`
used `structuredClone()` when reading records, which removed the frozen audit
context invariant. The sink now freezes event and context on record and read;
the final result is **197/197 tests passing** across 32 files.

The production build still emits a non-failing Vite warning that the main
JavaScript chunk exceeds 500 kB after minification. This is a bundle
optimization task, not a build failure, and was intentionally left outside the
hardening scope.

### Remaining roadmap

1. Build the remaining Layer 18 proposal review UI on the accepted version/
   approval trust surface, followed by Copilot and Agent Center workflows.
2. Replace development authentication with managed machine identity and secret
   management.
3. Move audit events to durable storage and rate limiting to a shared policy.
4. Add dependency-aware readiness checks, observability, backups, deployment
   controls, and security review.
5. Migrate additional browser tools through the Canvas Projection boundary only
   after graph write/version/proposal contracts are stable.

Deferred by design: write-capable agent tools, proposal approval UI, version
history APIs, code generation, Copilot providers, synchronization execution,
remote MCP transport, billing, marketplace features, Figma parity, and canvas
replacement.

## 🏗️ Legacy browser architecture (preserved)

This diagram describes the existing browser editor only. Its Zustand store is
runtime state for the canvas projection; it is not the canonical Design Graph.

```mermaid
flowchart TB
    subgraph people["Agents and people"]
        H["Human<br/>UI · drag · draw"]
        Aria["Aria<br/>built-in NL console"]
        Ext["External WebMCP agent<br/>ChatGPT in-app browser · WebMCP Chrome"]
        GPT["ChatGPT app / connector"]
    end

    MC["document.modelContext<br/>33 WebMCP tools"]
    SRV["CollabCanvas MCP server<br/>HTTP / SSE"]
    Core{{"Shared tool layer<br/>Zustand store actions · author human or agent"}}
    Canvas[("Canvas state<br/>undo/redo · live activity feed · agent cursor")]

    H --> Core
    Aria --> Core
    Ext -->|"getTools / callTool"| MC
    MC --> Core
    GPT -. "MCP over HTTP/SSE" .-> SRV
    SRV -. "real-time sync" .-> Core
    Core --> Canvas

    classDef road stroke-dasharray:6 4,opacity:0.65
    class GPT,SRV road
```

_Solid path = **shipped today** (in-page WebMCP). Dotted path = **roadmap** (a remote MCP server, so ChatGPT itself becomes the agent). Both converge on the **same store actions** — that convergence is the whole design._

- **`src/store/`** — Zustand runtime store; every capability is an action taking an `author` tag, with undo/redo history. It remains a browser projection, not canonical persistence.
- **`src/mcp/`** — 33 tool definitions (`tools/*.ts`), a local registry so tools work even without a native WebMCP host, and `registerAll()` mirroring them onto `document.modelContext`.
- **`src/agent/`** — a rule-based natural-language interpreter (`intent.ts` → `runner.ts`) so the built-in Aria console turns plain English into tool calls, plus the first-run welcome seed.
- **`src/canvas/` & `src/ui/`** — the infinite-canvas renderer, coordinate transforms, toolbar, style panel, Aria console, and the Connect guide.

**Principle:** if the UI can do it, a tool exposes it; if a tool can do it, the UI can too. No divergence.

---

## 🗺️ Frontend roadmap (deferred)

The browser tool layer remains transport-agnostic and useful for the current
demo, but these items are not part of the completed server architecture:

- Remote MCP transport and ChatGPT connector.
- CRDT-backed real-time multiplayer across devices.
- Shareable persisted browser rooms.
- Multi-agent presence with scoped permissions.

Any future browser capability must preserve the canonical path above and must
not promote Zustand or `CanvasElement` back to source-of-truth status.

---

## 🧱 Tech stack

Vite 8 · React 18 · TypeScript 5 (strict) · Zustand 5 · Tailwind v4 · PostgreSQL (`pg`) · Vitest · `pg-mem` test database · [`@mcp-b/global`](https://www.npmjs.com/package/@mcp-b/global) WebMCP polyfill · nanoid

## ☁️ Deployment

Deployed to **Vercel** as a static SPA plus a serverless API function.

- `vercel.json` builds `npm run build` → `dist` and rewrites `/api/*` to `api/index.ts`.
- `api/index.ts` is the serverless entry point; it wires the same application services as `server/index.ts` (workspace, design graph, editor commands, history, versions, manifest, assistant).
- The design graph and version history live in PostgreSQL (`DATABASE_URL`).
- Migrations: `npm run db:migrate` (see `db/migrations/`).

### Required environment variables

- `DATABASE_URL` — PostgreSQL connection string for the canonical design graph.

### Design assistant (Azure OpenAI)

The assistant runs server-side, so the credential never reaches the browser.

- `AZURE_OPENAI_ENDPOINT` — resource endpoint (see the two shapes below)
- `AZURE_OPENAI_API_KEY` — Azure OpenAI key (server-side only)
- `AZURE_OPENAI_DEPLOYMENT` — deployment (classic) or model name (Foundry v1), e.g. `gpt-4o` / `gpt-5-mini`
- `AZURE_OPENAI_API_VERSION` — optional; defaults to `2024-10-21` (classic surface only)

Both Azure surfaces are supported and detected from the endpoint:

- **Classic Azure OpenAI** — `https://<resource>.openai.azure.com`. Requests go to `/openai/deployments/<deployment>/chat/completions?api-version=…` with an `api-key` header.
- **Azure AI Foundry v1** — an endpoint ending in `/openai/v1`. Requests go to `<endpoint>/chat/completions` with a `Bearer` token and the model in the body. On this surface `temperature` is omitted and `max_completion_tokens` is used, since newer reasoning models reject the classic parameters.

When the three required variables are present the API uses `AzureOpenAiCopilotPlanner`. When they are absent the deterministic planner is used, so the product still runs without credentials. Model output is validated against the trusted graph before it can become a proposal: unknown layer ids and unsupported operations are dropped, and an unreachable model degrades to a clarification instead of an executable change.

Suggestions are grounded in the design the user is actually editing — the working draft, or the latest approved snapshot when there is no draft — so the assistant works on a brand-new design while approved snapshots stay immutable. `GET /api/v1/assistant` reports which assistant is answering (`azure-openai` or `builtin`) and never returns endpoint, deployment, or key material.

Never expose these as `VITE_*` variables — anything prefixed `VITE_` is bundled into the client.

Add the variables to Vercel with `vercel env add AZURE_OPENAI_ENDPOINT`, `vercel env add AZURE_OPENAI_API_KEY`, and `vercel env add AZURE_OPENAI_DEPLOYMENT` for both Production and Preview, then redeploy.

### Known limitation

Editor undo/redo history is currently held in memory per server process (`EditorHistoryApplicationService`). On serverless hosting consecutive requests may not share an instance, so undo is unreliable once deployed. Persisting the history is a follow-up.

## Persistence slice (development)

The first server-side persistence slice lives under `server/` and uses PostgreSQL as its production database. It currently persists the following graph boundary:

`Project → DesignDocument → Page → DesignNode`

The API is intentionally limited to project, document, page, and node creation/retrieval plus the internal manifest retrieval boundary. It does not implement production authentication or general version/proposal HTTP APIs. The versioning application boundary and approved-version gateway handoff exist separately for the richer graph, while the existing browser canvas and all 33 WebMCP tools remain client-side and unchanged; they are not yet the canonical persistence adapter.

Manifest retrieval is now available as an internal document-scoped application/API boundary:

`GET /api/v1/documents/:documentId/manifest`

It requires the canonical `DesignGraphRepository`; PostgreSQL hydrates the complete graph snapshot from the `design_graphs` JSONB aggregate after migration 003. This endpoint is not the Agent Gateway.

Layer 6 adds a separate, transport-neutral semantic `get_manifest` tool under
`server/mcp/`. It delegates through the existing Agent Gateway and is not
merged into the browser WebMCP registry: the original canvas/editor surface
remains exactly 33 tools. A standalone MCP transport and production machine
authentication are intentionally deferred; see `docs/semantic-webmcp.md`.

The graph-backed canvas vertical slice is documented in
`docs/canvas-vertical-slice.md`. It loads a canonical graph, applies graph-backed
edits through the application/domain boundary, and re-projects the result into
the unchanged Zustand/SVG editor. B7 Level 2 verifies the PostgreSQL → API →
workspace hydration path.

Versioning and proposal semantics are documented in `docs/versioning.md`.
Drafts are mutable, approved graph snapshots are immutable, and proposed
semantic mutations must use a current approved base before producing a new
draft. The version repository is currently in-memory for the richer graph;
PostgreSQL schema support exists in migration `002_versioning.sql`.

Agent handoff is documented in `docs/agent-handoff.md`. The current gateway
can expose a read-only approved-version handoff with manifest and provenance;
implementation reporting and full synchronization remained deferred at that
layer. Layer 13 now adds their controlled foundation below.

The Layer 12 InvoiceFlow proof is documented in `docs/invoiceflow.md`. It
provisions the canonical fixture through the typed development repositories,
creates and approves an immutable version, and retrieves the resulting
manifest through the existing project-scoped Agent Gateway. It remains a
development/test orchestration rather than the InvoiceFlow product application.

Layer 13 adds the synchronization foundation documented in
`docs/design-code-synchronization.md`: implementation status reports,
semantic impact between approved versions, and pending non-mutating sync
proposals. The gateway exposes explicit development capabilities for these
operations; automatic code changes and production persistence remain deferred.

Layer 14 adds the structured Copilot foundation in `docs/copilot.md`.
Copilot context is assembled from an approved Design Graph, an injected
planner returns typed domain operations, and the existing versioning service
stores a pending proposal. No AI provider or automatic mutation is included.

Layer 15 adds the production-hardening foundation documented in
`docs/production-hardening.md`: validated runtime configuration, safe gateway
audit events, injectable rate limiting, health/readiness probes, and redacted
unexpected-error logging. Production identity, durable audit storage,
distributed limits, and deployment infrastructure remain deferred.

Endpoints:

```text
POST /api/v1/projects
GET  /api/v1/projects/:projectId
POST /api/v1/projects/:projectId/documents
GET  /api/v1/documents/:documentId
POST /api/v1/documents/:documentId/pages
GET  /api/v1/pages/:pageId
POST /api/v1/pages/:pageId/nodes
GET  /api/v1/documents/:documentId/manifest
```

The internal Agent Gateway foundation adds separate read-only routes for
development/test credentials:

```text
GET /api/v1/gateway/manifest?projectId=:projectId&documentId=:documentId
GET /api/v1/gateway/approved-version?projectId=:projectId&documentId=:documentId&versionId=:versionId
```

These gateway routes are not enabled by the default production server wiring
and do not provide production authentication or an Agent Gateway deployment.

Run PostgreSQL locally (Docker example):

```bash
docker run --name collabcanvas-postgres \
  -e POSTGRES_PASSWORD=collabcanvas \
  -e POSTGRES_DB=collabcanvas \
  -p 5432:5432 -d postgres:16
```

Then apply migrations and start the API:

```bash
DATABASE_URL=postgres://postgres:collabcanvas@localhost:5432/collabcanvas npm run db:migrate
DATABASE_URL=postgres://postgres:collabcanvas@localhost:5432/collabcanvas npm run api
```

The API listens on `http://localhost:8787` by default. The isolated test suite uses an in-memory PostgreSQL-compatible database, so tests do not require a shared local database:

```bash
npm test
```

## 📄 License

[MIT](./LICENSE) © 2026 Emmanuelzyronis
