# Frontend Graph Projection Contract

Layer 03 establishes a read-only frontend projection of the canonical `DesignGraph`.

```text
DesignGraph
  -> projectDesignGraph()
     -> node metadata index
     -> ordered Layers tree
     -> graph-identity selection
     -> Inspector-readable node data
```

## Canonical ownership

`DesignGraph` remains the only document source of truth. Node identity, page ownership,
parent relationships, sibling ordering, semantic metadata, component references,
tokens, typography, accessibility, interactions, responsive constraints, and intent
come from the domain contract in `server/domain/contracts.ts`.

Persistent mutations remain application/domain operations. Projection functions do
not expose mutation methods and do not write to React state, Zustand, browser storage,
the API, or persistence.

## Projection behavior

`projectDesignGraph()` validates graph ownership and domain references before
projection. Invalid graphs throw `GraphProjectionError` with typed issues. Missing
selection IDs are not fabricated or silently selected; they are returned in
`missingNodeIds`.

Output is deterministic for equivalent canonical graphs. Hierarchy uses canonical
`parentId` relationships and sibling `orderIndex`, with node ID as the deterministic
tie-breaker. All projected values are detached from and recursively frozen separately
from the input graph.

## Consumer contracts

- `nodes` provides stable identity and display metadata indexed by canonical node ID.
- `layers` provides a nested, ordered hierarchy with derived selection markers.
- `selection` resolves runtime-selected IDs to canonical graph entities and reports
  missing references.
- `inspector` exposes read-only semantic, content, layout, token, typography,
  responsive, accessibility, interaction, intent, component, and asset data.

Layer 03 does not implement Layers interactions, Inspector editing, graph mutations,
version UI, Copilot, Agent Center, or a replacement canvas renderer. The existing SVG
canvas adapter consumes the same projected node order while remaining a temporary
runtime seam.
