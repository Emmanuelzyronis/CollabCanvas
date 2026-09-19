import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CanvasGraphApplicationService } from '../server/application/canvas-graph-service'
import { VersioningApplicationService } from '../server/application/version-service'
import { createInvoiceFlowGraph } from '../server/domain/fixtures/invoiceflow'
import { MemoryDesignGraphRepository } from '../server/persistence/memory-graph'
import { MemoryDesignRepository } from '../server/persistence/memory'
import { MemoryVersionRepository } from '../server/persistence/memory-versions'
import { SemanticDiffPanel, projectSemanticDiff } from '../src/features/versions'

async function comparisonWithMovedNode() {
  const graph = createInvoiceFlowGraph()
  const resources = new MemoryDesignRepository()
  await resources.createProject(graph.project)
  await resources.createDocument(graph.document)
  const graphs = new MemoryDesignGraphRepository([graph])
  const versions = new MemoryVersionRepository()
  let id = 0
  const service = new VersioningApplicationService(resources, graphs, versions, { id: () => `version-${++id}`, now: () => '2026-09-08T00:00:00.000Z' })
  const initial = await service.approveVersion((await service.createDraft(graph.document.id, 'designer')).id, 'reviewer')
  await service.createDraft(graph.document.id, 'designer')
  const canvas = new CanvasGraphApplicationService(resources, graphs, service)
  await canvas.moveNode(graph.document.id, 'node_dashboard_title', null)
  const changedDraft = (await versions.listVersions(graph.document.id)).find((version) => version.status === 'draft')!
  const changed = await service.approveVersion(changedDraft.id, 'reviewer')
  return service.compareVersions(initial.id, changed.id)
}

describe('semantic diff UI', () => {
  it('derives stable field-level semantic changes from the version comparison contract', async () => {
    const comparison = await comparisonWithMovedNode()
    expect(comparison.changes).toContainEqual({ entityType: 'node', entityId: 'node_dashboard_title', kind: 'updated' })
    expect(comparison.fieldChanges).toContainEqual(expect.objectContaining({ entityType: 'node', entityId: 'node_dashboard_title', path: 'parentId', before: 'node_dashboard_header', after: null }))
    const projection = projectSemanticDiff(comparison)
    expect(projection.groups).toContainEqual(expect.objectContaining({ entityType: 'node', entityId: 'node_dashboard_title' }))
  })

  it('renders semantic before/after values and explicit lifecycle states without fetching or persisting', async () => {
    const projection = projectSemanticDiff(await comparisonWithMovedNode())
    const ready = renderToStaticMarkup(createElement(SemanticDiffPanel, { projection }))
    const loading = renderToStaticMarkup(createElement(SemanticDiffPanel, { loading: true }))
    const empty = renderToStaticMarkup(createElement(SemanticDiffPanel))
    const error = renderToStaticMarkup(createElement(SemanticDiffPanel, { error: 'Version access is unavailable.' }))
    expect(ready).toContain('data-semantic-diff-state="changed"')
    expect(ready).toContain('node_dashboard_title')
    expect(ready).toContain('parentId')
    expect(ready).toContain('node_dashboard_header')
    expect(ready).toContain('None')
    expect(loading).toContain('data-semantic-diff-state="loading"')
    expect(empty).toContain('data-semantic-diff-state="empty"')
    expect(error).toContain('data-semantic-diff-state="error"')
  })

  it('renders an equivalent comparison as a clear no-change state', async () => {
    const comparison = { fromVersionId: 'v1', toVersionId: 'v2', fromHash: 'same', toHash: 'same', equivalent: true, changes: [], fieldChanges: [] }
    const html = renderToStaticMarkup(createElement(SemanticDiffPanel, { projection: projectSemanticDiff(comparison) }))
    expect(html).toContain('data-semantic-diff-state="equivalent"')
    expect(html).toContain('No semantic changes')
  })
})
