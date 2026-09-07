# Manifest API Boundary (Layer 4)

This endpoint establishes the application/API contract for Manifest
retrieval. It is not yet the Agent Gateway.

## Endpoint

The canonical route is document-scoped:

```text
GET /api/v1/documents/:documentId/manifest
```

The document ID identifies the design resource whose canonical graph is to be
compiled. The application service resolves the document first, then requires
a graph source whose document and project identities match that resource.

## Flow

```text
HTTP request
    ↓
API route/response mapping
    ↓
ManifestApplicationService
    ↓
DesignGraphRepository
    ↓
validateDesignGraph
    ↓
compileDesignManifest
    ↓
typed DesignManifest JSON
```

The HTTP layer never assembles a manifest and never reads database rows
directly. The application layer has no Express, React, Vite, browser, canvas,
or WebMCP dependency. Authentication and authorization can later be inserted
before `ManifestApplicationService` without changing the domain compiler.

## Successful response

Responses use the existing API envelope:

```json
{
  "data": {
    "manifestVersion": "1",
    "project": { "id": "project_123", "name": "InvoiceFlow", "slug": "invoiceflow" },
    "document": { "id": "doc_123", "projectId": "project_123", "name": "Dashboard" },
    "pages": [],
    "nodes": [],
    "componentDefinitions": [],
    "componentInstances": [],
    "tokens": [],
    "typography": [],
    "assets": [],
    "intents": []
  },
  "meta": { "requestId": "req_123", "apiVersion": "v1" }
}
```

The request ID and API version are HTTP envelope metadata, not manifest
content. The manifest itself remains deterministic for an unchanged graph.

## Error response

Errors use a stable machine-readable shape and never expose stack traces or
raw database exceptions:

```json
{
  "error": {
    "code": "INVALID_GRAPH",
    "message": "The canonical design graph is invalid.",
    "details": { "issues": [] }
  },
  "meta": { "requestId": "req_123", "apiVersion": "v1" }
}
```

Current mappings are:

| Code | HTTP status | Meaning |
| --- | ---: | --- |
| `VALIDATION_ERROR` | 400 | Missing/invalid document ID |
| `NOT_FOUND` | 404 | Document does not exist |
| `INVALID_GRAPH` | 422 | Graph validation failed; structured issues are included |
| `GRAPH_UNAVAILABLE` | 503 | No canonical graph source is configured or available |
| `MANIFEST_COMPILATION_ERROR` | 500 | Graph context could not be compiled |

## Persistence limitation

Layer 1 PostgreSQL currently hydrates the initial project/document/page/node
slice only. It does not yet persist and hydrate every Layer 2 graph entity
(components, tokens, typography, assets, and intents). Therefore the API does
not fabricate a partial manifest from those rows. It requires a typed
`DesignGraphRepository`; the current in-memory implementation is used by tests
and development fixtures. Production PostgreSQL hydration belongs to a later
persistence slice.

## Boundaries and deferrals

The Design Graph remains canonical and the Manifest remains derived. The
endpoint does not persist manifests, expose version hashes, or make the
manifest an editable source of truth. Authentication, authorization, agent
credentials, rate limiting, WebMCP exposure, and the Agent Gateway are
intentionally deferred.
