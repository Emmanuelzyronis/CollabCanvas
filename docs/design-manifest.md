# Design Manifest (Layer 3)

The Design Manifest is a compiled machine contract for future coding-agent
consumers. It is derived from the canonical Design Graph and is never an
editable source of truth.

```text
Design Graph
     ↓
Deterministic Manifest Compiler
     ↓
Design Manifest
     ↓
Future Agent Gateway
```

## Contract boundary

`server/domain/manifest-types.ts` defines an external contract separate from
the richer graph types. The manifest contains project and document identity,
pages, semantic nodes, parent/child relationships, ordering, component
definitions and instances, tokens, typography, responsive constraints,
interactions, states, accessibility metadata, assets, and design intent.

Nodes expose optional `geometry` for editor-oriented numeric bounds and a
separate `layout` object for framework-neutral layout constraints. Geometry is
not identity and does not replace hierarchy or semantic data.

The manifest deliberately does not contain React components, JSX, CSS,
Tailwind classes, SVG state, Zustand state, browser state, persistence
timestamps, credentials, or generated implementation code. It also does not
invent semantics that are absent from the graph.

## Compilation and validation

`compileDesignManifest(graph)` calls `validateDesignGraph` before creating any
output. Invalid parent relationships, cycles, duplicate IDs, unresolved
component/token/typography/asset/intent references, invalid page ownership,
and invalid sibling ordering therefore fail through the existing structured
graph validation errors. Missing or inconsistent project/document/page
identity produces a typed `ManifestCompilationError`.

The compiler is pure with respect to its inputs: it reads only `DesignGraph`
and returns a derived manifest. It does not import or access React, Zustand,
CanvasElement, SVG, UI components, or WebMCP registration.

## Deterministic ordering

- The current graph aggregate compiles one page into the `pages` collection.
- Nodes are emitted in a deterministic depth-first hierarchy: siblings sort by
  `orderIndex`, then stable node ID.
- Each node includes a deterministic `children` ID list using that same order.
- Component definitions, instances, tokens, typography, assets, and intents
  sort by stable ID.
- Responsive constraints sort by the explicit breakpoint order
  `mobile`, `tablet`, `desktop`, `wide`.
- States, interactions, and intent references have stable sorting rules.
- `serializeDesignManifest` recursively sorts object keys and emits stable JSON
  suitable for API responses, export, or a future version hash.

Equivalent graph collections supplied in different insertion orders therefore
produce byte-equivalent serialized manifests.

## InvoiceFlow

The existing `server/domain/fixtures/invoiceflow.ts` graph compiles into a
manifest containing the dashboard shell, hierarchy, MetricCard, InvoiceTable,
StatusBadge, PrimaryButton, tokens, typography, responsive constraints,
interactions, accessibility metadata, assets, and design intent. This is a
compiler fixture, not an InvoiceFlow application integration.

Manifest generation is currently an internal domain operation. There is no
manifest endpoint, gateway, authentication, versioning, hashing, persistence,
framework adapter, or code-generation layer yet. Those belong to later layers.
