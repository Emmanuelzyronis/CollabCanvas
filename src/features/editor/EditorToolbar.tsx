import { useEffect } from 'react'
import clsx from 'clsx'
import { useCanvasStore } from '../../store/store'
import { useEditorToolStore } from './editorToolStore'
import { specFor, type EditorToolKind } from './editorModel'

const GROUPS: readonly EditorToolKind[][] = [
  ['select', 'hand'],
  ['text', 'heading', 'box', 'frame', 'section', 'button', 'card', 'image'],
]

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
    <div className="absolute left-3 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-1 rounded-2xl border border-border-default bg-panel/95 p-1.5 shadow-floating backdrop-blur" role="toolbar" aria-label="Design tools" data-editor-toolbar="true">
      {GROUPS.map((group, groupIndex) => (
        <div key={groupIndex} className={groupIndex > 0 ? 'mt-1 flex flex-col items-center gap-1 border-t border-border-subtle pt-1.5' : 'flex flex-col items-center gap-1'}>
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
                title={spec.label}
                onClick={() => setTool(kind)}
                className={clsx(
                  'flex h-10 w-10 items-center justify-center rounded-xl text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                  active ? 'bg-blue-600 text-white shadow-sm' : 'text-text-secondary hover:bg-hover hover:text-text-primary',
                )}
              >
                <span aria-hidden="true">{spec.glyph}</span>
              </button>
            )
          })}
        </div>
      ))}
      <div className="mt-1 flex flex-col items-center gap-1 border-t border-border-subtle pt-1.5">
        <button
          type="button"
          data-tool="fit"
          aria-label="Fit canvas to content"
          title="Fit canvas"
          onClick={() => useCanvasStore.getState().zoomToFit()}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-base text-text-secondary transition-colors hover:bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <span aria-hidden="true">⤢</span>
        </button>
      </div>
    </div>
  )
}
