import { describe, expect, it } from 'vitest'
import type { DesignGraph, DesignNode } from '../server/domain/contracts'
import { createInvoiceFlowGraph } from '../server/domain/fixtures/invoiceflow'
import { attachIntent, createComponentInstance, createNode, deleteNode, moveNode, reorderNode } from '../server/domain/graph-operations'
import { GraphValidationError, validateDesignGraph } from '../server/domain/graph-validation'
import { serializeDesignGraph } from '../server/domain/serialization'
import { canvasElementInputToNode, canvasOperationToGraphOperation, graphToCanvasProjection } from '../src/graph/canvasProjection'

const page = createInvoiceFlowGraph().page
const stamp = '2026-09-05T00:00:00.000Z'

function node(overrides: Partial<DesignNode> & Pick<DesignNode, 'id' | 'type' | 'name'>): DesignNode {
  return {
    pageId: page.id,
    parentId: null,
    orderIndex: 0,
    semantic: {},
    properties: {},
    layout: {},
    createdAt: stamp,
    updatedAt: stamp,
    ...overrides,
  }
}

function graph(nodes: DesignNode[] = []): DesignGraph {
  const project = { id: 'project-test', name: 'Test project', slug: 'test-project', createdAt: stamp, updatedAt: stamp }
  const document = { id: page.documentId, projectId: project.id, name: 'Test document', createdAt: stamp, updatedAt: stamp }
  return {
    project,
    document,
    page,
    nodes,
    componentDefinitions: [],
    componentInstances: [],
    tokens: [],
    typography: [],
    assets: [],
    intents: [],
  }
}

function issueCode(action: () => unknown): string[] {
  try {
    action()
  } catch (error) {
    if (error instanceof GraphValidationError) return error.issues.map((issue) => issue.code)
    throw error
  }
  return []
}

describe('canonical Design Graph', () => {
  it('creates and validates the InvoiceFlow graph fixture', () => {
    const fixture = createInvoiceFlowGraph()
    expect(() => validateDesignGraph(fixture)).not.toThrow()
    expect(fixture.nodes.find((item) => item.id === 'node_dashboard_title')?.typographyId).toBe('type_heading_1')
    expect(fixture.tokens.some((token) => token.category === 'spacing')).toBe(true)
  })

  it('preserves stable IDs and deterministic sibling order', () => {
    const root = node({ id: 'root', type: 'section', name: 'Root' })
    const a = node({ id: 'a', type: 'text', name: 'A', parentId: root.id, orderIndex: 1 })
    const b = node({ id: 'b', type: 'text', name: 'B', parentId: root.id, orderIndex: 0 })
    const next = reorderNode(graph([root, a, b]), 'a', 0)
    expect(next.nodes.find((item) => item.id === 'a')?.id).toBe('a')
    expect(next.nodes.filter((item) => item.parentId === root.id).sort((x, y) => x.orderIndex - y.orderIndex).map((item) => item.id)).toEqual(['a', 'b'])
  })

  it('supports parent-child operations without mutating the input graph', () => {
    const root = node({ id: 'root', type: 'section', name: 'Root' })
    const child = node({ id: 'child', type: 'text', name: 'Child' })
    const initial = createNode(graph([root]), child)
    const attached = moveNode(initial, child.id, root.id)
    expect(initial.nodes.find((item) => item.id === child.id)?.parentId).toBeNull()
    expect(attached.nodes.find((item) => item.id === child.id)?.parentId).toBe(root.id)
    expect(deleteNode(attached, root.id).nodes).toHaveLength(0)
  })

  it('rejects cycles, dangling parents, cross-page nodes, duplicate IDs, and invalid ordering', () => {
    const root = node({ id: 'root', type: 'section', name: 'Root' })
    const child = node({ id: 'child', type: 'text', name: 'Child', parentId: root.id })
    expect(issueCode(() => moveNode(graph([root, child]), root.id, child.id))).toContain('CYCLE')
    expect(issueCode(() => validateDesignGraph(graph([node({ id: 'orphan', type: 'text', name: 'Orphan', parentId: 'missing' })])))).toContain('DANGLING_PARENT')
    expect(issueCode(() => validateDesignGraph(graph([node({ id: 'other-page', type: 'text', name: 'Other', pageId: 'page-other' })])))).toContain('INVALID_PAGE_REFERENCE')
    expect(issueCode(() => validateDesignGraph(graph([root, { ...root }])))).toContain('DUPLICATE_ID')
    expect(issueCode(() => validateDesignGraph(graph([node({ id: 'bad-order', type: 'text', name: 'Bad', orderIndex: -1 })])))).toContain('INVALID_ORDER')
  })

  it('requires valid component definition and instance relationships', () => {
    const instanceNode = node({ id: 'instance-node', type: 'component-instance', name: 'Instance' })
    const base = graph([instanceNode])
    expect(issueCode(() => createComponentInstance(base, { id: 'instance', definitionId: 'missing', nodeId: instanceNode.id, props: {} }))).toContain('INVALID_COMPONENT_REFERENCE')
    const withDefinition: DesignGraph = { ...base, componentDefinitions: [{ id: 'definition', name: 'Card', anatomy: [], variants: {}, props: [], states: ['default'], tokenRefs: {} }] }
    expect(() => createComponentInstance(withDefinition, { id: 'instance', definitionId: 'definition', nodeId: instanceNode.id, props: {} })).not.toThrow()
  })

  it('validates token, typography, responsive, interaction, accessibility, and intent metadata', () => {
    const fixture = createInvoiceFlowGraph()
    const metricGrid = fixture.nodes.find((item) => item.id === 'node_metric_grid')
    expect(metricGrid?.responsive?.length).toBeGreaterThan(0)
    const card = fixture.nodes.find((item) => item.id === 'node_metric_card')
    expect(card?.tokenRefs?.fill).toBe('token_color_surface')
    expect(fixture.nodes.find((item) => item.id === 'node_primary_button')?.interactions?.[0].type).toBe('click')
    expect(fixture.nodes.find((item) => item.id === 'node_primary_button')?.accessibility?.focusable).toBe(true)
    expect(() => attachIntent(fixture, { id: 'intent_node', targetType: 'node', targetId: 'node_metric_card', statement: 'Keep the metric scannable.' })).not.toThrow()
    expect(issueCode(() => validateDesignGraph({ ...fixture, tokens: [] }))).toContain('INVALID_TOKEN_REFERENCE')
    expect(issueCode(() => validateDesignGraph({ ...fixture, typography: [] }))).toContain('INVALID_TYPOGRAPHY_REFERENCE')
  })

  it('serializes equivalent complete graphs deterministically', () => {
    const fixture = createInvoiceFlowGraph()
    const shuffled: DesignGraph = {
      project: { ...fixture.project },
      document: { ...fixture.document },
      intents: [...fixture.intents].reverse(),
      assets: [...fixture.assets].reverse(),
      typography: [...fixture.typography].reverse(),
      tokens: [...fixture.tokens].reverse(),
      componentInstances: [...fixture.componentInstances].reverse(),
      componentDefinitions: [...fixture.componentDefinitions].reverse(),
      nodes: [...fixture.nodes].reverse().map((item) => ({ ...item, properties: { ...item.properties }, layout: { ...item.layout } })),
      page: { ...fixture.page },
    }
    expect(serializeDesignGraph(fixture)).toBe(serializeDesignGraph(shuffled))
  })

  it('projects graph nodes into stable canvas IDs and translates canvas operations', () => {
    const fixture = createInvoiceFlowGraph()
    const projection = graphToCanvasProjection(fixture)
    expect(projection.elements[0].id).toBe(fixture.nodes[0].id)
    expect(projection.order).toEqual(projection.elements.map((item) => item.id))
    expect(projection.elements.find((item) => item.id === 'node_dashboard_title')?.type).toBe('text')

    const created = canvasElementInputToNode({ type: 'text', text: 'New title', x: 10, y: 20 }, fixture.page.id, 'new-node', stamp)
    const next = canvasOperationToGraphOperation({ type: 'create', node: created })(fixture)
    expect(next.nodes.some((item) => item.id === 'new-node')).toBe(true)
    const moved = canvasOperationToGraphOperation({ type: 'move', nodeId: 'new-node', parentId: 'node_dashboard_shell' })(next)
    expect(moved.nodes.find((item) => item.id === 'new-node')?.parentId).toBe('node_dashboard_shell')
  })
})
