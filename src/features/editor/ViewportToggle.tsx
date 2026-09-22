import clsx from 'clsx'
import { VIEWPORT_PRESETS, useViewportStore, type ViewportPreset } from './viewportStore'

const ICONS: Record<ViewportPreset, React.ReactNode> = {
  mobile: (
    <svg viewBox="0 0 14 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3">
      <rect x="2" y="1" width="10" height="16" rx="2" />
      <circle cx="7" cy="14.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  ),
  tablet: (
    <svg viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3.5">
      <rect x="1" y="2" width="16" height="10" rx="2" />
      <circle cx="15.5" cy="7" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  ),
  desktop: (
    <svg viewBox="0 0 20 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-4">
      <rect x="1" y="1" width="18" height="11" rx="2" />
      <path d="M7 15h6M10 12v3" />
    </svg>
  ),
}

export default function ViewportToggle() {
  const preset = useViewportStore((s) => s.preset)
  const setPreset = useViewportStore((s) => s.setPreset)

  return (
    <div
      role="toolbar"
      aria-label="Responsive viewport"
      data-viewport-toggle="true"
      className="flex items-center gap-0.5 rounded-lg p-0.5"
      style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
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
              'flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors duration-[var(--cc-duration-fast)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--cc-indigo-500)]',
              active
                ? 'text-white shadow-sm'
                : 'hover:text-[var(--cc-chrome-text)]',
            )}
            style={active
              ? { background: 'var(--cc-indigo-600)', color: '#fff' }
              : { color: 'var(--cc-chrome-muted)' }
            }
          >
            {ICONS[vp.id]}
            <span className="hidden sm:inline">{vp.label}</span>
            {vp.width !== null && (
              <span
                className="hidden md:inline text-[10px]"
                style={{ color: active ? 'rgba(255,255,255,0.65)' : 'var(--cc-chrome-muted)' }}
              >
                {vp.width}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
