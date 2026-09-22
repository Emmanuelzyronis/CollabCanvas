# CollabCanvas — Next Sprint (When We Return)

**Status**: Paused. Infrastructure is solid. Core editing loop is not good enough to ship.

## The One Thing That Must Work First

A user opens the app, draws a box, types text in it, picks a color — and it saves.
That's it. Nothing else matters until that is smooth and reliable.

---

## Priority Order

### 1. Make the canvas actually designable
- Click-to-create shapes must land reliably with no off-by-one positioning
- Text editing inside a selected element must feel native (double-click to edit, Enter to confirm, Escape to cancel)
- Drag-to-move must not lag or lose the node on commit
- Resize handles must be large enough to grab on first try
- Color picker in the inspector must apply instantly (no save button)
- Delete key must work without focus gymnastics

### 2. Fix mobile side panel
- Left panel must collapse fully and not bleed over the canvas
- The hamburger must be visible and tappable at 44px minimum
- Inspector must slide up from bottom on mobile, not overlap canvas from the side
- Touch targets on toolbar tools must be at minimum 44×44px

### 3. Wire the assets surface
- Right now `surface=assets` shows an empty grid from `context.graph?.assets`
- Assets need an upload path: at minimum a URL-paste flow that stores `AssetReference` in the graph
- Show a thumbnail grid; clicking an asset inserts it onto the canvas as an image node

### 4. Close the Aria loop
- `?aria=<prompt>` opens the copilot panel with the text pre-filled ✓ (done)
- The copilot must reliably produce at least a heading + body + button for a basic prompt
- Add a "Apply to canvas" one-click confirm after the proposal preview — no extra steps

### 5. One real end-to-end demo
- User types: "landing page for a SaaS tool"
- Aria generates 3–5 nodes (hero, nav, CTA)
- User tweaks one color token in the design system panel
- User saves a version
- Manifest is generated and shown
- That path must work start-to-finish without errors

---

## What Not To Touch Until Above Is Done

- WebMCP tool count / new tools
- Version comparison UI
- Agent Gateway
- Copilot proposal flow complexity
- More design system features

---

## Technical Debt To Clear When Returning

- `tests/agent-status.test.ts` — `MemoryDesignRepository` missing `getDesignGraph`; test is stale
- `tests/layout-inspector.test.ts` — `components` field removed from `DesignGraph`; test needs updating
- `server/application/azure-copilot-planner.ts` — two TS2322 type errors (pre-existing, suppressed by `skipLibCheck`)
- `server/application/editor-command-service.ts` — `JsonObject` → `AssetReference` cast needs a proper type guard
- Bundle is 697 KB gzipped to 193 KB — split the design system panel and copilot into lazy chunks

---

## Deployment State (as of pause)

| | |
|---|---|
| Frontend + API | https://collabcanvas-ruddy.vercel.app |
| Database | Supabase — `uizbihcsbsjhscrhpelu` (us-east-1) |
| DB password | stored in Vercel env as `DATABASE_URL` |
| GitHub | https://github.com/Emmanuelzyronis/CollabCanvas |
