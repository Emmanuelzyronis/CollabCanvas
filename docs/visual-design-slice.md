# Visual Design Slice — Typography, Shape Styling, Images, Inspector

This slice makes the human editor produce visually meaningful designs. It
extends the canonical graph/command/persistence path with real design
properties; it does not add a second styling or history system.

```text
Human action (Inspector field / inline text / direct manipulation)
        ↓
Editor command (POST /api/v1/documents/:documentId/commands)
        ↓
Design Graph (node.properties, node.assetRef, graph.assets)
        ↓
Persistence (design_graphs aggregate)
        ↓
Projection (graphToCanvasProjection / projectInspector / projectLayers)
        ↓
Canvas / Layers / Inspector
```

## Canonical extensions

- `node.properties.style` carries human-facing presentation values:
  `fontFamily`, `lineHeight`, `textColor`, `fill`, `stroke`, `strokeWidth`,
  `borderRadius`, `opacity`, `dashed`.
- `node.properties` carries `fontSize`, `fontWeight`, `textAlign`, `text`.
- `AssetReference` gains optional `width` / `height` (intrinsic pixel size) so
  a placed image covers its frame without distortion.
- `src/graph/canvasProjection.ts` exposes one `defaultAppearance(type)` used by
  both the canvas renderer and the Inspector, so a control never shows a value
  the canvas does not use.

Nothing in this slice is stored in React or Zustand state: field edits commit
through the editor command bus (with base-version conflict semantics), and
undo/redo runs through the existing canonical history service.

## Human surface

- Toolbar insert tools: text, heading, box, frame, section, button, card, image.
- Inspector sections for one selected node: Identity, Image, Text, Typography,
  Appearance, Layout, then graph/semantic metadata. Only relevant sections
  render for the selected element type. Text controls also appear for any shape
  that carries text.
- Images: a real `data:` asset is placed on insert, previewed in the Inspector,
  replaceable from a local file (type and size validated), and drawn as a
  cover fill clipped to the frame radius.
- Layer names are never painted as canvas content on container shapes; a shape
  shows only the text it was given.

## Verification

- `npm test` — full suite (36 files).
- `npm run typecheck`, `npm run build`, `make check`.
- `npm run workflow:human` — real browser proof (Playwright, real pointer and
  keyboard input) covering create → inline text edit → typography → card /
  section / button styling → image insert, move, resize → canonical undo/redo
  for typography, fill, radius, image move and image resize → reload
  persistence → Canvas/Layers/Inspector convergence → viewport stability at
  1440×1000 and 1600×900 → no console errors. Requires `npm run dev` and
  `npm run api`; screenshots land in `.playwright-mcp/`.
- `tests/visual-design-capability.test.ts` and `tests/inspector.test.ts` hold
  the focused regressions for typography, styling, image and Inspector
  persistence, projection and section ordering.

## Deferred

Multi-select, grouping, snapping, guides, responsive constraints, advanced
vector or image editing, collaborative multiplayer editing, cloud asset
management, templates, animation, Copilot expansion, architecture refactors
and server-side undo history stay out of this slice.
