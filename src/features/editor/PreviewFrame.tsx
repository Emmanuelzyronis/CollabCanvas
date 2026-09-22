import type { ReactNode } from 'react'
import { configFor, useViewportStore } from './viewportStore'

interface PreviewFrameProps {
  children: ReactNode
}

/**
 * Wraps the canvas in a constrained device frame when a non-desktop viewport
 * preset is active. In desktop mode the children are rendered as-is so
 * existing canvas behaviour is fully preserved.
 *
 * Viewport presentation state is intentionally local (§7 AGENTS.md). The
 * preset never affects the canonical Design Graph — only the editing surface
 * geometry changes.
 */
export default function PreviewFrame({ children }: PreviewFrameProps) {
  const preset = useViewportStore((s) => s.preset)
  const config = configFor(preset)

  if (config.width === null) {
    // Desktop — full-width canvas, no frame chrome
    return <>{children}</>
  }

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-hidden bg-canvas p-6"
      data-preview-frame-host="true"
    >
      {/* Device outline */}
      <div
        data-preview-frame="true"
        data-viewport={preset}
        style={{ width: config.width, maxWidth: '100%' }}
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border-default bg-canvas shadow-floating ring-1 ring-border-subtle"
        aria-label={`Canvas preview at ${config.breakpointLabel}`}
      >
        {children}
      </div>

      {/* Breakpoint label */}
      <p
        data-preview-label="true"
        className="shrink-0 rounded-full border border-border-subtle bg-panel/90 px-3 py-1 text-[11px] font-medium text-text-muted backdrop-blur"
        aria-live="polite"
      >
        {config.breakpointLabel}
      </p>
    </div>
  )
}
