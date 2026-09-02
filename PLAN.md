# CollabCanvas — Build Plan

Real-time collaborative infinite canvas where a human and their AI agent work
side-by-side on the same live page. The agent acts through **WebMCP** tools
(`navigator.modelContext` / `document.modelContext`) — the same actions the human
performs in the UI. Built for the **OpenAI WebMCP Challenge** (deadline Sept 3, 2026).

## Core principle
Every capability is a **Zustand store action**. The UI calls it on click; a WebMCP
tool calls the *same* action. Human and agent are peers mutating one shared store.

## Stack
- Vite + React 18 + TypeScript
- Zustand (single source of truth)
- Custom **SVG** infinite canvas (crisp, trivially exportable)
- Tailwind v4 (`@tailwindcss/vite`)
- `@mcp-b/global` (WebMCP polyfill; exposes `listTools()` + `callTool()`)
- Deploy: static build → HTTPS sponsor host

## WebMCP API contract (verified Sept 2026)
```js
const mc = document.modelContext ?? navigator.modelContext;
const controller = new AbortController();
mc.registerTool({
  name, description,
  inputSchema: { type: 'object', properties: {...}, required: [...] },
  annotations: { readOnlyHint: true },      // for query/export tools
  async execute(args) {
    try { /* mutate store */ return { content: [{ type:'text', text: '...' }] }; }
    catch (e) { return { content: [{ type:'text', text: String(e) }], isError: true }; }
  }
}, { signal: controller.signal });          // abort to unregister
```

## Batches
- **0 Scaffold** — toolchain + deps + structure; dev server boots.
- **1 Canvas core** — store/model; SVG pan/zoom; toolbar; create/select/move/resize/edit/style/delete.
- **2 WebMCP core** — polyfill wired; registration hook; full tool suite → store; activity log; agent identity/presence.
- **3 Generate/query/export** — layout templates; summarize/find/get; export SVG/PNG/JSON; suggest/apply.
- **4 Console + collab UX + polish** — in-page Agent Console; activity feed; animated agent cursor; comments; "Connect an Agent" guide; onboarding; sample board; shortcuts.
- **5 Ship** — prod build; HTTPS deploy; README (tool catalog + test steps + demo script); MIT; live QA.
- **6 Stretch** — Yjs multiplayer; real LLM proxy.

## WebMCP tool catalog (target)
Creation: `create_shape`, `create_sticky_note`, `create_text`, `create_frame`, `create_connector`
Editing: `update_element`, `move_elements`, `set_style`, `delete_elements`, `duplicate_elements`
Organize: `group_elements`, `ungroup_elements`, `align_elements`, `distribute_elements`, `arrange_grid`
Generate: `generate_layout`, `suggest_alternatives`, `apply_suggestion`
Query (readOnly): `get_board_state`, `summarize_board`, `find_elements`, `get_selection`
Export (readOnly): `export_svg`, `export_png`, `export_json`
View: `set_camera`, `zoom_to_fit`, `focus_element`
Collab: `add_comment`, `set_agent_presence`
