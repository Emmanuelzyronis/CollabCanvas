import { describe, expect, it, vi } from 'vitest'
import { DeterministicCopilotPlanner } from '../server/application/copilot-planner'
import { AzureOpenAiCopilotPlanner, type AzureOpenAiCopilotConfig } from '../server/application/azure-copilot-planner'
import type { CopilotContext } from '../server/domain/copilot-types'
import { createInvoiceFlowGraph } from '../server/domain/fixtures/invoiceflow'
import { applyDesignChangeOperations, validateProposalOperations } from '../server/domain/versioning'
import { recipeForInstruction, recipeOperations } from '../server/domain/design-recipes'

const graph = createInvoiceFlowGraph()

function receiveCreatedNodes(recipe: string, offsetY: number) {
  const found = recipeForInstruction(recipe)
  if (!found) throw new Error(`No recipe matched "${recipe}".`)
  return recipeOperations(found, offsetY)
}

function layoutNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function context(overrides: Partial<CopilotContext> = {}): CopilotContext {
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
    selectedNodeIds: [],
    ...overrides,
  }
}

describe('proposal creation operations', () => {
  it('applies creates in order and resolves parent keys to the nodes it just made', () => {
    const operations = receiveCreatedNodes('hero', 0)
    const next = applyDesignChangeOperations(graph, operations, { now: () => '2026-09-11T00:00:00.000Z' })

    const section = next.nodes.find((node) => node.name === 'Hero')
    expect(section).toBeDefined()
    expect(section!.parentId).toBeNull()

    const children = next.nodes.filter((node) => node.parentId === section!.id)
    expect(children.map((node) => node.name).sort()).toEqual(['Headline', 'Primary action', 'Supporting text'])
    expect(children.every((node) => node.pageId === graph.page.id)).toBe(true)
    expect(children.every((node) => node.createdAt === '2026-09-11T00:00:00.000Z')).toBe(true)
  })

  it('mints identities that do not collide with the existing design', () => {
    const next = applyDesignChangeOperations(graph, receiveCreatedNodes('hero', 0))
    const ids = next.nodes.map((node) => node.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(next.nodes.length).toBe(graph.nodes.length + 4)
  })

  it('places new content below whatever already exists', () => {
    const next = applyDesignChangeOperations(graph, receiveCreatedNodes('navigation bar', 900))
    const navigation = next.nodes.find((node) => node.name === 'Navigation')
    expect(navigation!.layout.y).toBe(900)
  })

  it('refuses a plan whose keys collide, and one that names a parent it never created', () => {
    const duplicate = validateProposalOperations(graph, [
      { type: 'createNode', key: 'a', node: { type: 'section', name: 'One' } },
      { type: 'createNode', key: 'a', node: { type: 'section', name: 'Two' } },
    ])
    expect(duplicate.valid).toBe(false)
    expect(duplicate.issues[0].code).toBe('DUPLICATE_ID')

    const orphan = validateProposalOperations(graph, [
      { type: 'createNode', key: 'child', parentKey: 'missing', node: { type: 'heading', name: 'Orphan' } },
    ])
    expect(orphan.valid).toBe(false)
    expect(orphan.issues[0].code).toBe('DANGLING_PARENT')
  })

  it('still applies existing move and delete operations unchanged', () => {
    const validation = validateProposalOperations(graph, [
      { type: 'moveNode', nodeId: 'node_status_badge', parentId: 'node_dashboard_shell', orderIndex: 0 },
      { type: 'deleteNode', nodeId: 'node_status_badge' },
    ])
    expect(validation.valid).toBe(true)
  })
})

describe('the built-in planner composes sections', () => {
  const planner = new DeterministicCopilotPlanner()

  it('turns a described hero into real create operations', async () => {
    const plan = await planner.plan(context(), 'Create a hero section')
    expect(plan.operations.length).toBe(4)
    expect(plan.operations.every((operation) => operation.type === 'createNode')).toBe(true)
    expect(plan.rationale).toContain('hero section')
  })

  it('recognises navigation and feature cards without a verb', async () => {
    expect((await planner.plan(context(), 'a navigation bar with a get started button')).operations.length).toBe(5)
    expect((await planner.plan(context(), 'feature cards explaining the product')).operations.length).toBe(10)
  })

  it('places new sections below the existing content instead of overlapping it', async () => {
    const plan = await planner.plan(context(), 'add a hero')
    const lowest = Math.max(...graph.nodes.filter((node) => node.parentId === null).map((node) => layoutNumber(node.layout.y) + layoutNumber(node.layout.height)))
    const section = plan.operations[0] as { node: { layout: { y: number } } }
    expect(section.node.layout.y).toBeGreaterThanOrEqual(lowest)
  })

  it('never mistakes a refinement for a new section', async () => {
    const sparse = await planner.plan(context(), 'make the hero more spacious')
    expect(sparse.operations).toEqual([])
    const removed = await planner.plan(context(), 'remove the hero')
    expect(removed.operations.every((operation) => operation.type !== 'createNode')).toBe(true)
    const moved = await planner.plan(context(), 'move the heading inside the hero section')
    expect(moved.operations.every((operation) => operation.type !== 'createNode')).toBe(true)
  })

  it('picks the most specific recipe when an instruction mentions two', () => {
    expect(recipeForInstruction('add feature cards to the landing page')!.id).toBe('featureCards')
    expect(recipeForInstruction('design a landing page')!.id).toBe('hero')
    expect(recipeForInstruction('change the button colour')).toBeUndefined()
  })
})

describe('the model-backed planner accepts creations only when they are complete', () => {
  const config: AzureOpenAiCopilotConfig = { endpoint: 'https://example.openai.azure.com', apiKey: 'secret-key', deployment: 'gpt-4o', apiVersion: '2024-10-21', transport: 'azure-deployment' }

  function respond(payload: unknown) {
    const request = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }), { status: 200, headers: { 'content-type': 'application/json' } }))
    return new AzureOpenAiCopilotPlanner(config, request as unknown as typeof fetch)
  }

  it('accepts a well-formed section and keeps its parent linkage', async () => {
    const planner = respond({
      operations: [
        { type: 'createNode', key: 'hero', node: { type: 'section', name: 'Hero', layout: { x: 0, y: 0, width: 1440, height: 600 } } },
        { type: 'createNode', key: 'title', parentKey: 'hero', node: { type: 'heading', name: 'Headline', layout: { x: 80, y: 120, width: 600, height: 80 }, properties: { text: 'Hello' } } },
      ],
      rationale: 'Add a hero with a headline.',
    })
    const plan = await planner.plan(context(), 'add a hero')
    expect(plan.operations).toHaveLength(2)
    expect(plan.operations[1]).toMatchObject({ type: 'createNode', key: 'title', parentKey: 'hero' })
  })

  it('rejects a plan with an unknown node type, a missing name, or an undefined parent key', async () => {
    const badType = respond({ operations: [{ type: 'createNode', key: 'x', node: { type: 'spaceship', name: 'Nope' } }], rationale: '' })
    expect((await badType.plan(context(), 'add something')).operations).toEqual([])

    const noName = respond({ operations: [{ type: 'createNode', key: 'x', node: { type: 'section', layout: {} } }], rationale: '' })
    expect((await noName.plan(context(), 'add something')).operations).toEqual([])

    const danglingParent = respond({ operations: [{ type: 'createNode', key: 'x', parentKey: 'ghost', node: { type: 'section', name: 'Nope' } }], rationale: '' })
    expect((await danglingParent.plan(context(), 'add something')).operations).toEqual([])
  })
})
