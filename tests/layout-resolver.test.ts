import { describe, expect, it } from 'vitest'
import type { DesignGraph, DesignNode, LayoutConstraints, NodeType } from '../server/domain/contracts'
import { resolveLayout } from '../src/graph/layoutResolver'
import { graphToCanvasProjection } from '../src/graph/canvasProjection'
import { wrapTextToWidth } from '../src/graph/textMetrics'

const STAMP = '2026-09-11T00:00:00.000Z'

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
    project: { id: 'project-1', name: 'P', slug: 'p', createdAt: STAMP, updatedAt: STAMP },
    document: { id: 'document-1', projectId: 'project-1', name: 'D', createdAt: STAMP, updatedAt: STAMP },
    page: { id: 'page-1', documentId: 'document-1', name: 'Page', routeHint: null, createdAt: STAMP, updatedAt: STAMP },
    nodes,
    componentDefinitions: [],
    componentInstances: [],
    tokens: [],
    typography: [],
    assets: [],
    intents: [],
  }
}

const box = (layout: ReturnType<typeof resolveLayout>, id: string) => layout.boxes.get(id)!

describe('structural layout resolver', () => {
  it('stacks children in a column using padding and gap', () => {
    const section = node('section', 'section', {
      display: 'stack',
      direction: 'column',
      gap: 20,
      padding: { top: 40, right: 40, bottom: 40, left: 40 },
      align: 'start',
      position: 'absolute',
      x: 100,
      y: 50,
      width: 600,
      height: 400,
    })
    const heading = node('heading', 'heading', { width: 200, height: 60, position: 'flow' }, { parentId: 'section', orderIndex: 0 })
    const cta = node('cta', 'button', { width: 160, height: 48, position: 'flow' }, { parentId: 'section', orderIndex: 1 })

    const layout = resolveLayout(graph([section, heading, cta]))

    expect(box(layout, 'section')).toEqual({ x: 100, y: 50, width: 600, height: 400 })
    expect(box(layout, 'heading')).toEqual({ x: 140, y: 90, width: 200, height: 60 })
    expect(box(layout, 'cta')).toEqual({ x: 140, y: 170, width: 160, height: 48 })
  })

  it('centres cross-axis children and honours space-between justification', () => {
    const section = node('section', 'section', {
      display: 'flex',
      direction: 'column',
      gap: 0,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      align: 'center',
      justify: 'space-between',
      position: 'absolute',
      x: 0,
      y: 0,
      width: 400,
      height: 300,
    })
    const a = node('a', 'button', { width: 100, height: 40, position: 'flow' }, { parentId: 'section', orderIndex: 0 })
    const b = node('b', 'button', { width: 100, height: 40, position: 'flow' }, { parentId: 'section', orderIndex: 1 })

    const layout = resolveLayout(graph([section, a, b]))

    expect(box(layout, 'a')).toEqual({ x: 150, y: 0, width: 100, height: 40 })
    expect(box(layout, 'b')).toEqual({ x: 150, y: 260, width: 100, height: 40 })
  })

  it('shares remaining main-axis space between fill children', () => {
    const row = node('row', 'section', {
      display: 'flex',
      direction: 'row',
      gap: 24,
      padding: { top: 24, right: 24, bottom: 24, left: 24 },
      align: 'start',
      position: 'absolute',
      x: 0,
      y: 0,
      width: 720,
      height: 200,
    })
    const one = node('one', 'card', { width: 'fill', height: 120, position: 'flow' }, { parentId: 'row', orderIndex: 0 })
    const two = node('two', 'card', { width: 'fill', height: 120, position: 'flow' }, { parentId: 'row', orderIndex: 1 })

    const layout = resolveLayout(graph([row, one, two]))

    // content width 720 - 48 padding = 672; minus one 24 gap = 648; shared = 324
    expect(box(layout, 'one').width).toBe(324)
    expect(box(layout, 'two').width).toBe(324)
    expect(box(layout, 'one').x).toBe(24)
    expect(box(layout, 'two').x).toBe(24 + 324 + 24)
  })

  it('hugs content when the container height is auto', () => {
    const section = node('section', 'section', {
      display: 'stack',
      direction: 'column',
      gap: 16,
      padding: { top: 32, right: 32, bottom: 32, left: 32 },
      position: 'absolute',
      x: 0,
      y: 0,
      width: 800,
    })
    const a = node('a', 'text', { width: 'fill', height: 40, position: 'flow' }, { parentId: 'section', orderIndex: 0 })
    const b = node('b', 'text', { width: 'fill', height: 24, position: 'flow' }, { parentId: 'section', orderIndex: 1 })

    const layout = resolveLayout(graph([section, a, b]))

    expect(box(layout, 'section').height).toBe(32 + 40 + 16 + 24 + 32)
    expect(box(layout, 'a').x).toBe(32)
    expect(box(layout, 'a').width).toBe(736)
  })

  it('keeps a hand-placed child absolute when it carries x/y', () => {
    const section = node('section', 'section', {
      display: 'stack',
      direction: 'column',
      gap: 12,
      padding: { top: 20, right: 20, bottom: 20, left: 20 },
      position: 'absolute',
      x: 0,
      y: 0,
      width: 500,
      height: 400,
    })
    const dragged = node('dragged', 'button', { position: 'absolute', x: 260, y: 310, width: 120, height: 44 }, { parentId: 'section' })

    const layout = resolveLayout(graph([section, dragged]))

    expect(box(layout, 'dragged')).toEqual({ x: 260, y: 310, width: 120, height: 44 })
  })

  it('honours an explicit flow position even when stray coordinates are present', () => {
    const section = node('section', 'section', {
      display: 'stack',
      direction: 'column',
      gap: 10,
      padding: { top: 10, right: 10, bottom: 10, left: 10 },
      position: 'absolute',
      x: 0,
      y: 0,
      width: 300,
      height: 200,
    })
    const stray = node('stray', 'button', { position: 'flow', x: 0, y: 0, width: 100, height: 40 }, { parentId: 'section' })

    expect(box(resolveLayout(graph([section, stray])), 'stray')).toEqual({ x: 10, y: 10, width: 100, height: 40 })
  })

  it('leaves graphs without structural layout untouched (migration safety)', () => {
    const a = node('a', 'heading', { x: 10, y: 20, width: 200, height: 50 })
    const b = node('b', 'text', { x: 30, y: 90, width: 180, height: 40 }, { parentId: 'a' })

    const layout = resolveLayout(graph([a, b]))

    expect(box(layout, 'a')).toEqual({ x: 10, y: 20, width: 200, height: 50 })
    expect(box(layout, 'b')).toEqual({ x: 30, y: 90, width: 180, height: 40 })
    const projection = graphToCanvasProjection(graph([a, b]))
    expect(projection.elements.find((el) => el.id === 'b')).toMatchObject({ x: 30, y: 90, width: 180, height: 40 })
  })

  it('measures auto text height honestly instead of guessing a fixed box', () => {
    const short = node('short', 'text', { width: 400, position: 'absolute', x: 0, y: 0 }, { properties: { text: 'One line', fontSize: 16, lineHeight: 1.5 } })
    const long = node('long', 'text', { width: 120, position: 'absolute', x: 0, y: 0 }, { properties: { text: 'A headline that must wrap across several lines of copy', fontSize: 16, lineHeight: 1.5 } })

    const layout = resolveLayout(graph([short, long]))

    expect(box(layout, 'short').height).toBe(24)
    expect(box(layout, 'long').height).toBeGreaterThan(box(layout, 'short').height)
  })
})

describe('shared text wrapping', () => {
  it('breaks lines at measured width, not a fixed character count', () => {
    const style = { fontSize: 16, fontWeight: 400, lineHeight: 1.5 }
    const narrow = wrapTextToWidth('Design at the speed of thought', 120, style)
    const wide = wrapTextToWidth('Design at the speed of thought', 1200, style)
    expect(narrow.length).toBeGreaterThan(1)
    expect(wide).toEqual(['Design at the speed of thought'])
  })
})
