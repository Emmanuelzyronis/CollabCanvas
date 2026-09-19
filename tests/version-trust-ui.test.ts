import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createInvoiceFlowGraph } from '../server/domain/fixtures/invoiceflow'
import { ProposalReviewPanel, VersionTrustPanel } from '../src/features/versions'
import { buildProposalReviewHref, resolveProposalTarget } from '../src/workspace'

describe('Layer 18 version and proposal trust UI', () => {
  it('renders version trust and proposal review as application-backed surfaces', () => {
    const graph = createInvoiceFlowGraph()
    const versions = renderToStaticMarkup(createElement(VersionTrustPanel, { projectId: graph.project.id, documentId: graph.document.id }))
    const proposal = renderToStaticMarkup(createElement(ProposalReviewPanel, { projectId: graph.project.id, documentId: graph.document.id, proposalId: 'proposal-1' }))
    expect(versions).toContain('data-version-trust-state="loading"')
    expect(versions).toContain('Approved designs are immutable')
    expect(proposal).toContain('data-proposal-review-state="loading"')
    expect(proposal).toContain('before it becomes part of your design')
  })

  it('resolves proposal identity from URL state only', () => {
    expect(resolveProposalTarget({ search: '?proposalId=proposal-1' })).toEqual({ proposalId: 'proposal-1' })
    expect(resolveProposalTarget({ search: '' })).toBeNull()
  })

  it('preserves workspace context when opening proposal review', () => {
    expect(buildProposalReviewHref({ search: '?projectId=p&documentId=d&pageId=pg&fromVersion=v1' }, { projectId: 'p', documentId: 'd', pageId: 'pg' }, 'proposal-1'))
      .toBe('?projectId=p&documentId=d&pageId=pg&fromVersion=v1&proposalId=proposal-1')
  })
})
