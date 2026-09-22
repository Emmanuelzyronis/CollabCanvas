import clsx from 'clsx'
import { VIEWPORT_PRESETS, useViewportStore, type ViewportPreset } from './viewportStore'

const GLYPHS: Record<ViewportPreset, string> = {
  mobile:  '▱',
  tablet:  '▭',
  desktop: '▬',
}

export default function ViewportToggle() {
  const preset  = useViewportStore((s) => s.preset)
  const setPreset = useViewportStore((s) => s.setPreset)

  return (
    <div
      role="toolbar"
      aria-label="Responsive viewport"
      data-viewport-toggle="true"
      className="flex items-center gap-0.5 rounded-xl border border-border-default bg-panel/90 p-0.5 shadow-subtle backdrop-blur"
    >
      {VIEWPORT_PRESETS.map((vp) => {
        const active = preset === vp.id
        return (
          <button
            key={vp.id}
            type="button"
            aria-label={`Preview at ${vp.label} width`}
            aria-pressed={active}
            title={vp.breakpointLabel}
            data-viewport={vp.id}
            onClick={() => setPreset(vp.id)}
            className={clsx(
              'flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors duration-[var(--cc-duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              active
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-text-secondary hover:bg-hover hover:text-text-primary',
            )}
          >
            <span aria-hidden="true" className="text-[10px]">{GLYPHS[vp.id]}</span>
            <span>{vp.label}</span>
            {vp.width !== null && (
              <span className={clsx('hidden sm:inline', active ? 'text-blue-200' : 'text-text-muted')}>
                {vp.width}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
