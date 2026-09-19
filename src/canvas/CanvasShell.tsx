import Canvas from './Canvas'
import type { CanvasEditorHandlers } from './Canvas'

/** Structural B9 boundary mounted inside the AppShell-owned canvas workspace. */
export default function CanvasShell(props: CanvasEditorHandlers) {
  return (
    <section className="h-full min-h-0 min-w-0 overflow-hidden" aria-label="Design canvas">
      <Canvas {...props} />
    </section>
  )
}
