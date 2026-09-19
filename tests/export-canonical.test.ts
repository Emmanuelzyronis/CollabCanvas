import { describe, expect, it } from 'vitest'
import { exportTools } from '../src/mcp/tools/export'
import { publishCanonicalGraph } from '../src/graph/canonicalGraph'
import { recipeForInstruction, recipeOperations } from '../server/domain/design-recipes'
import { applyDesignChangeOperations } from '../server/domain/versioning'
import type { DesignGraph } from '../server/domain/contracts'
import type { CanvasStore } from '../src/store/store'

const STAMP = '2026-09-11T00:00:00.000Z'

function emptyGraph(): DesignGraph {
  return {
    project: { id: 'p', name: 'P', slug: 'p', createdAt: STAMP, updatedAt: STAMP },
    document: { id: 'd', projectId: 'p', name: 'D', createdAt: STAMP, updatedAt: STAMP },
    page: { id: 'pg', documentId: 'd', name: 'Page', routeHint: null, createdAt: STAMP, updatedAt: STAMP },
    nodes: [],
    componentDefinitions: [],
    componentInstances: [],
    tokens: [],
    typography: [],
    assets: [],
    intents: [],
  }
}

const activity: string[] = []
const store = { logActivity: (_a: string, _b: string, message: string) => activity.push(message) } as unknown as CanvasStore
const tools = exportTools(() => store)
const tool = (name: string) => tools.find((candidate) => candidate.name === name)!

describe('canonical export path', () => {
  it('exports the canonical design, not the runtime canvas projection', async () => {
    const recipe = recipeForInstruction('a hero section')!
    const graph = applyDesignChangeOperations(emptyGraph(), recipeOperations(recipe, 0), { now: () => STAMP })
    publishCanonicalGraph(graph)

    const result = await tool('export_json').execute({})
    const text = result.content[0].text
    expect(text).toContain('Canonical design')
    expect(text).toContain('"Headline"')
    expect(text).toContain('"Primary action"')

    const svg = await tool('export_svg').execute({ download: false })
    expect(svg.isError).toBeFalsy()
    expect(svg.content[0].text).toContain('Get started')

    publishCanonicalGraph(null)
  })

  it('explains when no design is open instead of reading a second store', async () => {
    publishCanonicalGraph(null)
    const result = await tool('export_svg').execute({ download: false })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('No design is open')
  })

  it('exports a named subtree with its children', async () => {
    const recipe = recipeForInstruction('a hero section')!
    const graph = applyDesignChangeOperations(emptyGraph(), recipeOperations(recipe, 0), { now: () => STAMP })
    publishCanonicalGraph(graph)
    const hero = graph.nodes.find((node) => node.name === 'Hero')!

    const svg = await tool('export_svg').execute({ ids: [hero.id], download: false })
    expect(svg.content[0].text).toContain('Design at the speed of thought')
    expect(svg.content[0].text).toContain('Get started')
    publishCanonicalGraph(null)
  })
})
