import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createInvoiceFlowGraph } from '../server/domain/fixtures/invoiceflow'
import { compileDesignManifest } from '../server/domain/manifest-compiler'
import { buildAgentBrief, handoffFailure, handoffLoading, projectHandoff } from '../src/features/handoff/handoffProjection'
import HandoffPanel from '../src/features/handoff/HandoffPanel'
import { WorkspaceProvider } from '../src/workspace'

const manifest = compileDesignManifest(createInvoiceFlowGraph())

describe('handoff projection', () => {
  it('summarizes the real design with designer-facing counts', () => {
    const state = projectHandoff(manifest)
    expect(state.availability).toBe('HANDOFF_READY')
    const counts = Object.fromEntries((state.summary?.counts ?? []).map((count) => [count.label, count.value]))
    expect(counts.Pages).toBe(manifest.pages.length)
    expect(counts.Layers).toBe(manifest.nodes.length)
    expect(counts.Components).toBe(manifest.componentDefinitions.length)
    expect(counts.Tokens).toBe(manifest.tokens.length)
    expect(counts['Text styles']).toBe(manifest.typography.length)
    expect(state.summary!.bytes).toBeGreaterThan(0)
  })

  it('keeps the design file byte-identical to a second projection of the same design', () => {
    const first = projectHandoff(manifest)
    const second = projectHandoff(compileDesignManifest(createInvoiceFlowGraph()))
    expect(second.summary!.json).toBe(first.summary!.json)
  })

  it('outlines the hierarchy depth-first with human-readable kinds', () => {
    const outline = projectHandoff(manifest).summary!.outline
    expect(outline.length).toBe(manifest.nodes.length)
    expect(outline.some((row) => row.depth > 0)).toBe(true)
    expect(outline.map((row) => row.kind)).toContain('Component')
    expect(outline.every((row) => row.name.length > 0)).toBe(true)
  })

  it('writes an implementation brief a coding agent can act on', () => {
    const brief = buildAgentBrief(manifest)
    expect(brief).toContain(manifest.project.name)
    expect(brief).toContain(`## Page: ${manifest.pages[0].name}`)
    expect(brief).toContain('Create invoice')
    if (manifest.tokens.length > 0) expect(brief).toContain('## Design tokens')
    if (manifest.typography.length > 0) expect(brief).toContain('## Text styles')
    if (manifest.assets.length > 0) expect(brief).toContain('## Assets')
  })

  it('never leaks architecture vocabulary into the human-facing summary', () => {
    const state = projectHandoff(manifest)
    const visible = `${state.summary!.brief} ${state.summary!.outline.map((row) => row.kind).join(' ')}`
    expect(visible).not.toMatch(/design graph|graph node|canonical|webmcp|agent gateway|manifest/i)
  })

  it('exposes explicit loading and failure states', () => {
    expect(handoffLoading().availability).toBe('HANDOFF_LOADING')
    expect(handoffFailure('GRAPH_UNAVAILABLE', 'offline').availability).toBe('HANDOFF_UNAVAILABLE')
    expect(handoffFailure('INVALID_GRAPH', 'invalid').availability).toBe('HANDOFF_INVALID')
  })
})

describe('handoff surface', () => {
  it('renders a loading state before the design file is ready', () => {
    const html = renderToStaticMarkup(createElement(WorkspaceProvider, null, createElement(HandoffPanel)))
    expect(html).toContain('data-handoff-state="loading"')
  })
})
