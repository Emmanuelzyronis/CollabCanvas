# Design Graph (Layer 2)

The canonical design representation is now a framework-independent `DesignGraph`:

```text
Design Graph
    ↓
Canvas Projection
    ↓
Existing SVG/Zustand
```

`DesignGraph` contains a page and semantically typed `DesignNode` records,
plus component definitions and instances, design tokens, typography,
responsive/layout constraints, interaction/state metadata, accessibility
metadata, asset references, and design intent. Every entity has a stable ID.
`validateDesignGraph` rejects duplicate IDs, dangling or cross-page parents,
cycles, invalid sibling ordering, and unresolved references.

The pure graph operations in `server/domain/graph-operations.ts` are the
mutation boundary for graph state. They return a validated copy and do not
depend on React, Zustand, SVG, or browser APIs.

`serializeDesignGraph` sorts object keys, graph entities, and sibling nodes so
equivalent graphs have byte-for-byte identical JSON. Transient canvas state,
browser state, and secrets are not part of the serialization.

## Canvas migration boundary

`src/graph/canvasProjection.ts` is a temporary adapter. It projects graph
nodes into the existing `CanvasElement` shape using stable graph IDs and
derives geometry only for rendering. It also translates canvas editing intents
into graph operations. The current editor still owns its Zustand store and SVG
renderer; no existing canvas files were rewritten.

The projection cannot represent all graph semantics. Responsive constraints,
interactions, accessibility metadata, token references, typography, assets,
and design intent remain on the graph and are not flattened into
`CanvasElement`. `unsupportedNodeIds` makes that boundary observable.

Existing WebMCP tools remain store-based for now. Their migration mapping is:

| Current canvas operation | Future graph operation |
| --- | --- |
| create rectangle/text/frame | `createNode` |
| move element | `moveNode` |
| update style/content | `updateNode` |
| delete element | `deleteNode` |
| bring/send to front | `reorderNode` |
| grouping/ungrouping | `attachChild` / `detachChild` |

The 33 existing tools are intentionally not reimplemented in Layer 2.

## InvoiceFlow fixture

`server/domain/fixtures/invoiceflow.ts` contains a canonical dashboard graph
with a dashboard shell, metric card, invoice table, status badge, primary
button, tokens, typography, responsive constraints, states/interactions,
accessibility metadata, assets, and design intents. It is a domain fixture for
future manifest compilation, not a replacement for the current canvas UI.

## Persistence and local development

Layer 1 PostgreSQL persistence remains the durable `Project → DesignDocument →
Page → DesignNode` foundation. The richer Layer 2 graph aggregate is currently
validated and serialized in the domain boundary; its additional entities will
be persisted in a later schema slice rather than duplicating or bypassing the
existing repository.

Run the existing database migration with:

```sh
npm run db:migrate
```

Run the domain/API test suite with:

```sh
npm test
```

Layer 3 now provides the deterministic Design Manifest compiler in
`server/domain/manifest-compiler.ts`. It consumes `DesignGraph`, never Zustand
state or `CanvasElement`; see [design-manifest.md](./design-manifest.md).
