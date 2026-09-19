import { describe, expect, it } from 'vitest'
import { HumanWorkspaceService, WORKSPACE_PRESETS } from '../server/application/workspace-service'
import { VersioningApplicationService } from '../server/application/version-service'
import type { DesignNode } from '../server/domain/contracts'
import { validateDesignGraph } from '../server/domain/graph-validation'
import { MemoryDesignGraphRepository } from '../server/persistence/memory-graph'
import { MemoryDesignRepository } from '../server/persistence/memory'
import { MemoryVersionRepository } from '../server/persistence/memory-versions'
import { graphToCanvasProjection } from '../src/graph/canvasProjection'

function environment() {
  let sequence = 0
  const id = () => `preset-${++sequence}`
  const now = () => '2026-09-10T00:00:00.000Z'
  const resources = new MemoryDesignRepository()
  const graphs = new MemoryDesignGraphRepository()
  const versions = new MemoryVersionRepository()
  const versioning = new VersioningApplicationService(resources, graphs, versions, { id, now })
  const workspaces = new HumanWorkspaceService(resources, graphs, versioning, { id, now })
  return { workspaces }
}

function structure(graph: { nodes: readonly DesignNode[] }) {
  return graph.nodes.map((node) => ({ name: node.name, type: node.type, orderIndex: node.orderIndex, layout: node.layout }))
}

describe('workspace preset starter designs', () => {
  it('keeps the blank preset an empty canvas', async () => {
    const { workspaces } = environment()
    const workspace = await workspaces.create('blank')
    expect(workspace.graph.nodes).toHaveLength(0)
    expect(workspace.graph.assets).toHaveLength(0)
    validateDesignGraph(workspace.graph)
  })

  it.each(['website', 'flyer', 'logo'] as const)('seeds %s with a valid, non-empty canonical graph', async (preset) => {
    const { workspaces } = environment()
    const workspace = await workspaces.create(preset)

    expect(workspace.graph.nodes.length).toBeGreaterThan(0)
    validateDesignGraph(workspace.graph)

    const ids = new Set(workspace.graph.nodes.map((node) => node.id))
    expect(ids.size).toBe(workspace.graph.nodes.length)
    for (const node of workspace.graph.nodes) {
      expect(node.pageId).toBe(workspace.page.id)
      expect(node.parentId).toBeNull()
      expect(node.orderIndex).toBeGreaterThanOrEqual(0)
      expect(typeof node.layout.x).toBe('number')
      expect(typeof node.layout.y).toBe('number')
      expect(typeof node.layout.width).toBe('number')
      expect(typeof node.layout.height).toBe('number')
    }
    expect(new Set(workspace.graph.nodes.map((node) => node.orderIndex)).size).toBe(workspace.graph.nodes.length)
  })

  it.each(['website', 'flyer', 'logo', 'blank'] as const)('records the %s starter design as the base of the initial draft version', async (preset) => {
    const { workspaces } = environment()
    const workspace = await workspaces.create(preset)
    expect(workspace.version.status).toBe('draft')
    expect(workspace.version.graph.nodes).toHaveLength(workspace.graph.nodes.length)
    expect(workspace.version.graphHash).toBeTruthy()
  })

  it('references only bundled assets so a preset needs no network or client asset store', async () => {
    const { workspaces } = environment()
    const website = await workspaces.create('website')

    const assetIds = new Set(website.graph.assets.map((asset) => asset.id))
    const imageNodes = website.graph.nodes.filter((node) => node.assetRef)
    expect(imageNodes.length).toBeGreaterThan(0)
    for (const node of imageNodes) {
      expect(assetIds.has(node.assetRef!.id)).toBe(true)
      expect(node.assetRef!.source.startsWith('data:')).toBe(true)
    }
  })

  it('projects a preset straight into visible canvas content', async () => {
    const { workspaces } = environment()
    const workspace = await workspaces.create('website')
    const projection = graphToCanvasProjection(workspace.graph)

    expect(projection.elements).toHaveLength(workspace.graph.nodes.length)
    const headline = projection.elements.find((element) => element.id === workspace.graph.nodes[1].id)!
    expect(headline.text).toBe('Design at the speed of thought')
    expect(headline.fontSize).toBe(56)
    const image = projection.elements.find((element) => element.imageSrc)!
    expect(image.imageSrc).toBe(workspace.graph.assets[0].source)
  })

  it('is structurally deterministic for the same preset', async () => {
    const { workspaces } = environment()
    const first = await workspaces.create('flyer')
    const second = await workspaces.create('flyer')
    expect(structure(second.graph)).toEqual(structure(first.graph))
  })

  it('rejects an unknown preset instead of inventing a workspace', async () => {
    const { workspaces } = environment()
    await expect(workspaces.create('poster')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('lists every supported preset', () => {
    expect([...WORKSPACE_PRESETS]).toEqual(['blank', 'website', 'flyer', 'logo'])
  })
})
