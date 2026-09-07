COLLABCANVAS
Phase 1 — Product Definition & Architecture Blueprint
Status: Foundational architecture / product-definition document
Primary audience: Product owner, architect, developer, AI-agent integrator
Core thesis: CollabCanvas is not another Figma or Canva. It is a developer-first design intelligence and delivery layer that turns intentional UI/UX decisions into machine-readable frontend context for AI coding agents.
CollabCanvas — Phase 1 Product Definition & Architecture Page 1
COLLABCANVAS
Phase 1 — Product Definition & Architecture Blueprint
Design once. Give AI coding agents a design they can actually use. Status: Foundational architecture / product-definition document Primary audience: Product owner, architect, developer, AI-agent integrator Core thesis: CollabCanvas is not another Figma or Canva. It is a developer-first design intelligence and delivery layer that turns intentional UI/UX decisions into machine-readable frontend context for AI coding agents.
CollabCanvas — Phase 1 Product Definition & Architecture Page 2
1. Executive Summary
CollabCanvas begins with a simple developer problem: AI coding agents can build functional applications quickly, but their generated interfaces often converge on generic fonts, spacing, layouts, components, and visual patterns. A developer who is not a specialist UI/UX designer is then forced into repeated prompting and manual correction. The proposed direction is to make CollabCanvas the place where a developer creates, refines, stores, and versions the visual language of a project. The result is not merely a screenshot or mockup. It is a machine-readable design system containing components, tokens, typography, layout rules, assets, interaction states, accessibility metadata, and design intent. AI assistants remain interchangeable. A user may work with CollabCanvas Copilot, ChatGPT, Claude, or another configured model. Coding agents such as Claude Code, Codex, or other CLI/IDE agents become consumers of the design context. The agent can retrieve the approved design system and generate frontend code against it rather than inventing a new visual language. Product promise: Build the backend with your coding agent. Design the frontend intentionally in CollabCanvas. Then let the coding agent pull the approved UI/UX system into the project and implement it.
2. The Problem
2.1 The developer/UI gap
The target user is capable of building software but does not want to become a professional visual designer. Existing AI coding workflows optimize for functional completion. They do not reliably preserve a developer's desired visual identity across screens and iterations. The resulting loop is expensive: prompt → generated UI → visual dissatisfaction → more prompting → manual CSS/component changes → regression → repeat.
2.2 Why prompting alone is insufficient
A prompt describes intent, but a design system stores decisions. Saying 'make it modern and premium' leaves the agent to choose fonts, spacing, hierarchy, colors, component proportions, and interaction patterns. CollabCanvas should convert those decisions into durable, structured context that an agent can consume repeatedly.
2.3 The opportunity
The opportunity is therefore not to replace mature visual design suites. It is to create a bridge between visual design intent and AI-generated production code, optimized for developers and coding agents.
3. Product Definition
3.1 Working definition
CollabCanvas is an AI-native design intelligence and frontend delivery platform for developers. It lets developers visually create and refine project UI/UX, persist the resulting design system, collaborate with AI models, and expose the approved design context directly to coding agents.
3.2 Mission
Make high-quality, intentional UI/UX accessible to developers who can build software but do not want the visual layer of their applications to be determined by an AI model's default aesthetic.
CollabCanvas — Phase 1 Product Definition & Architecture Page 3
3.3 Vision
A developer should be able to open a project in any capable coding agent, connect it to CollabCanvas, and have the agent build against a living design system instead of generating another generic interface.
3.4 What CollabCanvas is not
It is not intended to become a general-purpose replacement for Figma, Canva, Adobe, or a full creative-production suite. Its center of gravity is the developer workflow: design intent → structured design system → agent context → production frontend → controlled synchronization.
4. Core Product Principles
Principle
Meaning
Design decisions are first-class data
A font choice, spacing scale, component state, or layout decision must be representable as structured data, not trapped inside pixels.
Agent-agnostic
ChatGPT, Claude, Codex, local models, and future agents should connect through stable interfaces rather than being hard-coded into the core.
Human approval over silent mutation
Agents may propose or generate changes, but important design-system changes should be reviewable and versioned.
Production-oriented output
The destination is usable frontend code and assets, not a pretty static mockup.
Design memory
The system should preserve versions, provenance, rationale, and relationships between designs and generated implementations.
Progressive complexity
A developer can start with a simple template and later adopt tokens, components, states, accessibility metadata, and agent synchronization.
5. The Seamless User Journey
1. Create / open a project
The developer signs into CollabCanvas and creates a project such as 'InvoiceFlow'.
2. Establish visual direction
The developer selects or creates typography, colors, spacing, layout, components, assets, and page templates.
3. Use CollabCanvas Copilot
The user can ask the in-app AI to modify or generate a screen while the system preserves the project's design language.
4. Bring in external AI
The user can connect ChatGPT, Claude, or another configured model to critique, ideate, or co-design through the same project context.
5. Approve a design version
A stable version is marked as the project's approved design source.
6. Build the application
The developer uses a coding agent such as Claude Code or Codex to build the backend and application logic.
CollabCanvas — Phase 1 Product Definition & Architecture Page 4
7. Connect the coding agent
The coding agent authenticates to CollabCanvas and requests the project's design context.
8. Generate frontend
The coding agent receives machine-readable design tokens, components, templates, assets, constraints, and intent, then implements the UI in the application's framework.
9. Validate
The developer sees the implementation and can compare it against the CollabCanvas design.
10. Sync intentionally
Later design changes become versioned updates. The coding agent can detect the change, show the impact, and request approval before applying frontend changes. Key experience: The developer should never have to explain the same design decisions to every AI tool. CollabCanvas becomes the persistent source of truth for the project's visual language.
6. Layered Architecture
Layer 1 — Identity & Workspace Users, organizations/workspaces, projects, roles, OAuth, API credentials, session management and project-level permissions.
Layer 2 — Visual Canvas Pages, frames, elements, component instances, drag/drop editing, typography, layout, responsive views and visual inspection.
Layer 3 — Design Intelligence Design tokens, component definitions, states, constraints, accessibility metadata, design intent, relationships and semantic descriptions.
Layer 4 — AI Copilot Prompt orchestration, model adapters, context assembly, structured tool calls, proposals, previews and approval workflows.
Layer 5 — Integration Gateway WebMCP/MCP-style tools, REST APIs, webhooks and connector adapters for external AI assistants and coding agents.
Layer 6 — Agent Delivery Project-specific design manifests, framework adapters, asset delivery, code-generation context, synchronization and implementation feedback.
Layer 7 — Persistence & Versioning Projects, documents, assets, design versions, audit events, integration credentials, generated artifacts and rollback points.
CollabCanvas — Phase 1 Product Definition & Architecture Page 5
Layer 8 — Security & Operations Authentication, authorization, secret management, audit logs, rate limits, observability, backups and isolation.
7. Conceptual System Flow
The core architecture can be understood as a closed loop: Developer → CollabCanvas Canvas → Design System → AI Copilot / External AI → Approved Version → Agent Gateway → Coding Agent → Production Frontend → Validation → Design/Implementation feedback → CollabCanvas
8. Design System as the Contract
The most important architectural decision is that the canvas must produce a structured representation that coding agents can understand. A project should expose a versioned design manifest rather than forcing agents to interpret screenshots.
8.1 Design tokens
Tokens should cover typography families and scales, colors, spacing, radii, borders, shadows, breakpoints, motion, sizing, and semantic roles. Tokens should have stable IDs and human-readable names.
8.2 Components
Components should include anatomy, variants, properties, states, constraints, accessibility requirements, usage guidance, and references to the tokens they consume.
8.3 Templates
Templates should describe reusable page-level structures such as dashboards, landing pages, authentication flows, settings pages, and data-heavy views.
8.4 Assets
Images, icons, fonts, illustrations, and other assets should have metadata, licensing/source information where relevant, dimensions, formats, and stable references.
8.5 Design intent
Design intent captures the 'why' behind a decision. For example: 'Primary actions should be visually dominant, but never compete with the page title.' This gives an AI agent semantic constraints rather than only numeric values.
9. AI Integration Architecture
9.1 Internal Copilot
CollabCanvas Copilot should operate through structured tools over the project model. Rather than directly mutating arbitrary canvas data, the model should propose operations such as create_component, modify_token, create_template, inspect_page, compare_versions, and explain_design.
9.2 External AI assistants
ChatGPT and Claude should be treated as clients. They receive scoped project context and can invoke approved CollabCanvas capabilities through a connector/protocol layer. The integration should support read operations
CollabCanvas — Phase 1 Product Definition & Architecture Page 6 broadly and require explicit permission for mutations.
9.3 Model abstraction
A provider adapter layer should isolate model-specific APIs. The core application should not depend on one vendor. Provider configuration should include model identifier, credentials/reference, capability flags, rate limits, and context policy.
10. Agent Gateway
The Agent Gateway is the bridge between CollabCanvas and coding environments. Its purpose is to make the design system consumable from CLI/IDE agents without requiring the developer to manually export screenshots or copy CSS.
10.1 Read capabilities
Examples: get_project_manifest, get_design_tokens, get_component, get_template, get_page, get_asset, get_font, get_design_intent, get_version, list_projects.
10.2 Implementation capabilities
Examples: request_frontend_context, generate_framework_context, report_implementation_status, submit_visual_diff, request_design_clarification, propose_sync.
10.3 Mutation capabilities
Examples: create_design_version, propose_token_change, propose_component_change, attach_implementation_reference. Mutations should default to proposal/review mode.
10.4 Framework adapters
The gateway should eventually support adapters for React/Next.js, Vue/Nuxt, Svelte/SvelteKit and other common stacks. The adapter translates the canonical design model into framework-appropriate implementation guidance without changing the source design.
11. Authentication, Storage & Ownership
11.1 Authentication
Google OAuth is a strong initial option because the target workflow is developer-centric and Google identity is broadly available. The architecture should keep authentication provider-neutral so additional providers can be added later.
11.2 Authorization
Access should be scoped by workspace → project → resource. Roles can begin with Owner, Editor, Reviewer, and Viewer. API credentials for agents should be project-scoped wherever possible.
11.3 Storage
A relational database is appropriate for users, workspaces, projects, versions, permissions, integration metadata, and structured design entities. Object storage should hold large assets such as images, font files, exports, and generated artifacts.
11.4 Versioning
CollabCanvas — Phase 1 Product Definition & Architecture Page 7 Every approved design state should have an immutable version identifier. Drafts, proposals, approvals, implementation references, and rollbacks should remain auditable.
12. Security Model
Never treat business/project content supplied to an AI model as trusted instructions.
Keep provider secrets and OAuth credentials in a dedicated secret-management system; never store raw secrets in design documents.
Use scoped, revocable project credentials for coding-agent access.
Require explicit consent before an external agent can modify a project.
Log integration activity and design mutations without logging secret material.
Apply rate limits and quotas to AI integrations and agent endpoints.
Support revocation of connected agents independently of user login sessions.
13. MVP Boundary
The first implementation should prove the unique loop, not attempt to build the entire platform.
User authentication and one personal workspace
Project creation
Visual canvas with core layout/elements
Typography and design-token system
Reusable components
Save/version a project design
CollabCanvas Copilot for structured design operations
One external AI integration
One agent protocol/gateway
One coding-agent integration proof
Machine-readable project manifest
Frontend implementation example using the manifest
14. What Should Wait
Do not initially build every AI provider, every framework, team billing, enterprise permissions, marketplace infrastructure, advanced animation, full Figma parity, or autonomous two-way code synchronization. These are expansion layers after the core design-to-agent loop is proven.
15. Flagship Demonstration Scenario
A developer creates an application called InvoiceFlow. The developer is comfortable with backend architecture and application logic but wants a polished interface.
CollabCanvas — Phase 1 Product Definition & Architecture Page 8 Inside CollabCanvas, the developer chooses a typography system, defines a restrained color system, creates a dashboard shell, invoice table, action buttons, empty states, form components, and responsive rules. The Copilot helps refine the composition. ChatGPT is connected to inspect the page and suggest improvements. The developer approves Version 12 as the design baseline. The developer then opens Claude Code and connects the InvoiceFlow repository to CollabCanvas. Claude Code requests the project's design manifest. CollabCanvas returns the approved tokens, component definitions, templates, assets, typography, accessibility requirements, and design intent. Claude Code builds the frontend against that contract. Later, the developer changes the dashboard navigation in CollabCanvas. The system creates Version 13 and identifies the affected implementation surfaces. The coding agent receives a synchronization proposal rather than silently rewriting the application. The developer approves it, and the agent updates only the relevant frontend layer. This is the flagship story: CollabCanvas separates software construction from visual invention. The coding agent builds the application; CollabCanvas supplies the intentional visual system.
16. Long-Term Architecture Direction
Once the core loop works, CollabCanvas can evolve into a design context infrastructure layer. The same project design can be consumed by multiple coding agents, documentation systems, QA tools, accessibility checkers, and deployment workflows. A mature system could maintain a relationship graph between design decisions and implementation files: component → token → page → generated component → repository path → deployed route. This would make design changes explainable and synchronizable. The strongest long-term position is therefore not 'an AI canvas.' It is 'the design context layer for AI-built software.'
17. Phase Roadmap
Phase 1 — Foundation Product model, workspace, canvas primitives, tokens, components, versioning, machine-readable manifest. Phase 2 — Copilot Structured AI operations, design critique, intent capture, proposal/review workflow. Phase 3 — Agent Gateway Protocol/API, project-scoped credentials, coding-agent read access, first framework adapter. Phase 4 — Production Sync Implementation references, visual diffs, controlled synchronization, change impact analysis. Phase 5 — Ecosystem More AI providers, more coding agents, plugins/connectors, templates, team collaboration, marketplace possibilities.
18. Architectural Success Criteria
An ordinary developer can create a coherent visual system without using a traditional professional design suite.
CollabCanvas — Phase 1 Product Definition & Architecture Page 9
A connected AI assistant can inspect and help modify the design using structured project context.
A coding agent can retrieve the approved design system without screenshots or manual copy/paste.
The resulting frontend visibly follows the project's typography, spacing, components, layout, and interaction rules.
Design changes are versioned and can be intentionally synchronized into implementation.
External agents are isolated by scoped permissions and cannot silently take control of the project.
19. Final Product Thesis
CollabCanvas should become the place where a developer answers one question before asking an AI coding agent to build the interface: What should this software feel and look like? The coding agent remains extremely powerful. It can build the backend, application logic, APIs, database layer, tests, deployment configuration, and frontend implementation. CollabCanvas does not replace that agent. It gives the agent a durable visual contract to implement. That distinction is the foundation of the product. The goal is not to make AI coding agents less capable. The goal is to stop their default UI aesthetic from becoming the accidental design system of every application they build. North-star workflow: Design intentionally → encode the design → let AI understand it → build with it → validate it → version it → synchronize it.



Phase 2 — Technical Architecture & Data Model
Engineering blueprint: the internal model that makes CollabCanvas a persistent, machine-readable design intelligence layer for humans and AI coding agents.
Phase 1 established: product thesis, layered architecture, design-as-contract, agent gateway, security direction, MVP boundary.
Phase 2 establishes: domain entities, design graph, tokens, components, pages, assets, versioning, proposals, manifests, storage, authorization, consistency, and implementation boundaries.
Engineering blueprint: the internal model that makes CollabCanvas a persistent, machine-readable design intelligence layer for humans and AI coding agents. Phase 1 established: product thesis, layered architecture, design-as-contract, agent gateway, security direction, MVP boundary. Phase 2 establishes: domain entities, design graph, tokens, components, pages, assets, versioning, proposals, manifests, storage, authorization, consistency, and implementation boundaries.
1. Technical Objective
CollabCanvas should not store a canvas as pixels or raw editor coordinates. It should store a structured representation of a product's visual system: what exists, how it is composed, which tokens govern it, what states it supports, what intent drove decisions, and which version is approved. The core technical object is the Design Graph. The canvas is a view over that graph; the Copilot edits it through structured operations; coding agents consume a stable projection called the Design Manifest.
Human-readable and visually editable.
Machine-readable and deterministic.
Versioned and reviewable.
Composable through tokens and reusable components.
Semantic, including accessibility and design intent.
Framework-neutral at the canonical source layer.
2. System Boundaries
Boundary Owns Must not own Identity Users, sessions, identity Design semantics Workspace Projects, membership, settings Canvas rendering Project Design source and integrations Model-specific AI behavior Design Engine Pages, nodes, tokens, components, assets Authentication Copilot Intent interpretation, proposals Unrestricted DB writes Agent Gateway Machine access, capability policy Human session UI Storage Records and binary objects Business rules Framework Adapter Framework-specific projection Canonical design truth
3. Domain Hierarchy
User II Workspace II Members / Roles II Projects I II Design Documents I I II Pages I I II Frames / Sections I I II Nodes / Elements I I II Component Instances I II Design System I I II Tokens I I II Typography I I II Components I I II Templates I I II Assets / Fonts I II Versions / Proposals I II Integrations / Agent Credentials II Audit Events Workspace is the ownership boundary; project is the primary design and agent boundary.
4. Identity, Workspace and Project Model
Entity Key fields Purpose User id, email, display_name, auth_provider Human identity Workspace id, name, slug, owner_id Collaboration/ownership Membership workspace_id, user_id, role, status Authorization Project id, workspace_id, name, slug, status Product/design boundary ProjectMember project_id, user_id, role Optional project permissions Roles
Owner — control and credential management.
Editor — modify design and create proposals.
Reviewer — approve/reject proposals.
Viewer — read-only.
Agent — non-human principal with explicit capabilities. Agent credentials should not inherit unrestricted Owner power.
5. Design Graph
The Design Graph is canonical. Rendering data exists to support editing and implementation, but semantics and relationships are primary.
DesignNode {
id, document_id, parent_id, type, name, order_index
layout, style_refs, properties, semantic, constraints
interactions, component_ref, instance_overrides
}
A CTA is represented as a semantic action, not merely a rectangle at x/y.
Text carries typography, role, content intent, and responsive behavior.
Images reference assets and carry alt text/focal behavior.
Component instances reference definitions rather than duplicating them.
6. Design Tokens
Tokens are the stable vocabulary of the visual system and the first defense against generic AI-generated styling. Category Examples Color color.background.canvas; color.text.primary; color.action.primary Typography font.family.body; type.heading.1; type.body.md Spacing space.1; space.2; space.4; space.8 Radius radius.sm; radius.md; radius.full Shadow/Border shadow.card; border.subtle; border.focus Motion motion.fast; motion.standard Layout container.max; grid.columns; breakpoint.md
DesignToken {
id, project_id, namespace, name, type, value
description, mode, deprecated
}
Token values should be typed. Color, spacing, typography, and layout values should not be interchangeable arbitrary strings.
7. Components
A component definition is the reusable semantic building block an agent should consume—not merely a screenshot of a control.
ComponentDefinition {
id, project_id, name, description
anatomy, variants, props, states
constraints, accessibility, token_refs
usage_guidance, status
}
Anatomy — named parts.
Variants — size, tone, density, etc.
States — default, hover, focus, active, disabled, loading, error.
Constraints — sizing, placement, responsive rules.
Accessibility — roles, keyboard behavior, focus expectations.
Usage guidance — when and why to use it.
8. Pages, Templates, Assets and Fonts
Page {
id, document_id, name, route_hint
viewport_profiles, root_node_id, page_intent, status
}
Pages are product surfaces. Templates are reusable page-level compositions. Both reference reusable components and tokens. Resource Storage Metadata Image Object storage + DB dimensions, mime, alt text, focal point, hash Icon Vector/object record name, viewBox, usage Font Object storage + DB family, weights, styles, license Export Object storage format, source version, generated_at Binary content belongs in object storage; relational records own identity, metadata, references, and lifecycle.
9. Layout and Responsive Model
The model should describe constraints rather than force an agent to reproduce editor coordinates.
LayoutSpec {
display, direction, gap, padding, alignment
sizing, position, responsive
}
Responsive behavior must be explicit—for example, a four-column desktop grid becoming two columns on tablet and one on mobile.
10. Design Intent
Design intent is a first-class entity. It preserves the why behind decisions that screenshots and raw CSS cannot reliably recover.
DesignIntent {
id, target_type, target_id, statement
priority, rationale, created_by
}
Example: “Primary actions should be visually dominant without competing with the page title.” An implementation agent can use this to choose between otherwise valid implementations.
11. Versioning
Approved design state must not be silently overwritten. Versions provide stable implementation targets. State Meaning Draft Editable working state Proposal Change set awaiting review Approved Stable design contract Superseded Replaced by a newer approved version Archived Historical, non-active state
DesignVersion {
id, project_id, parent_version_id, number
status, created_by, change_summary
manifest_hash, created_at, approved_at
}
Every approved version should have a deterministic manifest hash.
12. Change Sets and Proposal-First AI
AI should generally propose structured changes rather than directly mutate approved design state.
ChangeSet {
id, project_id, base_version_id
author, operations, rationale, status
}
Operations may include create_node, update_node, move_node, create_token, update_token, create_component, update_component, attach_asset, update_intent, and delete_node. This creates a deliberate boundary between AI suggestion and canonical design state.
13. Design Manifest
The Design Manifest is the primary machine contract consumed by coding agents. It is a deterministic, versioned projection of the approved Design Graph. { manifest_version, project, version, design_tokens,
typography, components, templates, pages, assets, fonts, design_intents, implementation_guidance }
Same approved data → same manifest hash.
All references must resolve.
Historical entities remain traceable.
No credentials or secrets appear in manifests.
Provider-specific AI output is never canonical design state.
14. Storage Strategy
Storage Use PostgreSQL Users, workspaces, permissions, projects, design graph, versions, proposals, audit metadata Object storage Images, fonts, exports, large generated artifacts Cache Short-lived manifest/session acceleration Search index Optional later project-wide discovery Secrets manager OAuth secrets, provider credentials, encryption material A relational database is the right initial source of truth because the domain is highly relational and versioned. JSON fields should be used for genuinely extensible structures, not to hide the entire product inside one blob.
15. Consistency and Transactions
Version creation/approval is transactional.
Approved versions reference immutable snapshots or equivalent immutable state.
Every proposal declares its base version.
Applying a proposal against a changed base requires conflict detection.
Asset upload follows upload → validate → attach.
Referenced historical entities should be retained or soft-deleted.
16. Audit Model
AuditEvent {
id, workspace_id, project_id
actor_type, actor_id, action
resource_type, resource_id, metadata, created_at
}
Audit events must make agent activity explainable without storing secrets or unnecessary sensitive prompt content.
17. Integration and Credential Model
Entity Purpose Scope Integration Configured connector/provider Workspace or project AgentCredential Machine access credential Prefer project CapabilityGrant Allowed operations Credential/resource WebhookSubscription Outbound events Project ProviderConnection OAuth/API connection User/workspace/project Credentials must be revocable and rotatable. Secrets belong in a secret store, never ordinary design tables.
18. Agent Gateway Surface
The gateway should be intentionally small. Reads can be broad; mutations are explicit and capability-controlled. Class Examples Discovery list_projects, get_project Design read get_manifest, get_page, get_component, get_tokens, get_asset Reasoning get_design_intent, compare_versions, explain_component Implementation get_framework_context, report_implementation_status Proposal propose_token_change, propose_component_change, propose_page_change Approval approve_proposal, reject_proposal Sync propose_sync, get_sync_status Coding agents should never receive raw database access. The gateway is the policy and translation boundary.
19. Optimistic Conflict Detection
Agent starts from Version 17 proposes changes X Current approved version = 18 Gateway: reject automatic apply return VERSION_CONFLICT provide relevant diff/context require rebase or review This prevents an older coding agent from overwriting a newer design decision.
20. Framework Adapter Contract
Framework adapters turn the canonical manifest into implementation guidance. Framework assumptions must not leak into the source-of-truth model.
FrameworkAdapter {
id, framework, version
generate_context(manifest)
map_component(component)
map_tokens(tokens)
map_assets(assets)
validate(project)
}
The first adapter can target React/Next.js for proof, while keeping the canonical model framework-neutral.
21. Core End-to-End Flow
1. Create InvoiceFlow project.
2. Build pages, nodes, tokens, typography and components.
3. Copilot proposes a pricing-card change.
4. User approves ChangeSet #12.
5. System creates Approved Version 8.
6. Manifest is generated and hashed.
7. Coding agent authenticates with project credential.
8. Agent retrieves Version 8 manifest.
9. Framework adapter generates implementation context.
10. Agent implements frontend.
11. Agent reports status / optional visual diff.
12. User approves Version 9 after a design change.
13. Agent detects Version 8 → 9 delta.
14. Agent proposes affected implementation changes.
15. User approves sync where required.
Core loop: design → encode → approve → consume → implement → validate → version → synchronize.
22. API Boundary Principles
Use stable resource IDs, not editor coordinates as identity.
Return explicit version information on reads.
Support partial retrieval and full-manifest retrieval.
Separate read, proposal, and mutation capabilities.
Use machine-readable errors with remediation hints.
Use idempotency keys for mutations.
Include correlation IDs for agent operations.
23. Suggested Relational Schema
users workspaces workspace_members projects project_members design_documents pages design_nodes design_tokens token_modes component_definitions component_variants component_props component_states templates assets fonts design_intents design_versions version_nodes version_tokens version_components change_sets change_operations integrations provider_connections agent_credentials
capability_grants webhook_subscriptions implementation_links audit_events Normalization can be tuned during implementation. High-value entities should remain queryable; JSON is for genuinely flexible structures.
24. Example Component Payload
{
"id": "cmp_invoice_primary_button",
"name": "PrimaryButton",
"variants": {"size":["sm","md","lg"],"tone":["brand","danger"]},
"states": ["default","hover","focus","disabled","loading"],
"tokens": {
"background":"color.action.primary",
"text":"color.text.onAction",
"radius":"radius.md",
"paddingX":"space.4"
},
"accessibility":{"keyboard":"native-button","focus_visible":true},
"intent":"Primary actions should be visually dominant without competing with the page title."
}
25. Example Page Context
{
"page":"dashboard",
"intent":"Give operators an immediate view of financial health and outstanding work.",
"layout":{"desktop":"12-column grid","tablet":"6-column grid","mobile":"single column"},
"sections":["summary_metrics","activity","outstanding_invoices"],
"components":["MetricCard","StatusBadge","DataTable","PrimaryButton"]
}
26. Security Requirements
Authorize every protected resource at workspace/project scope.
Use project-scoped agent credentials by default.
Use capability grants for mutations.
Keep secrets outside design records.
Encrypt data in transit and at rest.
Audit agent mutations and approvals.
Rate-limit machine credentials independently.
Treat imported text and AI output as untrusted input.
Validate uploaded assets and file types.
Protect agent-configurable callbacks against SSRF.
27. MVP Technical Boundary
Build now Defer OAuth/identity + personal workspace Enterprise SSO
Build now Defer Projects + structured canvas Figma-level parity Tokens + typography + components Advanced motion Versioning + proposals Autonomous two-way sync Manifest API + agent gateway Every AI provider One framework adapter Every framework Copilot structured operations Fully autonomous design agent Audit + conflict handling Marketplace/billing
28. Implementation Order
Step Deliverable 1 Auth, workspace and project foundation 2 Canonical schema + migrations 3 Canvas persistence 4 Tokens, typography and components 5 Version snapshots + change sets 6 Deterministic manifest generator 7 Manifest API + agent authentication 8 First framework adapter 9 Copilot proposal engine 10 Real coding-agent proof 11 Audit, security and conflict handling 12 Production hardening
29. Acceptance Criteria
A user can create and save a structured project design.
Projects support reusable tokens, components, pages, assets and typography.
Approved versions produce deterministic manifests.
A coding agent can retrieve a manifest using a project-scoped credential.
The agent can understand layout, components, tokens, accessibility and intent without relying on a screenshot.
AI changes can be proposed without silently altering approved state.
Stale changes are detected rather than overwritten.
Consequential agent actions are auditable.
A real frontend can be implemented with materially less generic UI drift.
30. Architectural Decisions
Decision Choice Reason Canonical model Design Graph Preserves semantics and relationships Source of truth Relational DB Queryable, transactional, versionable Binary assets Object storage Efficient/scalable Exchange Versioned Manifest Stable agent contract AI mutations Proposal-first Human control + audit Concurrency Optimistic versioning Prevents stale overwrites Agent access Gateway + scoped capabilities Security + abstraction Framework coupling Adapters Keeps core model portable Reasoning memory Design Intent Preserves why, not only what
31. What Phase 2 Establishes
CollabCanvas is not a canvas with AI attached. It is a structured design system whose canvas, Copilot, APIs and coding-agent integrations are different interfaces over the same source of truth. The technical differentiator is persistence of structured design knowledge: semantics, components, tokens, intent, constraints and version history can travel through a stable contract to different coding agents.
32. Phase 3 Dependency
Phase 3 should define the API, WebMCP and Agent Gateway specification: exact tools/endpoints, request/response schemas, authentication flows, capability scopes, error codes, webhooks, idempotency and the contract used by Claude Code, Codex, OpenCode and other agents. Phase 2 defines what CollabCanvas knows. Phase 3 defines how outside agents talk to it.


Phase 3 — API, WebMCP & Agent Gateway Specification
Purpose: define the machine-facing contract through which ChatGPT, Claude, coding agents, WebMCP clients and future integrations can safely discover, read, propose and synchronize CollabCanvas design data.
Depends on: Phase 2 — Design Graph, versioning, manifests, capability grants and project-scoped credentials.
Core principle: external agents interact with a stable gateway, never with CollabCanvas's internal database.
Purpose: define the machine-facing contract through which ChatGPT, Claude, coding agents, WebMCP clients and future integrations can safely discover, read, propose and synchronize CollabCanvas design data. Depends on: Phase 2 — Design Graph, versioning, manifests, capability grants and project-scoped credentials. Core principle: external agents interact with a stable gateway, never with CollabCanvas's internal database.
1. API Philosophy
CollabCanvas needs two complementary interfaces: a conventional HTTP API for applications and a tool-oriented agent interface for AI systems. Both must operate on the same underlying domain contract.
HTTP API = deterministic application/integration surface.
WebMCP/MCP-style tools = agent-friendly capability surface.
Design Manifest = canonical read contract.
ChangeSet = canonical proposed-change contract.
Version ID = synchronization anchor.
Capability scope = authorization boundary.
2. Gateway Architecture
Human UI / Copilot I III REST / JSON API I III WebMCP / Agent Tools I IIIIIIIMIIIIIII I Agent I I Gateway I IIIIIIIIIIIIIII I AuthN/AuthZ I I Capability I I Validation I I Rate Limit I I Audit I I Translation I IIIIIIIIIIIIIII I Domain Services I Design Graph / DB I Object Storage The gateway is a policy-enforcing façade, not a thin proxy.
3. Principal Types
Principal Authentication Typical permissions User OAuth/session Human UI operations Copilot Internal service identity Propose design operations Agent Project credential/token Explicit granted capabilities System Internal service identity Versioning, events, jobs The principal is attached to every consequential operation and propagated into audit records.
4. Authentication Model
Initial authentication can use OAuth for humans and scoped bearer credentials for agents. The exact identity provider should remain replaceable.
Human: OAuth → application session → workspace/project authorization Agent: project_id + credential → credential verification → capability evaluation → request execution
Agent secrets are shown only at creation/rotation.
Store credential hashes where practical; never log raw credentials.
Credentials are revocable and rotatable.
Default agent scope is one project.
Short-lived exchange tokens can be added later for higher-security environments.
5. Capability Model
Capabilities are more precise than roles. A coding agent may need to read components and submit implementation status but should not automatically receive permission to alter approved design. Capability Description project.read Read project metadata manifest.read Read approved design manifest design.read Read pages, nodes, components, tokens asset.read Read asset metadata/content references proposal.create Submit design change proposals proposal.read Read proposal status/diffs implementation.write Report implementation status sync.propose Submit implementation/design sync proposals version.read Read version metadata/diffs webhook.manage Manage project event subscriptions
6. REST API Namespace
/api/v1 /workspaces /projects /projects/{project_id}/manifest /projects/{project_id}/pages /projects/{project_id}/components /projects/{project_id}/tokens /projects/{project_id}/assets /projects/{project_id}/versions /projects/{project_id}/proposals /projects/{project_id}/integrations /projects/{project_id}/agent-credentials /projects/{project_id}/implementation /projects/{project_id}/webhooks Version the public API independently from the internal database schema.
7. Standard Response Envelope
{
"data": {...},
"meta": {
"request_id": "req_...",
"api_version": "v1"
}
} List endpoints should additionally return pagination information. Errors use a stable machine-readable error object.
8. Error Contract
{
"error": {
"code": "VERSION_CONFLICT",
"message": "The proposal is based on an older approved version.",
"request_id": "req_...",
"details": {
"base_version": 17,
"current_version": 18
}
} } Code Meaning UNAUTHENTICATED Credential/session missing or invalid FORBIDDEN Principal lacks capability NOT_FOUND Resource unavailable to principal VALIDATION_ERROR Payload violates schema VERSION_CONFLICT Base version is stale RATE_LIMITED Capability quota exceeded IDEMPOTENCY_CONFLICT Same key used with different request INTEGRATION_ERROR Downstream provider failure INTERNAL_ERROR Unexpected server failure
9. Manifest Retrieval
The manifest is the most important read operation for coding agents. GET /api/v1/projects/{project_id}/manifest ?version=approved ?include=pages,components,tokens,assets,intents ?page_id=... Response: manifest_version project version tokens typography components pages templates assets fonts intents implementation_guidance manifest_hash Agents should be able to retrieve the complete manifest or a scoped subset to reduce context size.
10. Page and Component Reads
GET /projects/{id}/pages/{page_id} GET /projects/{id}/components/{component_id} GET /projects/{id}/tokens GET /projects/{id}/assets/{asset_id} GET /projects/{id}/versions/{version_id} Every design read should identify the source version so the agent knows exactly which design state it consumed.
11. WebMCP Tool Surface
The WebMCP surface should expose semantic tools rather than mirror every REST endpoint. Tool Purpose Default mode list_projects Discover accessible projects read get_project Read project metadata read get_manifest Retrieve design contract read get_page Retrieve page context read get_component Retrieve component definition read get_tokens Retrieve token system read get_asset Retrieve asset metadata/reference read get_design_intent Retrieve design reasoning read compare_versions Explain design delta read propose_change Submit structured change set proposal get_proposal Inspect proposal read report_implementation_status Report agent progress write propose_sync Request implementation/design synchronization proposal
12. WebMCP Tool: get_manifest
Input
{
"project_id": "proj_123",
"version": "approved",
"scope": {
"pages": ["dashboard"],
"components": ["PrimaryButton"]
}
} Output
{
"version": 8,
"manifest_hash": "sha256:...",
"manifest": {...}
}
The tool should fail clearly when a requested version does not exist or the principal lacks access.
13. WebMCP Tool: get_component
Input
{
"project_id": "proj_123",

"component_id": "cmp_primary_button"
}
Output
{
"component": {...},
"source_version": 8,
"implementation_guidance": {...}
}
Implementation guidance can contain framework-neutral semantics plus an adapter-specific projection when requested.
14. WebMCP Tool: propose_change
Input
{
"project_id": "proj_123",
"base_version": 8,
"rationale": "Increase CTA prominence on checkout.",
"operations": [
{
"type": "update_token",
"target": "color.action.primary",
"change": {...}
}
] } Output { "proposal_id": "prop_456", "status": "proposed", "base_version": 8, "validation": {...} } Proposal creation must not mutate the approved version.
15. Proposal Lifecycle
proposed I III rejected I III approved I M applied I M new version A proposal may be automatically validated but should require an approval policy appropriate to the capability and workspace.
16. Approval Policies
Policy Use Human required Default for changes to approved design Auto-approve low-risk Optional for tightly scoped token/documentation changes Agent-only proposal Agent may suggest but cannot approve Owner required Sensitive integration/security changes
The system should make approval policy explicit rather than hiding it inside provider-specific AI behavior.
17. Idempotency
Mutation endpoints and tools should accept an idempotency key. Idempotency-Key: 8b7e... First request: → proposal prop_456 Retry with same key: → same proposal prop_456 Same key + different payload: → IDEMPOTENCY_CONFLICT This matters because agent runtimes may retry network operations automatically.
18. Rate Limits
Principal Suggested initial policy Human session Generous interactive quota Copilot Per-user/project model-call quota Agent credential Per-project requests/minute + mutation quota Webhook delivery Per-project delivery rate + retry budget Exact limits should be configurable; the important architecture is that machine activity can be isolated from human traffic.
19. Webhooks / Events
Webhooks provide the asynchronous bridge between CollabCanvas and external implementation agents. Event Meaning design.version.approved New approved design exists design.proposal.created Proposal requires review design.proposal.approved Proposal was approved design.proposal.rejected Proposal was rejected implementation.status.updated Agent reported implementation state sync.requested Synchronization work is available integration.revoked Connection/credential was revoked
{
"event_id": "evt_...",
"event_type": "design.version.approved",
"project_id": "proj_123",
"version_id": "ver_9",
"occurred_at": "...",
"data": {...}
}
20. Webhook Security
Sign outbound webhook payloads.
Include event IDs for deduplication.
Support retry with exponential backoff.
Do not include secrets in payloads.
Allow endpoint rotation/revocation.
Protect callback configuration against SSRF.
Expose delivery status without exposing secret material.
21. Sync Protocol
The synchronization protocol connects an approved design version with implementation state. Design: Version 8 IIIIIIIIIIIIIII Agent implementation Design changes: Version 9 I M compare(8, 9) I M affected components/pages/tokens I M agent proposes implementation update I M human / policy approval I M implementation status The first release should be proposal-driven, not autonomous bidirectional rewriting.
22. Implementation Status Contract
{
"project_id": "proj_123",
"agent": "codex-session-...",
"design_version": 8,
"repository": "invoiceflow",
"commit": "abc123",
"status": "implemented",
"surfaces": ["dashboard","billing"],
"notes": "...",
"reported_at": "..."
}
Implementation links create traceability from design version to repository commit or deployment.
23. Design Diff Contract
A diff should be semantic rather than only visual.
{
"from_version": 8,
"to_version": 9,
"changes": [
{"type":"token_changed","target":"space.4"},
{"type":"component_changed","target":"PrimaryButton"},
{"type":"page_changed","target":"checkout"}
],
"affected_implementation_surfaces": [

"components/Button.tsx",
"app/checkout/page.tsx"
]
}
Affected files are advisory unless the connected implementation system has enough repository knowledge to verify them.
24. Agent Session Model
An agent session should have a short-lived execution identity even when backed by a long-lived project credential. AgentCredential ↓ AgentSession ↓ request_id / correlation_id ↓ tool invocation ↓ audit event
Sessions can expire.
Credential can be revoked while sessions are checked at policy boundaries.
Every request carries correlation metadata.
25. External AI Provider Boundary
ChatGPT, Claude, Gemini, and other providers should not be first-class database concepts in the core design model. They are clients/providers behind integration adapters. Provider Adapter II authentication II model selection II prompt/context assembly II tool registration II response normalization This prevents the product from becoming architecturally dependent on a single AI vendor.
26. Copilot vs External Agent
Capability CollabCanvas Copilot External coding agent Read design Yes Yes Propose design changes Yes With grant Approve design Policy-dependent Normally no Implement code No Yes Report implementation Optional Yes Access repository No by default Yes, outside CollabCanvas Access secrets No No CollabCanvas secrets
27. Security Threat Model
Threat Control Stolen agent credential Revocation, rotation, project scope, rate limits
Threat Control Prompt/tool injection Treat external text as untrusted; validate operations Privilege escalation Capability checks on every request Stale agent overwrite Base-version validation Replay Idempotency keys + event IDs Webhook spoofing Signed payloads Data leakage Scoped reads + manifest redaction SSRF Validate outbound callback destinations Malicious asset File validation, size/type limits, scanning
28. Audit Requirements
At minimum record: actor, capability, project, resource, operation, base version, result, request ID, timestamp and proposal/version IDs where applicable. Never record raw API credentials, access tokens, or unnecessary sensitive provider content.
29. API Versioning Strategy
Public API uses /v1, /v2 style versioning.
Manifest has its own manifest_version.
WebMCP tool schemas have explicit tool versions when breaking changes occur.
Database migrations remain an internal implementation concern.
Backward-compatible fields may be added without a major API version.
30. Example: Coding Agent Session
Agent authenticates ↓ list_projects() ↓ get_project("invoiceflow") ↓ get_manifest(version="approved") ↓ get_component("PrimaryButton") ↓ get_design_intent(page="checkout") ↓ Agent implements frontend ↓ report_implementation_status() ↓ Later: design.version.approved(version=9) ↓ compare_versions(8,9) ↓ propose_sync() ↓ human/policy approval This is the concrete path by which CollabCanvas becomes the design context layer for AI-built software.
31. MVP Gateway Boundary
Implement first Later Project-scoped agent credential Short-lived OAuth exchange Manifest read Semantic search across all projects Page/component/token reads Advanced query language Proposal creation Autonomous mutation Version comparison Continuous bidirectional sync Implementation status Deep repository introspection Signed webhooks Event streaming platform One WebMCP surface Broad tool marketplace
32. Phase 3 Acceptance Criteria
An external agent can authenticate to exactly one project.
The agent can retrieve the approved manifest and scoped design resources.
Every design read identifies its source version.
The agent can submit a structured proposal without changing approved state.
A stale proposal is rejected with VERSION_CONFLICT.
Mutations support idempotency.
Agent activity is auditable.
Webhook events can notify an implementation system of approved design changes.
A coding agent can complete the InvoiceFlow proof using only the documented gateway contract.
No external agent receives direct database access.
33. Phase 4 Dependency
Phase 4 should define the actual Product UX, AI Copilot and Implementation Workflow: canvas interaction model, project navigation, Copilot UX, structured editing operations, review/approval screens, agent connection experience, design-to-code workflow, visual validation and the complete user journey. Phase 2 defined what CollabCanvas knows. Phase 3 defines how machines communicate with it. Phase 4 defines how humans experience and operate that system.


Phase 4 — Product UX, AI Copilot & Implementation Workflow
Purpose: define how a developer experiences CollabCanvas from first login through visual design, AI-assisted refinement, approval, coding-agent handoff, implementation validation, and synchronization.
Depends on: Phase 2 Design Graph and Phase 3 API/WebMCP/Agent Gateway.
Core principle: the interface should make structured design intelligence feel simple; complexity belongs behind the canvas, not in front of the developer.
## 1. Product Experience Thesis
CollabCanvas should feel less like a traditional design suite and more like a developer's visual control plane. The user is
not being asked to become a professional UI designer. They are expressing what their product should look and behave
like, while CollabCanvas turns those decisions into reusable, machine-readable design context.
Visual first: users can design without writing CSS.
Semantic by default: every meaningful visual decision becomes structured data.
AI is a collaborator, not an autonomous owner.
Approved design becomes a stable contract for coding agents.
The same project remains the source of truth from design through implementation.
## 2. Primary User Journey
Login
↓
Workspace
↓
Create / open Project
↓
Define visual foundation
↓
Build page visually
↓
Copilot refinement
↓
Review proposed changes
↓
Approve Design Version
↓
Connect coding agent
↓
Agent reads Design Manifest
↓
Agent implements frontend
↓
Validate / report
↓
Design changes
↓
Semantic diff
↓
Sync proposal
↓
Approve / implement
## 3. Application Shell

| Area | Purpose |
|---|---|
| Workspace switcher | Move between personal/team workspaces |
| Project navigation | Design, system, versions, integrations |
| Canvas | Primary visual editing surface |
| Inspector | Selected element/component properties |
| Copilot panel | Natural-language design collaboration |
| Version control | Draft/proposal/approved state and history |
| Agent center | Connections, credentials, implementation status |
| Preview | Responsive/live product view |

## 4. Project Home

| Card | Information |
|---|---|
| Current design | Approved version, last update, author |
| Implementation | Connected repository/agent, commit, status |
| Changes | Pending proposals and unresolved conflicts |
| Design system | Token/component counts, health |
| Recent activity | Human and agent actions |

## 5. Canvas Model

The canvas is the visual editor over the Design Graph. It should prioritize composition and intent rather than expose every

low-level CSS property immediately.

- Infinite or bounded working canvas depending on implementation constraints.
- Frames/sections for page composition.
- Direct manipulation for layout, spacing, sizing and hierarchy.
- Contextual toolbar for common actions.
- Inspector for exact values and references.
- Component creation from selected structures.
- Token assignment instead of repeated raw values.
- Responsive viewport switching.
## 6. Inspector Design

| Priority | Inspector content |
|---|---|
| 1 | Semantic role / element type |
| 2 | Content and component properties |
| 3 | Layout constraints |
| 4 | Token references |
| 5 | Responsive behavior |
| 6 | Accessibility |
| 7 | Advanced implementation details |

## 7. Design System Workspace

A dedicated Design System area should expose the reusable vocabulary of the project.

- Tokens — color, spacing, type, radius, shadow, motion, layout.
- Typography — families, weights, scales and usage rules.
- Components — anatomy, variants, states and accessibility.
- Assets — images, icons, fonts and metadata.
- Templates — reusable page structures.
- Intent — rationale and design principles.
## 8. Creating a Component

Select visual structure

↓

“Create component”

↓

Name + semantic purpose

↓

Identify variants / states

↓

Bind tokens

↓

Define accessibility behavior

↓

Add usage guidance

↓

Preview

↓

Save draft

↓

Approve / include in version

Component creation should feel lightweight while producing a rich underlying definition.

## 9. AI Copilot Positioning

The Copilot is not a chat box bolted onto the side of a canvas. It is an interface to structured design operations.

A user can say: “Make the dashboard feel calmer, reduce visual competition between the cards, and make the primary

action more obvious.” The Copilot should inspect the relevant design context, propose concrete changes, explain them,

and let the user approve or reject them.

- Inspect current design.
- Infer relevant tokens/components/pages.
- Generate structured operations.
- Show visual preview/diff.
- Explain rationale.
- Allow selective approval.
- Create a new version after approval.
## 10. Copilot Context Assembly

User request

+

Current selection

+

Page context

+

Relevant components

+

Design tokens

+

Design intent

+

Recent approved version

+

Relevant history

↓

Context Builder

↓

AI Provider

↓

Structured Design Operations

↓

Validator

↓

Proposal / Preview

Context should be assembled selectively. Sending the entire workspace to every model call is wasteful and increases the

risk of irrelevant reasoning.

## 11. Copilot Operation Types

| Operation | Example |
|---|---|
| create | Create a pricing card component |
| update | Change button radius token |
| move | Reorder dashboard sections |
| replace | Swap component variant |
| bind | Connect raw color to token |
| derive | Create a mobile layout rule |
| explain | Explain why a component uses a token |
| compare | Compare current page with approved version |

## 12. Proposal UX

Every consequential Copilot change should appear as a proposal rather than silently modifying approved design.

Copilot:

“I recommend reducing card padding from 24 → 20

and changing the dashboard grid from 3 → 4 columns.”

[Preview] [Apply] [Reject] [Edit]

- Show affected resources.
- Show visual preview.
- Show semantic diff.
- Show rationale.
- Show estimated implementation impact where available.
## 13. Selective Approval

| Action | Result |
|---|---|
| Approve all | Apply entire ChangeSet |
| Approve selected | Apply selected operations |
| Reject | Discard proposal |
| Edit | Modify proposal before approval |
| Ask Copilot | Request alternative |

## 14. Version UX

Versioning should feel like a normal part of product development, not database administration.

Draft

↓

Review

↓

Approved v8

↓

Implemented

↓

Design change

↓

Proposal

↓

Approved v9

↓

Implementation update

The user should always be able to answer: Which design did the code implement?

## 15. Agent Connection UX

Connecting a coding agent should be a guided project-level action.

Project → Agent Center

↓

“Connect coding agent”

↓

Choose agent/runtime

↓

Select capabilities

↓

Generate / authorize credential

↓

Show setup instructions

↓

Test connection

↓

Connected

↓

Agent can request manifest

The UI should never require users to understand OAuth internals, capability tokens, or gateway implementation details.

## 16. Agent Setup Experience

| Screen | User sees |
|---|---|
| Choose agent | Supported coding agent/runtime options |
| Scope | Project + selected capabilities |
| Credential | One-time secret reveal |
| Instructions | Copyable setup/configuration |
| Test | Connection + manifest read test |
| Status | Connected / revoked / expired |

## 17. Coding-Agent Handoff

The handoff should be explicit and project-aware. The user should be able to say, in effect: “Build this project using the

approved design.”

Approved Version 8

↓

Generate manifest

↓

Agent retrieves manifest

↓

Agent retrieves relevant pages/components

↓

Framework adapter context

↓

Coding agent implementation

↓

Implementation status

↓

User reviews live result

## 18. Implementation Context

The agent should receive more than styles. Context should contain:

- Visual system and tokens.
- Component definitions and states.
- Page hierarchy.
- Responsive constraints.
- Accessibility requirements.
- Design intent.
- Asset references.
- Implementation guidance.
- Current approved version and manifest hash.
## 19. Preventing Generic AI UI

| Failure | CollabCanvas response |
|---|---|
| Agent invents colors | Token contract supplies approved values |
| Agent invents typography | Font/type system is explicit |
| Agent creates generic cards | Component definitions provide approved anatomy |
| Agent ignores mobile | Responsive constraints are explicit |
| Agent misunderstands hierarchy | Page intent + semantic structure |
| Agent replaces components | Usage guidance + implementation mapping |
| Agent drifts over time | Version and sync system detects changes |

## 20. Preview and Validation

The system should provide a preview loop before implementation and a validation loop after implementation.

Design preview

↓

Approve

↓

Implementation

↓

Live preview / screenshot

↓

Compare against design

↓

Semantic + visual findings

↓

Fix / propose change

↓

Revalidate

The initial product can use human review and simple visual comparison. More advanced automated visual evaluation can

come later.

## 21. Visual Diff

| Diff | Best for |
|---|---|
| Visual | Spacing, hierarchy, typography, alignment |
| Semantic | Token/component/page changes |
| Implementation | Which repository surfaces may be affected |

## 22. Implementation Status

Connected

↓

Reading design

↓

Implementing

↓

Validation

↓

Implemented

↓

Drift detected

↓

Sync proposed

Status should be informational first. CollabCanvas should not pretend to own the coding agent's entire runtime.

## 23. Repository Linkage

An implementation link associates an approved design version with repository evidence.

```text
ImplementationLink {
project_id
design_version
repository
branch
commit
environment
status
reported_by
reported_at
}
This creates a traceable chain from visual decision → design version → code commit → deployed implementation.
24. External AI Collaboration
External AI assistants can participate at different levels.
Mode
Example
Read-only advisor
Claude reviews current design and suggests improvements
Copilot collaborator
ChatGPT proposes structured changes
Design editor
Authorized AI creates a proposal
Implementation agent
Codex/Claude Code builds frontend
Validator
Agent reports mismatch or implementation issue
The same gateway contract prevents each provider from requiring a separate internal architecture.
25. Multi-Agent Future
CollabCanvas
III Design Copilot
III Review Agent
III Coding Agent
III Accessibility Agent
III QA / Visual Validation Agent
I
M
Shared Design Contract
This becomes possible because the Design Graph and Manifest are shared infrastructure.
26. UX Safety Boundaries
No silent approved-design mutations by AI.
Always display the target project before agent actions.
Make credential scope visible.
Make version being edited visible.
Warn on stale proposals.
Require explicit approval for destructive operations.
Provide rollback to previous approved versions.
Clearly distinguish AI suggestions from human-approved state.
27. Empty and Failure States
Situation
UX behavior
No project
Offer guided project creation
No design system
Suggest establishing tokens/type first
No approved version
Explain why agents cannot consume stable design yet
Agent disconnected
Show reconnect/revoke path
Version conflict
Explain base/current versions and offer rebase
Copilot failure
Preserve user state and allow retry
Implementation drift
Show affected surfaces and proposed next step
28. Information Architecture
Workspace
III Home
III Projects
I III Project
I III Canvas
I III Pages
I III Design System
I I III Tokens
I I III Typography
I I III Components
I I III Assets
I I III Templates
I III Copilot
I III Versions
I III Agent Center
I III Implementation
III Settings
## 29. MVP UX Boundary

| Build now | Defer |
|---|---|
| Simple workspace/project navigation | Complex team hierarchy |
| Canvas + inspector | Full professional design-suite parity |
| Tokens + components | Advanced animation editor |
| Copilot proposals | Autonomous design agent |
| Version review | Complex branching/merging |
| One agent connection | Marketplace of agents |
| Manifest/implementation status | Deep automated visual QA |
| Responsive preview | Advanced prototyping system |

## 30. MVP “Magic Moment”

The product should be designed around one unforgettable proof:

User:

“Build my SaaS dashboard design.”

CollabCanvas:

visual design + tokens + components

User:

“Make it feel more premium and less generic.”

Copilot:

proposes structured changes

User:

Approves Version 8

User:

Connects coding agent

Agent:

“I have the approved design contract.

I’ll implement the dashboard using these

components, tokens and responsive rules.”

Result:

Live application matches the intentional design

instead of a generic AI-generated dashboard.

If this loop works reliably, the product thesis is proven.

## 31. Full InvoiceFlow Scenario

## 1. Create InvoiceFlow.

## 2. Define Inter/brand typography and spacing scale.

## 3. Build dashboard shell.

## 4. Create MetricCard, InvoiceTable, StatusBadge, PrimaryButton.

## 5. Define desktop/tablet/mobile constraints.

## 6. Add design intents.

## 7. Ask Copilot to refine hierarchy.

## 8. Review proposal.

## 9. Approve Version 8.

## 10. Connect coding agent.

## 11. Agent retrieves manifest.

## 12. Agent implements Next.js frontend.

## 13. Agent reports commit.

## 14. User reviews live app.

## 15. User changes PrimaryButton in CollabCanvas.

## 16. Approve Version 9.

## 17. System identifies affected component surfaces.

## 18. Agent proposes implementation sync.

## 19. User approves.

## 20. Agent updates affected code only.

This is the end-to-end product behavior the architecture should optimize for.

## 32. Product Metrics

| Metric | Why it matters |
|---|---|
| Time to first intentional design | Measures onboarding value |
| % of projects with approved design | Measures source-of-truth adoption |
| Manifest retrieval success | Measures agent reliability |
| Design-to-code implementation time | Core productivity outcome |
| Generic UI drift incidents | Direct measure of problem solved |
| Proposal acceptance rate | Copilot usefulness |
| Sync conflict rate | Versioning quality |
| Design version → commit traceability | Implementation integrity |

## 33. Phase 4 Acceptance Criteria

- A developer can create a project without needing design expertise.
- A user can visually construct a meaningful page using structured components and tokens.
- Copilot can inspect context and propose structured design changes.
- The user can preview and selectively approve those changes.
- Approved versions are clearly distinguished from drafts.
- A coding agent can be connected with project-scoped permissions.
- The agent can retrieve design context and implement against it.
- Implementation status can be associated with a design version.
- A later design version can generate a semantic synchronization proposal.
- The UX makes the design-to-code loop understandable without exposing internal architecture.
## 34. Phase 5 Dependency

Phase 5 should turn all four previous phases into the Production Blueprint & Execution Plan: infrastructure, deployment

topology, CI/CD, repository structure, testing, observability, security hardening, environments, operational runbooks,

implementation milestones, launch criteria and the final MVP build sequence.

Phase 1 defined the product. Phase 2 defined its knowledge model. Phase 3 defined machine communication.

Phase 4 defined the human/AI workflow. Phase 5 turns the complete architecture into an executable production

system.


Phase 5 — Production Blueprint & Execution Plan
Purpose: turn the first four architecture phases into an executable production system: infrastructure, repository structure, environments, CI/CD, testing, observability, security, operations, milestones and launch criteria.
Depends on: Phases 1–4 — product definition, Design Graph, agent gateway and product UX/workflow.
Core principle: build the smallest production-grade system that proves the design-to-code loop, while keeping the architecture extensible.
1. Production Objective
The first production release should prove one thing exceptionally well: a developer can intentionally design a product in
CollabCanvas, approve that design as a machine-readable contract, connect a coding agent, and produce a real frontend
that follows the design instead of falling back to generic AI UI.
Everything else is subordinate to this proof.
2. Target Production Architecture
Layer
Initial Azure-oriented choice
Reason
Web
Static Web Apps or equivalent CDN hosting
Fast frontend delivery
API
Container Apps / Functions / App Service
Managed compute without server management
Database
Azure Database for PostgreSQL
Relational source of truth
Files
Blob Storage
Assets, fonts, exports
Secrets
Key Vault
Credential isolation
Observability
Application Insights + Log Analytics
Logs, metrics, traces
Identity
External OAuth provider + app authorization
Developer-friendly login
Async
Queue/managed messaging
Jobs, webhooks, long-running work
3. Cloud Strategy
Layer
Initial Azure-oriented choice
Reason
Web
Static Web Apps or equivalent CDN hosting
Fast frontend delivery
API
Container Apps / Functions / App Service
Managed compute without server management
Database
Azure Database for PostgreSQL
Relational source of truth
Files
Blob Storage
Assets, fonts, exports
Secrets
Key Vault
Credential isolation
Observability
Application Insights + Log Analytics
Logs, metrics, traces
Identity
External OAuth provider + app authorization
Developer-friendly login
Async
Queue/managed messaging
Jobs, webhooks, long-running work
4. Environment Model
Environment
Purpose
Local
Developer iteration and unit tests
Preview
Pull-request validation and visual review
Staging
Production-like integration testing
Production
Real users and external agent connections
5. Repository Structure
collabcanvas/
III apps/
I III web/ # Canvas + product UI
I III api/ # HTTP + gateway API
III packages/
I III design-core/ # Design Graph domain types
I III manifest/ # Manifest generation/validation
I III protocol/ # Agent/WebMCP schemas
I III ui/ # Shared UI primitives
I III adapters/ # Framework projections
III workers/
I III events/
I III webhooks/
I III asset-processing/
III db/
I III migrations/
I III seeds/
III infra/
III docs/
III tests/
III scripts/
The exact framework can change; the boundary between domain packages, application services, workers and UI should
remain clear.
6. Domain/Application/Infrastructure Separation
Domain Design Graph
Tokens
Components
Versions
Proposals
Application CreateProject
ApproveProposal
GenerateManifest
ConnectAgent
CompareVersions
Infrastructure PostgreSQL Blob Storage
OAuth
AI Providers Webhooks Queues
Interfaces Web UI REST API WebMCP Workers This separation prevents external providers or UI decisions from contaminating the canonical design model.
7. Deployment Topology
Runtime
Responsibilities
Web
Canvas, project UI, Copilot UX
API
Auth, design operations, manifest, agent gateway
Worker
Async asset processing, webhook delivery, heavy jobs
Database
Transactional source of truth
Object storage
Binary assets
Queue
Retries and asynchronous jobs
8. Database Migration Strategy
Every schema change is a versioned migration.
Migrations are forward-compatible where possible.
Destructive migrations require staged rollout.
Production migrations run as a controlled deployment step.
Seed data is separate from production migrations.
Rollback strategy is documented for every risky migration.
9. CI/CD Pipeline
Pull Request
↓ Lint / Type Check
↓ Unit Tests
↓ Schema Validation
↓ Build
↓ Integration Tests
↓ Preview Deployment
↓ Smoke Tests
↓ Review
↓ Merge
↓ Staging
↓ Production Approval
↓ Production Deploy
↓ Health / Smoke Verification
The pipeline should fail before deployment when domain schemas, manifest contracts or protocol definitions break.
10. Testing Strategy
Level
Primary target
Unit
Design operations, token rules, validators, version logic
Contract
Manifest and agent/WebMCP schemas
Integration
DB, storage, auth, gateway
End-to-end
User → design → approval → agent → implementation
Security
Authorization, credential scope, injection, SSRF
Visual
Canvas regression and implementation comparison
Load
Manifest reads, agent traffic, Copilot workloads
11. Critical Test: Design Contract
The most important automated test is not whether a button renders. It is whether the approved design can be reliably
reconstructed as machine-readable context.
Given:
Design Graph + Version 8
Generate:
Manifest M
Assert:
schema valid
references resolve
hash stable
component/token/page relationships preserved
no secrets present
Repeat:
Generate M again
Assert:
hash(M1) == hash(M2)
12. Critical Test: Agent Handoff
Create InvoiceFlow
↓ Approve Version 8
↓ Authenticate test agent
↓ get_manifest()
↓ get_component()
↓ get_design_intent()
↓ simulate implementation
↓ report_implementation_status()
↓ assert design_version == 8
↓ assert audit events exist
13. Security Architecture
OAuth/session authentication for humans.
Project-scoped credentials for agents.
Capability authorization at gateway and service boundaries.
Secrets isolated in Key Vault/secret manager.
Encryption in transit and at rest.
Signed webhooks.
Idempotency for mutations.
Rate limiting for machine principals.
Input validation for AI-generated operations.
SSRF protection for webhooks/integrations.
Audit logging for consequential operations.
14. AI Security
AI output must be treated as untrusted proposed input, even when produced by the product's own Copilot.
Validate operation type and target resource.
Verify token/component references.
Reject operations outside capability scope.
Never allow model output to directly execute arbitrary code.
Separate instructions from project content.
Do not expose credentials through model context.
Limit model access to the minimum design context needed.
15. Data Protection
Data
Protection
Design metadata
Workspace/project authorization
Private assets
Signed/authorized access
Fonts
License metadata + controlled distribution
AI prompts
Minimize retention; configurable policy
Provider credentials
Secrets manager
Agent credentials
Hash/secure storage + one-time display
Audit records
Append-oriented, restricted access
16. Observability
Metric
Signal
manifest_generation_latency
Design contract performance
agent_tool_success_rate
Gateway reliability
proposal_validation_failures
Contract quality
version_conflicts
Sync pressure
webhook_delivery_failures
Integration reliability
copilot_operation_acceptance
AI usefulness
implementation_drift_rate
Core product outcome
17. Logging Rules
Every request gets a correlation ID.
Structured logs, not free-form debugging only.
Never log credentials or authorization headers.
Redact sensitive provider data.
Log actor type, project, operation, result and latency.
Preserve enough context to reconstruct failures.
18. Backup and Recovery
Failure
Recovery expectation
API instance loss
Stateless replacement
Worker loss
Queue retry
Database failure
Managed restore/failover strategy
Asset failure
Object-storage recovery/versioning
Bad design deployment
Rollback to previous approved version
Compromised agent credential
Immediate revocation + audit review
19. Operational Runbooks
Before production launch, create short runbooks for:
Database migration failure.
Agent credential compromise.
AI provider outage.
Webhook delivery backlog.
Manifest generation failure.
Asset upload failure.
Version conflict escalation.
Production rollback.
Suspicious agent activity.
20. Cost Control
The architecture should be deliberately economical during MVP.
Avoid permanent microservices.
Use managed infrastructure where it reduces operations.
Cache stable approved manifests.
Process heavy assets asynchronously.
Rate-limit expensive AI calls.
Keep model context scoped.
Separate development/staging spend from production.
21. Production Readiness Gates
Gate
Must be true
G1 — Data
Migrations reproducible; backups enabled
G2 — Auth
Workspace/project authorization verified
G3 — Agent
Credential scope and revocation tested
G4 — Contract
Manifest and gateway schemas versioned
G5 — Safety
Proposal/approval boundary enforced
G6 — Reliability
Retries, timeouts, idempotency implemented
G7 — Observability
Logs/metrics/traces operational
G8 — Recovery
Rollback and restore tested
G9 — Proof
Real frontend implemented from manifest
G10 — Launch
No critical security/reliability findings
22. Build Sequence
Milestone
Outcome
M1
Repository + CI foundation
M2
Auth/workspace/project
M3
Design Graph + migrations
M4
Canvas persistence
M5
Tokens/components/pages
M6
Versioning + proposals
M7
Manifest generator + validator
M8
REST + agent gateway
M9
WebMCP tools
M10
Copilot structured operations
M11
Coding-agent integration proof
M12
Implementation status + semantic diff
M13
Security/observability hardening
M14
Production deployment + launch gate
23. Recommended Build Order in Practice
Do not build the entire product vertically by layer and wait until the end to integrate. Use vertical slices that repeatedly prove
the core loop.
Slice 1
Create project → save one page → retrieve it
Slice 2
Tokens/components → manifest generation
Slice 3
Approved version → agent manifest retrieval
Slice 4
Copilot → proposal → approval → new version
Slice 5
Coding agent → implementation status
Slice 6
Design v8 → v9 → semantic diff → sync proposal
Slice 7
Production hardening → launch
Each slice should leave the system in a demonstrably working state.
24. MVP Definition of Done
A real developer can sign in.
A real project can be created.
A meaningful page can be designed visually.
Tokens and reusable components can be defined.
A design can be approved as a version.
A deterministic manifest can be retrieved externally.
A project-scoped coding agent can consume it.
A real frontend can be implemented from it.
Implementation can be linked to the design version.
A design change can produce a semantic diff.
The system is observable, auditable and recoverable.
25. Flagship Demonstration
Demo:
“InvoiceFlow”
1. Login
2. Create project
3. Build dashboard
4. Define visual system
5. Copilot improves hierarchy
6. Approve Version 1
7. Connect coding agent
8. Agent reads manifest
9. Agent implements dashboard
10. Open live application
11. Change design in CollabCanvas
12. Approve Version 2
13. Show semantic diff
14. Agent receives sync proposal
15. Update implementation
16. Show new live result
This should become the canonical demo because it demonstrates the entire architecture without requiring the audience to
understand every internal subsystem.
26. What Not to Build Yet
Full Figma/Canva parity.
Complex team billing.
Marketplace.
Every AI provider.
Every coding agent.
Every frontend framework.
Autonomous destructive mutations.
Fully automatic bidirectional synchronization.
Enterprise governance before product-market evidence.
Large plugin ecosystem before the core contract is stable.
27. Long-Term Architecture
CollabCanvas
I
IIIIIIIIIIIIIIIIIIIIIIIII
I I
Human Design UI Design Contract
I
IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII
I I I I
Copilot Coding Review QA
Agents Agents Agents
I I I I
IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII
I
Versioned Design Graph
I
Real Software Systems
The long-term opportunity is not another visual editor. It is infrastructure for making AI-generated software adhere to
intentional product design.
28. Strategic Moat
Asset
Why it compounds
Design Graph
Structured project knowledge
Design Intent
Captures reasoning
Version history
Creates temporal design context
Manifest protocol
Makes integrations portable
Component ecosystem
Reusable implementation knowledge
Implementation links
Connects design to real code
Agent feedback
Improves future design/implementation loops
The moat grows from accumulated structured design knowledge and its relationship to implementation—not from the canvas
editor alone.
29. Final Architecture
USER
I
M
COLLABCANVAS WEB APP
I
III Canvas
III Design System
III Copilot
III Versions
III Agent Center
I
M
APPLICATION PLATFORM
I
III Auth / Authorization
III Design Graph
III Version Engine
III Manifest Engine
III Proposal Engine
III Agent Gateway
III Integration Layer
I
M
DATA + INFRASTRUCTURE
I
III PostgreSQL
III Object Storage
III Queue
III Secrets
III Observability
I
M
ECOSYSTEM
I
III ChatGPT / Claude / Other AI
III Claude Code / Codex / OpenCode / Other Agents
III Git / CI/CD
III Live Applications
30. Complete Architecture Success Criteria
The canonical design is structured, versioned and independent of any one AI provider.
The visual editor and AI Copilot operate on the same Design Graph.
External agents consume a stable manifest rather than scraping the UI.
Agent access is scoped, auditable and revocable.
Approved design is immutable and traceable.
Changes are proposed and validated before canonical mutation.
Coding-agent implementations can be linked to design versions.
Design changes can be translated into implementation impact.
The system can run reliably in production without unnecessary operational complexity.
The flagship workflow measurably reduces generic AI-generated UI drift.
31. Final Execution Roadmap
Stage
Focus
Exit condition
Stage 1
Foundation
Auth + project + DB
Stage 2
Design engine
Canvas + graph + tokens
Stage 3
Design contract
Versions + manifest
Stage 4
Agent bridge
Gateway + WebMCP
Stage 5
AI collaboration
Copilot proposals
Stage 6
Code handoff
Real agent implementation
Stage 7
Sync
Diff + implementation linkage
Stage 8
Production
Security + observability + deployment
Stage 9
Proof
InvoiceFlow end-to-end demo
32. Final Product Thesis
CollabCanvas should become the design context layer for AI-built software. A developer establishes intentional visual
and interaction decisions once. Those decisions become structured, versioned knowledge. AI can reason over them. Coding
agents can implement them. Later design changes can propagate through explicit, reviewable synchronization.
The canvas is the interface. The Design Graph is the knowledge. The Manifest is the contract. The Agent Gateway is the
bridge. The version system is the trust layer.
Design intentionally → encode the design → let AI understand it → build with it → validate it → version it →
synchronize it.
33. What We Have Now
With Phase 5 complete, the architecture series covers the complete path from product thesis to executable production
design:
Phase 1 — Product Definition & Architecture
Phase 2 — Technical Architecture & Data Model
Phase 3 — API, WebMCP & Agent Gateway
Phase 4 — Product UX, AI Copilot & Implementation Workflow
Phase 5 — Production Blueprint & Execution Plan The next step is no longer another architecture phase. It is implementation: turn the blueprint into the repository, schema,
services, UI and first end-to-end proof.
