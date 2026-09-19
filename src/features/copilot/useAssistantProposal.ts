import { useCallback, useEffect, useState } from 'react'
import type { CopilotProposalPreview } from '../../../server/domain/copilot-types'
import { fetchVersions, generateCopilotProposal, WorkspaceApiError, useWorkspaceContext } from '../../workspace'
import { useCanvasStore } from '../../store/store'

function countLabel(count: number): string {
  return count === 1 ? '1 element' : `${count} elements`
}

/**
 * How much a suggestion touches. A created layer has no identity until the
 * suggestion is applied, so `affectedResourceIds` cannot include it; counting
 * creations separately is what makes the number honest instead of zero.
 */
export function proposalImpact(preview: CopilotProposalPreview): number {
  const created = preview.operations.filter((operation) => operation.type === 'createNode').length
  return preview.affectedResourceIds.length + created
}

/**
 * The one way the interface asks the assistant for a suggestion.
 *
 * It resolves the working version the suggestion must be based on — the active
 * draft when one exists, otherwise the latest saved version — so every entry
 * point (the canvas start surface and the assistant panel) proposes against the
 * same state. Nothing is applied here: the assistant only ever produces a
 * proposal for the human to review.
 */
export function useAssistantProposal() {
  const workspace = useWorkspaceContext()
  const selectedNodeIds = useCanvasStore((state) => state.selection)
  const [baseVersionId, setBaseVersionId] = useState<string>()
  const [preview, setPreview] = useState<CopilotProposalPreview>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!workspace.projectId || !workspace.documentId) return
    const fromContext = workspace.version?.id
    if (fromContext) setBaseVersionId(fromContext)
    void fetchVersions(workspace.projectId, workspace.documentId)
      .then((versions) => {
        const draft = versions.find((version) => version.status === 'draft')
        const approved = versions.filter((version) => version.status === 'approved').sort((a, b) => b.number - a.number)[0]
        setBaseVersionId(fromContext ?? draft?.id ?? approved?.id)
      })
      .catch(() => undefined)
  }, [workspace.projectId, workspace.documentId, workspace.version?.id])

  const ready = Boolean(baseVersionId) && workspace.availability === 'GRAPH_AVAILABLE'

  const ask = useCallback(async (instruction: string) => {
    if (!baseVersionId || !instruction.trim()) return
    setBusy(true)
    setError(undefined)
    setPreview(undefined)
    try {
      const result = await generateCopilotProposal({
        projectId: workspace.projectId,
        documentId: workspace.documentId,
        pageId: workspace.pageId,
        baseVersionId,
        trustedVersionId: baseVersionId,
        instruction: instruction.trim(),
        selectedNodeIds,
        author: 'copilot',
      })
      setPreview(result)
      if (result.proposal) useCanvasStore.getState().logActivity('agent', 'generate', `Suggestion ready to review · ${countLabel(proposalImpact(result))} affected`, result.affectedResourceIds)
    } catch (caught) {
      setError(caught instanceof WorkspaceApiError ? caught.message : 'The design assistant is unavailable right now.')
    } finally {
      setBusy(false)
    }
  }, [baseVersionId, selectedNodeIds, workspace.projectId, workspace.documentId, workspace.pageId])

  const clear = useCallback(() => {
    setPreview(undefined)
    setError(undefined)
  }, [])

  return { ask, busy, clear, error, preview, ready, selectedNodeIds }
}
