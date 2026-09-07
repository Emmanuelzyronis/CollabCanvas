# Semantic WebMCP/MCP Surface (Layer 6)

Layer 6 adds the first semantic agent-facing capability, `get_manifest`.
It provides a transport-neutral tool definition that can be exposed by a
future WebMCP or MCP adapter while preserving the existing browser canvas
tools.

The semantic WebMCP/MCP surface is an interface over the Agent Gateway, not a
second application or authorization layer.

## Two tool surfaces

The browser currently registers exactly 33 canvas/editor tools under
`document.modelContext`. They operate on the Zustand canvas projection and are
unchanged by this layer.

The new semantic surface is separate and server-side under `server/mcp/`.
It currently contains one tool, `get_manifest`; it is not added to the
browser's 33-tool registry and there is no standalone MCP transport yet.

## `get_manifest` contract

```ts
{
  projectId: string
  documentId: string
  credential: string | undefined
  requestId: string
}
```

The credential is transport input for the existing gateway authenticator. An
agent identity is never accepted as an arbitrary tool argument. The tool fixes
the requested capability to `READ_MANIFEST`.

Successful execution returns:

```ts
{
  data: DesignManifest
  requestId: string
}
```

The manifest is exactly the result returned by the existing application
service. Request metadata remains outside the manifest payload.

## Execution and policy flow

```text
Agent / WebMCP / MCP client
        ↓
semantic get_manifest tool
        ↓
AgentGateway.readManifest
        ↓
GatewayAuthenticator
        ↓
project scope + READ_MANIFEST capability
        ↓
ManifestApplicationService.getDocumentManifest
        ↓
canonical Design Graph
        ↓
deterministic Manifest compiler
        ↓
Design Manifest
```

The semantic tool does not access PostgreSQL, repositories, Zustand,
`CanvasElement`, SVG state, or the manifest compiler. It also does not perform
authentication, authorization, or document/project ownership checks itself.

The gateway authenticates the credential, checks explicit project scope and
`READ_MANIFEST`, delegates to `ManifestApplicationService`, and verifies that
the returned project/document identity matches the request. Gateway error
codes are preserved by the semantic registry and messages are safe; secrets,
SQL errors, stack traces, and credential values are never returned.

## Determinism

`get_manifest` does not mutate or reorder the returned manifest. Repeated calls
for an unchanged Design Graph produce equivalent manifest serialization via
`serializeDesignManifest`. The Design Graph remains canonical; the Manifest is
a derived artifact and is not persisted or editable source state.

## Development limitation

The current `DevelopmentGatewayAuthenticator` is an in-memory,
test/development-only authenticator that retains SHA-256 hashes rather than
plaintext credentials. Production API keys, OAuth, workload identity, secret
management, revocation persistence, rate limiting, and audit persistence are
intentionally deferred.

The richer Layer 2 graph is not yet fully hydrated from PostgreSQL. Production
retrieval therefore preserves the existing `GRAPH_UNAVAILABLE` behavior rather
than fabricating a partial Manifest. Tests and fixtures use the typed in-memory
graph repository.

## Future extension

Additional semantic tools should follow the same shape:

```text
semantic tool
      ↓
gateway operation + capability
      ↓
application service
```

Only `get_manifest`/`READ_MANIFEST` is implemented in the semantic registry.
The gateway also has a separate `READ_VERSION` approved-version handoff for
the later coding-agent connection, but it is not a browser WebMCP tool.
Component, page, token, proposal, implementation, synchronization, and write
capabilities remain future layers. A future WebMCP/MCP transport can expose
the semantic registry without creating another application or security path.
