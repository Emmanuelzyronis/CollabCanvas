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

PostgreSQL hydrates the complete canonical graph through the document-scoped
`design_graphs` JSONB aggregate introduced by migration 003. The API does not
fabricate a partial manifest from normalized page/node rows. The aggregate is
validated for project/document/page identity and graph integrity before
compilation. Dedicated relational tables for rich entities remain future
persistence work.

## Boundaries and deferrals

The Design Graph remains canonical and the Manifest remains derived. The
endpoint does not persist manifests, expose version hashes, or make the
manifest an editable source of truth. Authentication, authorization, agent
credentials, rate limiting, WebMCP exposure, and the Agent Gateway are
intentionally deferred.
