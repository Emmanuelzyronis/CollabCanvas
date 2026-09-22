import { useEffect } from 'react'
import clsx from 'clsx'
import { useCanvasStore } from '../../store/store'
import { useEditorToolStore } from './editorToolStore'
import { specFor, type EditorToolKind } from './editorModel'

const GROUPS: readonly EditorToolKind[][] = [
  ['select', 'hand'],
  ['text', 'heading', 'box', 'frame', 'section', 'button', 'card', 'image'],
]

const TOOL_ICONS: Partial<Record<EditorToolKind | 'fit', React.ReactNode>> = {
  select: (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-[17px] w-[17px]">
      <path d="M3 3l5 12 2.5-4.5L15 8z" />
    </svg>
  ),
  hand: (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-[17px] w-[17px]">
      <path d="M9 3.5V10M6.5 6.5V5M11.5 6.5V5M14 9v-2.5M6.5 10l-3 3.5a1 1 0 0 0 .8 1.5h8.4a1 1 0 0 0 .9-.6L14 9" />
    </svg>
  ),
  text: (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-[17px] w-[17px]">
      <path d="M4 5h10M9 5v9" />
    </svg>
  ),
  heading: (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[17px] w-[17px]">
      <path d="M3 5v8M9 5v8M3 9h6" />
      <path d="M13 8h2c0.6 0 1 0.4 1 1s-0.4 1-1 1h-2v3" strokeWidth="1.5" />
    </svg>
  ),
  box: (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-[17px] w-[17px]">
      <rect x="3" y="3" width="12" height="12" rx="1.5" />
    </svg>
  ),
  frame: (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-[17px] w-[17px]">
      <path d="M5 2v3M9 2v3M13 2v3M2 5h3M2 9h3M2 13h3M5 16v-3M9 16v-3M13 16v-3M16 5h-3M16 9h-3M16 13h-3" />
    </svg>
  ),
  section: (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-[17px] w-[17px]">
      <rect x="2" y="3" width="14" height="4" rx="1" />
      <rect x="2" y="11" width="14" height="4" rx="1" />
    </svg>
  ),
  button: (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-[17px] w-[17px]">
      <rect x="2" y="6" width="14" height="6" rx="3" />
      <line x1="6" y1="9" x2="12" y2="9" />
    </svg>
  ),
  card: (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-[17px] w-[17px]">
      <rect x="2" y="3" width="14" height="12" rx="2" />
      <line x1="5" y1="8" x2="13" y2="8" />
      <line x1="5" y1="11" x2="9" y2="11" />
      <rect x="2" y="3" width="14" height="3.5" rx="2" fill="currentColor" opacity="0.15" stroke="none" />
    </svg>
  ),
  image: (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-[17px] w-[17px]">
      <rect x="2" y="3" width="14" height="12" rx="2" />
      <circle cx="6.5" cy="7" r="1.5" />
      <path d="M2 13l4-4 3 3 2-2 5 4" />
    </svg>
  ),
  fit: (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-[17px] w-[17px]">
      <path d="M3 7V3h4M11 3h4v4M15 11v4h-4M7 15H3v-4" />
    </svg>
  ),
}

export default function EditorToolbar() {
  const tool = useEditorToolStore((state) => state.tool)
  const setTool = useEditorToolStore((state) => state.setTool)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      const shortcut: Record<string, EditorToolKind> = { v: 'select', h: 'hand', t: 'text' }
      const next = shortcut[event.key.toLowerCase()]
      if (next) {
        event.preventDefault()
        setTool(next)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setTool])

  return (
    <div
      className="absolute left-3 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-1 rounded-2xl p-1.5 shadow-floating backdrop-blur"
      style={{
        background: 'rgba(255,255,255,0.97)',
        border: '1px solid var(--cc-border-default)',
        boxShadow: 'var(--cc-shadow-floating)',
      }}
      role="toolbar"
      aria-label="Design tools"
      data-editor-toolbar="true"
    >
      {GROUPS.map((group, groupIndex) => (
        <div
          key={groupIndex}
          className={clsx(
            'flex flex-col items-center gap-0.5',
            groupIndex > 0 && 'mt-1 border-t pt-1.5',
          )}
          style={groupIndex > 0 ? { borderColor: 'var(--cc-border-subtle)' } : undefined}
        >
          {group.map((kind) => {
            const spec = specFor(kind)
            const active = tool === kind
            return (
              <button
                key={kind}
                type="button"
                data-tool={kind}
                aria-label={spec.label}
                aria-pressed={active}
                title={`${spec.label}${kind === 'select' ? ' (V)' : kind === 'hand' ? ' (H)' : kind === 'text' ? ' (T)' : ''}`}
                onClick={() => setTool(kind)}
                className={clsx(
                  'flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-[var(--cc-duration-fast)] focus-visible:outline-none focus-visible:ring-2',
                  active ? 'text-white shadow-sm tool-selected' : 'text-text-secondary hover:bg-[var(--cc-indigo-50)] hover:text-[var(--cc-indigo-600)]',
                )}
                style={active
                  ? { background: 'var(--cc-indigo-600)', boxShadow: '0 2px 8px rgba(79,70,229,0.3)' }
                  : undefined
                }
              >
                {TOOL_ICONS[kind] ?? <span aria-hidden="true" className="text-base">{spec.glyph}</span>}
              </button>
            )
          })}
        </div>
      ))}
      <div
        className="mt-1 flex flex-col items-center gap-0.5 border-t pt-1.5"
        style={{ borderColor: 'var(--cc-border-subtle)' }}
      >
        <button
          type="button"
          data-tool="fit"
          aria-label="Fit canvas to content"
          title="Fit canvas to content"
          onClick={() => useCanvasStore.getState().zoomToFit()}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-text-secondary transition-all duration-[var(--cc-duration-fast)] hover:bg-[var(--cc-indigo-50)] hover:text-[var(--cc-indigo-600)] focus-visible:outline-none focus-visible:ring-2"
        >
          {TOOL_ICONS.fit}
        </button>
      </div>
    </div>
  )
}
