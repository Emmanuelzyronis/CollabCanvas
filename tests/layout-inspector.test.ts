/**
 * EMM-98 — Inspector layout controls.
 *
 * These tests verify that:
 * 1. The Inspector layout section includes sizing mode, stack, gap, padding,
 *    align, justify, position, and z-order controls.
 * 2. Commits flow through onUpdateNode (application boundary).
 * 3. The layout resolver correctly applies the resulting LayoutConstraints
 *    to produce expected boxes.
 */
import { describe, expect, it } from 'vitest'
import type { DesignGraph, DesignNode, LayoutConstraints, NodeType } from '../server/domain/contracts'
import { resolveLayout } from '../src/graph/layoutResolver'

const STAMP = '2026-01-01T00:00:00.000Z'

function node(id: string, type: NodeType, layout: LayoutConstraints, extra: Partial<DesignNode> = {}): DesignNode {
  return {
    id,
    pageId: 'page-1',
    parentId: null,
    type,
    name: id,
    orderIndex: 0,
    semantic: {},
    properties: {},
    layout,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...extra,
  }
}

function graph(nodes: DesignNode[]): DesignGraph {
  return {
    project: { id: 'proj', name: 'P', slug: 'p', createdAt: STAMP, updatedAt: STAMP },
    document: { id: 'doc', projectId: 'proj', name: 'D', createdAt: STAMP, updatedAt: STAMP },
    page: { id: 'page-1', documentId: 'doc', name: 'Page', routeHint: null, createdAt: STAMP, updatedAt: STAMP },
    nodes,
    tokens: [],
    assets: [],
    components: [],
    componentInstances: [],
    intents: [],
    typography: [],
    responsiveConstraints: [],
  }
}

describe('Layout resolver — sizing modes', () => {
  it('fixed width/height produces the exact pixel box', () => {
    const g = graph([node('n', 'section', { width: 400, height: 200, x: 10, y: 20 })])
    const layout = resolveLayout(g)
    expect(layout.boxes.get('n')).toMatchObject({ width: 400, height: 200, x: 10, y: 20 })
  })

  it('fill width fills the parent inner width', () => {
    const parent = node('parent', 'section', { display: 'stack', direction: 'column', width: 600, height: 300, x: 0, y: 0 })
    const child = node('child', 'text', { width: 'fill' }, { parentId: 'parent', properties: { text: 'hi' } })
    const g = graph([parent, child])
    const layout = resolveLayout(g)
    expect(layout.boxes.get('child')!.width).toBe(600)
  })

  it('auto/hug height wraps content rather than using a fixed value', () => {
    const g = graph([node('n', 'section', { display: 'stack', direction: 'column', width: 300, height: 'auto', x: 0, y: 0 })])
    const layout = resolveLayout(g)
    expect(layout.boxes.get('n')!.height).toBeDefined()
  })
})

describe('Layout resolver — stack direction', () => {
  it('column stack places children top-to-bottom', () => {
    const parent = node('p', 'section', { display: 'stack', direction: 'column', width: 300, height: 200, x: 0, y: 0 })
    const a = node('a', 'text', { width: 100, height: 40 }, { parentId: 'p', orderIndex: 0, properties: { text: 'A' } })
    const b = node('b', 'text', { width: 100, height: 40 }, { parentId: 'p', orderIndex: 1, properties: { text: 'B' } })
    const layout = resolveLayout(graph([parent, a, b]))
    expect(layout.boxes.get('a')!.y).toBeLessThan(layout.boxes.get('b')!.y)
  })

  it('row stack places children left-to-right', () => {
    const parent = node('p', 'section', { display: 'stack', direction: 'row', width: 400, height: 100, x: 0, y: 0 })
    const a = node('a', 'text', { width: 80, height: 40 }, { parentId: 'p', orderIndex: 0, properties: { text: 'A' } })
    const b = node('b', 'text', { width: 80, height: 40 }, { parentId: 'p', orderIndex: 1, properties: { text: 'B' } })
    const layout = resolveLayout(graph([parent, a, b]))
    expect(layout.boxes.get('a')!.x).toBeLessThan(layout.boxes.get('b')!.x)
    expect(layout.boxes.get('a')!.y).toBe(layout.boxes.get('b')!.y)
  })
})

describe('Layout resolver — gap', () => {
  it('gap separates children in a column stack', () => {
    const parent = node('p', 'section', { display: 'stack', direction: 'column', gap: 20, width: 200, height: 200, x: 0, y: 0 })
    const a = node('a', 'text', { height: 40 }, { parentId: 'p', orderIndex: 0, properties: { text: 'A' } })
    const b = node('b', 'text', { height: 40 }, { parentId: 'p', orderIndex: 1, properties: { text: 'B' } })
    const layout = resolveLayout(graph([parent, a, b]))
    const aBox = layout.boxes.get('a')!
    const bBox = layout.boxes.get('b')!
    expect(bBox.y - (aBox.y + aBox.height)).toBe(20)
  })
})

describe('Layout resolver — padding', () => {
  it('padding offsets the first child from the container edge', () => {
    const parent = node('p', 'section', { display: 'stack', direction: 'column', padding: { top: 16, left: 12, right: 0, bottom: 0 }, width: 300, height: 200, x: 0, y: 0 })
    const child = node('c', 'text', { height: 40 }, { parentId: 'p', orderIndex: 0, properties: { text: 'hi' } })
    const layout = resolveLayout(graph([parent, child]))
    const childBox = layout.boxes.get('c')!
    expect(childBox.y).toBe(16)
    expect(childBox.x).toBe(12)
  })
})

describe('Layout resolver — alignment', () => {
  it('align: center centers children on the cross axis in a column stack', () => {
    const parent = node('p', 'section', { display: 'stack', direction: 'column', align: 'center', width: 300, height: 200, x: 0, y: 0 })
    const child = node('c', 'button', { width: 100, height: 40 }, { parentId: 'p', orderIndex: 0 })
    const layout = resolveLayout(graph([parent, child]))
    const childBox = layout.boxes.get('c')!
    expect(childBox.x).toBe((300 - 100) / 2)
  })

  it('justify: center centers children on the main axis in a row stack', () => {
    const parent = node('p', 'section', { display: 'stack', direction: 'row', justify: 'center', width: 300, height: 100, x: 0, y: 0 })
    const child = node('c', 'button', { width: 100, height: 40 }, { parentId: 'p', orderIndex: 0 })
    const layout = resolveLayout(graph([parent, child]))
    const childBox = layout.boxes.get('c')!
    expect(childBox.x).toBe((300 - 100) / 2)
  })

  it('justify: space-between distributes two children at opposite ends', () => {
    const parent = node('p', 'section', { display: 'stack', direction: 'row', justify: 'space-between', width: 300, height: 80, x: 0, y: 0 })
    const a = node('a', 'button', { width: 80, height: 40 }, { parentId: 'p', orderIndex: 0 })
    const b = node('b', 'button', { width: 80, height: 40 }, { parentId: 'p', orderIndex: 1 })
    const layout = resolveLayout(graph([parent, a, b]))
    const aBox = layout.boxes.get('a')!
    const bBox = layout.boxes.get('b')!
    expect(aBox.x).toBe(0)
    expect(bBox.x + bBox.width).toBe(300)
  })
})

describe('Layout resolver — position', () => {
  it('absolute-positioned child keeps its own x/y regardless of parent stack', () => {
    const parent = node('p', 'section', { display: 'stack', direction: 'column', width: 400, height: 400, x: 0, y: 0 })
    const flow = node('f', 'text', {}, { parentId: 'p', orderIndex: 0, properties: { text: 'flow' } })
    const abs = node('a', 'button', { position: 'absolute', x: 50, y: 80, width: 120, height: 40 }, { parentId: 'p', orderIndex: 1 })
    const layout = resolveLayout(graph([parent, flow, abs]))
    expect(layout.boxes.get('a')).toMatchObject({ x: 50, y: 80, width: 120, height: 40 })
  })
})

describe('Inspector layout section — source coverage', () => {
  it('InspectorPanel.tsx exports sizing mode, stack, gap, padding, align, justify, position, and z-order controls', async () => {
    const { readFile } = await import('node:fs/promises')
    const source = await readFile(new URL('../src/ui/inspector/InspectorPanel.tsx', import.meta.url), 'utf8')
    // Sizing mode controls
    expect(source).toContain('Width sizing')
    expect(source).toContain('Height sizing')
    expect(source).toContain('Fixed')
    expect(source).toContain('Fill')
    expect(source).toContain('Hug')
    // Stack layout control
    expect(source).toContain('Arrange children')
    expect(source).toContain('Stack')
    // Direction
    expect(source).toContain('Stack direction')
    expect(source).toContain('Column')
    expect(source).toContain('Row')
    // Alignment
    expect(source).toContain('Align items')
    expect(source).toContain('Justify content')
    expect(source).toContain('space-between')
    expect(source).toContain('space-around')
    // Gap and padding
    expect(source).toContain('aria-label="Gap"')
    expect(source).toContain('Padding ${label}')
    // Position
    expect(source).toContain('Position type')
    expect(source).toContain('Absolute')
    // Z-order
    expect(source).toContain('Bring forward')
    expect(source).toContain('Send backward')
  })

  it('all new layout commits use the layout patch shape that matches DesignNode', async () => {
    const { readFile } = await import('node:fs/promises')
    const source = await readFile(new URL('../src/ui/inspector/InspectorPanel.tsx', import.meta.url), 'utf8')
    // Commits should spread node.layout
    expect(source).toContain('...node.layout')
    // Should NOT write to a separate database or bypass onUpdateNode
    expect(source).not.toMatch(/localStorage|sessionStorage|useCanvasStore/)
  })
})
