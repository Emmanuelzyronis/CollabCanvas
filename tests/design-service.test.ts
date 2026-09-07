import { describe, expect, it } from 'vitest'
import { DesignService } from '../server/application/design-service'
import { serializePageGraph } from '../server/domain/serialization'
import { MemoryDesignRepository } from '../server/persistence/memory'
import type { DesignNode, PageGraph } from '../server/domain/contracts'

function makeService() {
  let sequence = 0
  return new DesignService(new MemoryDesignRepository(), {
    id: () => `id-${++sequence}`,
    now: () => '2026-09-05T00:00:00.000Z',
  })
}

describe('DesignService', () => {
  it('creates and retrieves the project/document/page hierarchy', async () => {
    const service = makeService()
    const project = await service.createProject({ name: 'InvoiceFlow' })
    const document = await service.createDocument(project.id, { name: 'Dashboard design' })
    const page = await service.createPage(document.id, { name: 'Dashboard', routeHint: '/dashboard' })

    expect(await service.getProject(project.id)).toEqual(project)
    expect(await service.getDocument(document.id)).toEqual(document)
    expect(await service.getPage(page.id)).toEqual({ page, nodes: [] })
  })

  it('preserves stable node IDs and parent/child hierarchy', async () => {
    const service = makeService()
    const project = await service.createProject({ name: 'Graph test', slug: 'graph-test' })
    const document = await service.createDocument(project.id, { name: 'Document' })
    const page = await service.createPage(document.id, { name: 'Page' })
    const root = await service.createNode(page.id, { type: 'section', name: 'Summary' })
    const child = await service.createNode(page.id, {
      parentId: root.id,
      type: 'heading',
      name: 'Revenue',
      semantic: { role: 'heading', level: 1 },
      layout: { x: 20, y: 30, width: 200, height: 40 },
    })

    const graph = await service.getPage(page.id)
    expect(child.id).toBe('id-5')
    expect(graph.nodes.map((node) => [node.id, node.parentId])).toEqual([
      ['id-4', null],
      ['id-5', 'id-4'],
    ])
  })

  it('rejects missing and cross-page parent references', async () => {
    const service = makeService()
    const project = await service.createProject({ name: 'Reference test' })
    const document = await service.createDocument(project.id, { name: 'Document' })
    const pageA = await service.createPage(document.id, { name: 'A' })
    const pageB = await service.createPage(document.id, { name: 'B' })
    const parent = await service.createNode(pageA.id, { type: 'section', name: 'Parent' })

    await expect(service.createNode(pageB.id, { parentId: 'missing', type: 'text', name: 'Invalid' })).rejects.toHaveProperty('code', 'INVALID_REFERENCE')
    await expect(service.createNode(pageB.id, { parentId: parent.id, type: 'text', name: 'Cross page' })).rejects.toHaveProperty('code', 'INVALID_REFERENCE')
  })
})

describe('serializePageGraph', () => {
  it('is stable across object insertion and node insertion order', () => {
    const page = {
      id: 'page-1',
      documentId: 'doc-1',
      name: 'Dashboard',
      routeHint: '/dashboard',
      createdAt: '2026-09-05T00:00:00.000Z',
      updatedAt: '2026-09-05T00:00:00.000Z',
    }
    const first: DesignNode = {
      id: 'node-1', pageId: 'page-1', parentId: null, type: 'section', name: 'Summary', orderIndex: 0,
      semantic: { role: 'region', label: 'Summary' }, properties: {}, layout: { width: 800, x: 0 },
      createdAt: page.createdAt, updatedAt: page.updatedAt,
    }
    const second: DesignNode = {
      id: 'node-2', pageId: 'page-1', parentId: 'node-1', type: 'text', name: 'Title', orderIndex: 0,
      semantic: { role: 'heading' }, properties: { text: 'Revenue' }, layout: { y: 20, x: 10 },
      createdAt: page.createdAt, updatedAt: page.updatedAt,
    }
    const graphA: PageGraph = { page, nodes: [second, first] }
    const graphB: PageGraph = {
      page: { updatedAt: page.updatedAt, createdAt: page.createdAt, routeHint: page.routeHint, name: page.name, documentId: page.documentId, id: page.id },
      nodes: [
        { ...second, layout: { x: 10, y: 20 }, properties: { text: 'Revenue' } },
        { ...first, layout: { x: 0, width: 800 } },
      ],
    }

    expect(serializePageGraph(graphA)).toBe(serializePageGraph(graphB))
  })
})
