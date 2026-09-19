# Canvas Vertical Slice

This layer establishes the first graph-backed editor workflow for one page.
It does not migrate the existing canvas tools or replace the SVG renderer.

```text
Persisted Design Graph
        ↓
CanvasGraphApplicationService
        ↓
CanvasGraphController
        ↓
graphToCanvasProjection
        ↓
Zustand loadSnapshot
        ↓
existing SVG Canvas
```

## Workflow

`CanvasGraphApplicationService` loads a document-owned canonical
`DesignGraph`, applies the existing domain operations `moveNode` and
`deleteNode`, and persists the resulting graph through `DesignGraphWriter`.
The service returns the updated graph only after the application mutation has
completed.

`CanvasGraphController` is the editor boundary. It sends operations to the
application service and applies the returned graph through the existing
`loadSnapshot` lifecycle. `canvasProjectionToSnapshot` converts the temporary
`CanvasProjection` into the `BoardSnapshot` shape understood by Zustand.
The unchanged SVG canvas renders the resulting Zustand state.

Canvas elements are therefore a projection. Editing coordinates or deleting a
canvas element directly does not update the canonical graph in this slice;
graph-backed callers must use the controller/application path.

## Scope and limitation

Only loading one document graph, moving one node, and deleting one node (with
its descendants) are included. The 33 existing browser WebMCP tools, their
Zustand behavior, and the SVG renderer remain unchanged.

`MemoryDesignGraphRepository` supports graph writes for tests and local
development. PostgreSQL now persists and hydrates the complete canonical graph
through the document-scoped `design_graphs` aggregate; B7 Level 2 verifies the
repository, application, API, and frontend query path. The slice still
preserves `GRAPH_UNAVAILABLE` when no canonical graph source is configured and
does not fabricate a partial graph.

Future canvas integrations can provide an API-backed implementation of the
same application client without changing the projection or domain operations.
