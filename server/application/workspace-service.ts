import { nanoid } from 'nanoid'
import type { DesignDocument, DesignGraph, Page, Project } from '../domain/contracts.js'
import { DomainError } from '../domain/errors.js'
import { createNode } from '../domain/graph-operations.js'
import { isWorkspacePreset, presetTemplate, WORKSPACE_PRESETS, type WorkspacePreset } from '../domain/preset-templates.js'
import type { DesignVersion } from '../domain/version-types.js'
import type { DesignGraphRepository, DesignGraphWriter, DesignRepository } from '../persistence/repository.js'
import type { VersioningApplicationService } from './version-service.js'

export { WORKSPACE_PRESETS }
export type { WorkspacePreset }

export interface CreateWorkspaceResult {
  readonly project: Project
  readonly document: DesignDocument
  readonly page: Page
  readonly graph: DesignGraph
  readonly version: DesignVersion
}

type GraphStore = DesignGraphRepository & DesignGraphWriter

const PRESET_NAMES: Record<WorkspacePreset, { project: string; document: string; page: string; createdBy: string }> = {
  blank: { project: 'Untitled project', document: 'Untitled design', page: 'Page 1', createdBy: 'human-editor' },
  website: { project: 'Website', document: 'Website design', page: 'Home', createdBy: 'human-editor' },
  flyer: { project: 'Flyer', document: 'Flyer design', page: 'Flyer', createdBy: 'human-editor' },
  logo: { project: 'Logo', document: 'Logo design', page: 'Canvas', createdBy: 'human-editor' },
}

/**
 * Bootstraps a human-editor workspace: project, document, page, a canonical
 * DesignGraph, and an initial draft version so every later editor mutation has
 * an explicit base version.
 *
 * A preset seeds a real starter composition through the same domain node
 * operation the editor uses. The template carries presentation only; the
 * bootstrap assigns identity, page scope, order, and timestamps, then validates
 * the finished graph before it is saved.
 */
export class HumanWorkspaceService {
  private readonly makeId: () => string
  private readonly timestamp: () => string

  constructor(
    private readonly resources: DesignRepository,
    private readonly graphs: GraphStore,
    private readonly versioning: VersioningApplicationService,
    deps: { id?: () => string; now?: () => string } = {},
  ) {
    this.makeId = deps.id ?? (() => nanoid(16))
    this.timestamp = deps.now ?? (() => new Date().toISOString())
  }

  async create(presetValue: string | undefined): Promise<CreateWorkspaceResult> {
    const preset = presetValue ?? 'blank'
    if (!isWorkspacePreset(preset)) {
      throw new DomainError('VALIDATION_ERROR', `preset must be one of: ${WORKSPACE_PRESETS.join(', ')}.`)
    }
    const names = PRESET_NAMES[preset]
    const now = this.timestamp()

    const project = await this.resources.createProject({
      id: this.makeId(),
      name: names.project,
      // Project slugs are unique; a new workspace must never collide with an
      // earlier human-created project of the same preset name.
      slug: `${slugify(names.project)}-${this.makeId().slice(0, 8)}`,
      createdAt: now,
      updatedAt: now,
    })
    const document = await this.resources.createDocument({ id: this.makeId(), projectId: project.id, name: names.document, createdAt: now, updatedAt: now })
    const page = await this.resources.createPage({ id: this.makeId(), documentId: document.id, name: names.page, routeHint: null, createdAt: now, updatedAt: now })

    const template = presetTemplate(preset)
    let graph: DesignGraph = {
      project,
      document,
      page,
      nodes: [],
      componentDefinitions: [],
      componentInstances: [],
      tokens: [],
      typography: [],
      assets: template.assets.map((asset) => structuredClone(asset)),
      intents: [],
    }
    for (const blueprint of template.nodes) {
      graph = createNode(graph, {
        id: this.makeId(),
        pageId: page.id,
        parentId: null,
        type: blueprint.type,
        name: blueprint.name,
        orderIndex: graph.nodes.length,
        semantic: structuredClone(blueprint.semantic),
        properties: structuredClone(blueprint.properties),
        layout: structuredClone(blueprint.layout),
        ...(blueprint.assetRef ? { assetRef: structuredClone(blueprint.assetRef) } : {}),
        createdAt: now,
        updatedAt: now,
      })
    }
    await this.graphs.saveDesignGraph(graph)
    const version = await this.versioning.createDraft(document.id, names.createdBy)
    return { project, document, page, graph, version }
  }
}

function slugify(value: string): string {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (!slug) throw new DomainError('VALIDATION_ERROR', 'slug must contain letters or numbers.')
  return slug
}
