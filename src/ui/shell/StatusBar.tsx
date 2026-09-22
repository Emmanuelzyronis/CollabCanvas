import { useCanvasStore } from '../../store/store'
import { configFor, useViewportStore } from '../../features/editor/viewportStore'
import type { GraphAvailability } from '../../workspace'

const STATUS_COLORS: Record<GraphAvailability, string> = {
  GRAPH_AVAILABLE:   'var(--cc-emerald-500)',
  GRAPH_LOADING:     'var(--cc-amber-500)',
  GRAPH_INVALID:     'var(--cc-red-500)',
  GRAPH_UNAVAILABLE: 'var(--cc-red-500)',
}

export default function StatusBar({ workspaceStatus }: { workspaceStatus?: GraphAvailability }) {
  const zoom = useCanvasStore((state) => state.camera.zoom)
  const selectionCount = useCanvasStore((state) => state.selection.length)
  const agent = useCanvasStore((state) => state.agent)
  const viewportPreset = useViewportStore((s) => s.preset)
  const viewportConfig = configFor(viewportPreset)

  const dotColor = workspaceStatus ? (STATUS_COLORS[workspaceStatus] ?? 'var(--cc-neutral-400)') : 'var(--cc-neutral-400)'

  return (
    <footer
      className="relative z-30 flex min-h-8 shrink-0 items-center justify-between gap-3 px-3 text-[11px] sm:px-4"
      style={{
        background: 'var(--cc-panel)',
        borderTop: '1px solid var(--cc-border-subtle)',
        color: 'var(--cc-text-muted)',
      }}
      aria-label="Canvas status bar"
      data-availability={workspaceStatus ?? 'none'}
    >
      <div className="flex items-center gap-3">
        {/* Status dot */}
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: dotColor }} />
          <span>
            {workspaceStatus === 'GRAPH_AVAILABLE' ? 'Ready'
              : workspaceStatus === 'GRAPH_LOADING' ? 'Loading'
              : workspaceStatus === 'GRAPH_INVALID' ? 'Attention'
              : workspaceStatus === 'GRAPH_UNAVAILABLE' ? 'Unavailable'
              : 'No workspace'}
          </span>
        </div>

        <span className="opacity-30">·</span>
        <span>{Math.round(zoom * 100)}%</span>

        {selectionCount > 0 && (
          <>
            <span className="opacity-30">·</span>
            <span>{selectionCount} selected</span>
          </>
        )}

        {workspaceStatus === 'GRAPH_AVAILABLE' && (
          <>
            <span className="opacity-30 hidden sm:inline">·</span>
            <span className="hidden sm:inline" data-viewport-status="true">{viewportConfig.breakpointLabel}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {agent.status && (
          <div
            className="flex items-center gap-1.5 rounded-full px-2 py-0.5"
            style={{
              background: 'rgba(124,58,237,0.1)',
              border: '1px solid rgba(124,58,237,0.2)',
              color: 'var(--cc-violet-600)',
            }}
          >
            <span className="h-1 w-1 rounded-full" style={{ background: 'var(--cc-violet-500)' }} />
            <span className="text-[10px] font-medium">{agent.status}</span>
          </div>
        )}
        <span
          className="rounded-full px-2 py-0.5"
          style={{
            background: 'var(--cc-surface)',
            border: '1px solid var(--cc-border-subtle)',
            color: 'var(--cc-text-muted)',
          }}
        >
          Local
        </span>
      </div>
    </footer>
  )
}
