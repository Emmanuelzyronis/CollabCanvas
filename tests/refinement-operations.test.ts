import { describe, expect, it } from 'vitest'
import { DeterministicCopilotPlanner } from '../server/application/copilot-planner'
import { parseCopilotPlan } from '../server/application/azure-copilot-planner'
import type { CopilotContext } from '../server/domain/copilot-types'
import type { DesignGraph } from '../server/domain/contracts'
import { recipeForInstruction, recipeOperations } from '../server/domain/design-recipes'
import { applyDesignChangeOperations, validateProposalOperations } from '../server/domain/versioning'
import { graphToCanvasProjection } from '../src/graph/canvasProjection'

const STAMP = '2026-09-11T00:00:00.000Z'

function emptyGraph(): DesignGraph {
  return {
    project: { id: 'project-1', name: 'P', slug: 'p', createdAt: STAMP, updatedAt: STAMP },
    document: { id: 'document-1', projectId: 'project-1', name: 'D', createdAt: STAMP, updatedAt: STAMP },
    page: { id: 'page-1', documentId: 'document-1', name: 'Page', routeHint: null, createdAt: STAMP, updatedAt: STAMP },
    nodes: [],
    componentDefinitions: [],
    componentInstances: [],
    tokens: [],
    typography: [],
    assets: [],
    intents: [],
  }
}

function heroGraph(): DesignGraph {
  const recipe = recipeForInstruction('a hero section')
  if (!recipe) throw new Error('hero recipe missing')
  return applyDesignChangeOperations(emptyGraph(), recipeOperations(recipe, 0), { now: () => STAMP })
}

function context(graph: DesignGraph, selectedNodeIds: string[] = []): CopilotContext {
  return {
    project: { id: graph.project.id, name: graph.project.name, slug: graph.project.slug },
    document: { id: graph.document.id, projectId: graph.document.projectId, name: graph.document.name },
    page: { id: graph.page.id, documentId: graph.page.documentId, name: graph.page.name, routeHint: graph.page.routeHint },
    baseVersionId: 'version-1',
    nodes: graph.nodes.map((node) => structuredClone(node)),
    componentDefinitions: [],
    componentInstances: [],
    tokens: [],
    typography: [],
    intents: [],
    selectedNodeIds,
  }
}

function element(graph: DesignGraph, name: string) {
  const node = graph.nodes.find((candidate) => candidate.name === name)
  if (!node) throw new Error(`no node named ${name}`)
  return graphToCanvasProjection(graph).elements.find((el) => el.id === node.id)!
}

describe('refinement operations', () => {
  it('turns "more spacious" into a real gap and padding change via the built-in planner', async () => {
    const graph = heroGraph()
    const planner = new DeterministicCopilotPlanner()
    const plan = await planner.plan(context(graph), 'make the hero more spacious')

    expect(plan.operations).toHaveLength(1)
    const operation = plan.operations[0]
    expect(operation.type).toBe('updateNode')
    if (operation.type !== 'updateNode') throw new Error('expected updateNode')
    expect(operation.patch.layout?.gap).toBeGreaterThan(28)
    expect(operation.patch.layout?.padding).toMatchObject({ top: 136, left: 136 })

    expect(validateProposalOperations(graph, plan.operations).valid).toBe(true)
  })

  it('reflows the projected canvas, not just the stored numbers', async () => {
    const graph = heroGraph()
    const before = element(graph, 'Primary action')

    const planner = new DeterministicCopilotPlanner()
    const plan = await planner.plan(context(graph), 'make the hero more spacious')
    const refined = applyDesignChangeOperations(graph, plan.operations, { now: () => STAMP })
    const after = element(refined, 'Primary action')

    expect(after.y).toBeGreaterThan(before.y)
    expect(element(refined, 'Headline').y).toBeGreaterThan(element(graph, 'Headline').y)
    // The hero is a fixed-height band; spacing changes move children inside it.
    expect(element(refined, 'Hero').height).toBe(element(graph, 'Hero').height)
  })

  it('tightens as well as loosens', async () => {
    const graph = heroGraph()
    const planner = new DeterministicCopilotPlanner()
    const plan = await planner.plan(context(graph), 'make the hero spacing tighter')
    if (plan.operations[0]?.type !== 'updateNode') throw new Error('expected updateNode')
    const refined = applyDesignChangeOperations(graph, plan.operations)
    expect(element(refined, 'Headline').y).toBeLessThan(element(graph, 'Headline').y)
  })

  it('recolours the selected layer with a real style change', async () => {
    const graph = heroGraph()
    const section = graph.nodes.find((node) => node.name === 'Hero')!
    const planner = new DeterministicCopilotPlanner()
    const plan = await planner.plan(context(graph, [section.id]), 'make it blue')

    expect(plan.operations[0]).toMatchObject({ type: 'updateNode', nodeId: section.id })
    const refined = applyDesignChangeOperations(graph, plan.operations)
    expect(element(refined, 'Hero').fill).toBe('#2563eb')
  })

  it('merges a partial refinement instead of replacing the whole node', async () => {
    const graph = heroGraph()
    const section = graph.nodes.find((node) => node.name === 'Hero')!
    const refined = applyDesignChangeOperations(graph, [
      { type: 'updateNode', nodeId: section.id, patch: { layout: { gap: 40 } } },
    ])
    const updated = refined.nodes.find((node) => node.id === section.id)!
    expect(updated.layout.gap).toBe(40)
    expect(updated.layout.display).toBe('stack')
    expect(updated.layout.padding).toEqual(section.layout.padding)
    expect(updated.name).toBe('Hero')
  })

  it('explains rather than faking when a refinement has no target', async () => {
    const graph = emptyGraph()
    const planner = new DeterministicCopilotPlanner()
    const plan = await planner.plan(context(graph), 'make it more spacious')
    expect(plan.operations).toHaveLength(0)
    expect(plan.rationale.toLowerCase()).toContain('select')
  })

  it('keeps creating from intent working after refinements were added', async () => {
    const planner = new DeterministicCopilotPlanner()
    const plan = await planner.plan(context(emptyGraph()), 'add a hero section')
    expect(plan.operations.every((operation) => operation.type === 'createNode')).toBe(true)
    expect(plan.operations.length).toBeGreaterThan(3)
  })
})

describe('model-produced refinements', () => {
  it('accepts a well-formed updateNode from the assistant', () => {
    const graph = heroGraph()
    const section = graph.nodes.find((node) => node.name === 'Hero')!
    const plan = parseCopilotPlan(
      { operations: [{ type: 'updateNode', nodeId: section.id, patch: { layout: { gap: 48 } } }], rationale: 'More space.' },
      context(graph),
    )
    expect(plan?.operations).toEqual([{ type: 'updateNode', nodeId: section.id, patch: { layout: { gap: 48 } } }])
  })

  it('rejects refinements that name unknown layers or carry no change', () => {
    const graph = heroGraph()
    expect(parseCopilotPlan({ operations: [{ type: 'updateNode', nodeId: 'nope', patch: { layout: { gap: 8 } } }], rationale: '' }, context(graph))).toBeNull()
    const section = graph.nodes.find((node) => node.name === 'Hero')!
    expect(parseCopilotPlan({ operations: [{ type: 'updateNode', nodeId: section.id, patch: {} }], rationale: '' }, context(graph))).toBeNull()
  })
})
