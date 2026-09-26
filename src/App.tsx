import { useEffect, useMemo, useRef, useState } from 'react'
import { ProposalReviewPanel, SemanticDiffPanel, VersionTrustPanel, projectSemanticDiff } from './features/versions'
import { loadGraphIntoCanvas } from './graph/canvasStoreAdapter'
import { projectDesignGraph } from './graph/graphProjection'
import { useCanvasStore } from './store/store'
import { AppShell } from './ui/shell'
import { WorkspaceApiError, WorkspaceProvider, fetchVersionComparison, resolveProposalTarget, resolveVersionComparisonTarget, useWorkspaceContext } from './workspace'
import type { VersionComparison } from '../server/domain/version-types'
import { CopilotProposalPanel } from './features/copilot'
import { HandoffPanel } from './features/handoff'
import EditorWorkspace from './features/editor/EditorWorkspace'
import { CapabilityOverview } from './features/overview'
import NewDesignScreen from './features/home/NewDesignScreen'
import AgentStatusPanel from './features/agent/AgentStatusPanel'
import DesignSystemPanel from './features/design-system/DesignSystemPanel'
import { ToastContainer } from './ui/toast'

function WorkspaceState({ title, message, code }: { title: string; message: string; code: string }) {
  return <div className="flex h-full min-h-0 items-center justify-center p-6"><section className="max-w-md rounded-panel border border-border-default bg-panel p-6 shadow-panel" role="status" data-workspace-state={code}><p className="text-sm font-semibold text-text-primary">{title}</p><p className="mt-2 text-sm leading-6 text-text-secondary">{message}</p></section></div>
}

const STATE_COPY: Record<string, { title: string; message: string }> = {
  GRAPH_LOADING: { title: 'Opening your design', message: 'Loading the latest saved design for this project.' },
  GRAPH_INVALID: { title: 'This design needs attention', message: 'The saved design could not be validated. Open a recent version or start a new design.' },
  GRAPH_UNAVAILABLE: { title: 'Design unavailable', message: 'CollabCanvas could not load this design. If you are running locally, start the API with `npm run api` and reload.' },
}

function WorkspaceApp() {
  const context = useWorkspaceContext()
  const selection = useCanvasStore((state) => state.selection)
  const projection = useMemo(() => context.graph ? projectDesignGraph(context.graph, selection) : undefined, [context.graph, selection])
  const fittedDocument = useRef<string | null>(null)
  const [comparison, setComparison] = useState<VersionComparison | null>(null)
  const [comparisonLoading, setComparisonLoading] = useState(false)
  const [comparisonError, setComparisonError] = useState<string>()
  const [comparisonTarget, setComparisonTarget] = useState(() => typeof window === 'undefined' ? null : resolveVersionComparisonTarget(window.location))
  const [proposalTarget, setProposalTarget] = useState(() => typeof window === 'undefined' ? null : resolveProposalTarget(window.location))
  const [surface, setSurface] = useState(() => typeof window === 'undefined' ? 'canvas' : new URLSearchParams(window.location.search).get('surface') ?? 'canvas')

  useEffect(() => {
    const onPopState = () => { setComparisonTarget(resolveVersionComparisonTarget(window.location)); setProposalTarget(resolveProposalTarget(window.location)); setSurface(new URLSearchParams(window.location.search).get('surface') ?? 'canvas') }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (!context.graph) return
    const store = useCanvasStore.getState()
    const previousSelection = store.selection
    loadGraphIntoCanvas(context.graph, store.loadSnapshot)
    store.setSelection(previousSelection.filter((id) => context.graph!.nodes.some((node) => node.id === id)))
    if (fittedDocument.current !== context.documentId) {
      fittedDocument.current = context.documentId
      store.zoomToFit()
    }
  }, [context.graph, context.documentId])

  useEffect(() => {
    const tokens = context.graph?.tokens ?? []
    const root = document.documentElement
    for (const token of tokens) {
      const varName = `--cc-token-${token.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
      root.style.setProperty(varName, String(token.value))
    }
  }, [context.graph?.tokens])

  useEffect(() => {
    if (!comparisonTarget) {
      setComparison(null)
      setComparisonLoading(false)
      setComparisonError(undefined)
      return
    }
    let active = true
    const controller = new AbortController()
    setComparisonLoading(true)
    setComparisonError(undefined)
    void fetchVersionComparison(comparisonTarget, controller.signal)
      .then((result) => {
        if (active) {
          setComparison(result)
          setComparisonLoading(false)
        }
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return
        setComparison(null)
        setComparisonLoading(false)
        setComparisonError(error instanceof WorkspaceApiError ? error.message : 'The semantic version comparison is unavailable.')
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [comparisonTarget])

  if (!context.identifiers) return <NewDesignScreen />

  const state = context.availability === 'GRAPH_LOADING' || context.availability === 'GRAPH_INVALID' || context.availability === 'GRAPH_UNAVAILABLE'
    ? { title: STATE_COPY[context.availability].title, message: context.error?.message && context.availability !== 'GRAPH_LOADING' ? context.error.message : STATE_COPY[context.availability].message, code: context.availability }
    : null

  return <AppShell
    layersProjection={projection?.layers}
    inspectorProjection={projection?.inspector}
    onUpdateNode={context.updateNode}
    workspace={{ project: context.project, document: context.document, page: context.page, availability: context.availability }}
  >
    {comparisonTarget
      ? <SemanticDiffPanel projection={comparison ? projectSemanticDiff(comparison) : undefined} loading={comparisonLoading} error={comparisonError} />
      : state ? <WorkspaceState {...state} /> : proposalTarget ? <ProposalReviewPanel projectId={context.projectId} documentId={context.documentId} proposalId={proposalTarget.proposalId} /> : surface === 'versions'
        ? <div className="h-full overflow-y-auto p-4"><VersionTrustPanel projectId={context.projectId} documentId={context.documentId} /></div>
        : surface === 'handoff'
          ? <div className="h-full overflow-y-auto p-4"><HandoffPanel /></div>
        : surface === 'assistant' || surface === 'agent-center'
          ? <div className="h-full overflow-y-auto p-4"><CopilotProposalPanel /></div>
          : surface === 'implementation'
            ? <div className="h-full overflow-y-auto p-4"><AgentStatusPanel projectId={context.projectId} documentId={context.documentId} /></div>
          : surface === 'overview'
            ? <CapabilityOverview />
            : surface === 'design-system'
              ? context.graph && context.documentId
                ? <DesignSystemPanel documentId={context.documentId} graph={context.graph} onGraphChange={() => context.refreshGraph?.()} />
                : <div className="flex h-full items-center justify-center p-6 text-sm text-text-secondary">Open a workspace to manage the design system.</div>
              : surface === 'assets'
                ? (
                  <div className="h-full overflow-y-auto p-6">
                    <h1 className="text-xl font-semibold text-text-primary">Assets</h1>
                    {(context.graph?.assets ?? []).length === 0 ? (
                      <div className="mt-12 flex flex-col items-center gap-3 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-dashed border-border-default">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 text-text-muted">
                            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-text-primary">No assets yet</p>
                          <p className="mt-1 max-w-xs text-xs text-text-muted">Add images to canvas elements and they will appear here for reuse across your design.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-6 grid gap-3 sm:grid-cols-2">
                        {(context.graph?.assets ?? []).map((asset) => (
                          <div key={asset.id} className="rounded-card border border-border-default bg-panel p-4">
                            <p className="text-sm font-medium">{asset.name}</p>
                            <p className="mt-1 text-xs text-text-muted">{asset.kind} · {asset.altText}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
                : context.availability === 'GRAPH_AVAILABLE'
                  ? <EditorWorkspace />
                  : <WorkspaceState {...state!} />}
  </AppShell>
}

export default function App() {
  return (
    <>
      <WorkspaceProvider><WorkspaceApp /></WorkspaceProvider>
      <ToastContainer />
    </>
  )
}
