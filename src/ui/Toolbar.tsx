import clsx from 'clsx'
import { useCanvasStore } from '../store/store'
import { TOOLS } from '../constants'
import { Icon, type IconName } from './icons'
import type { Tool } from '../types'

const TOOL_ICON: Record<Tool, IconName> = {
  select: 'select',
  hand: 'hand',
  rectangle: 'rectangle',
  ellipse: 'ellipse',
  diamond: 'diamond',
  text: 'text',
  sticky: 'sticky',
  frame: 'frame',
  connector: 'connector',
  comment: 'comment',
}

export default function Toolbar() {
  const activeTool = useCanvasStore((s) => s.activeTool)
  const setActiveTool = useCanvasStore((s) => s.setActiveTool)

  return (
    <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-slate-200 bg-white/90 p-1.5 shadow-lg backdrop-blur">
      {TOOLS.map((t, i) => {
        const active = activeTool === t.id
        const divider = t.id === 'rectangle' || t.id === 'text' || t.id === 'connector'
        return (
          <div key={t.id} className="flex items-center">
            {divider && i !== 0 && <span className="mx-1 h-6 w-px bg-slate-200" />}
            <button
              type="button"
              title={`${t.label} — ${t.shortcut}`}
              onClick={() => setActiveTool(t.id)}
              className={clsx(
                'relative flex h-9 w-9 items-center justify-center rounded-xl transition',
                active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              <Icon name={TOOL_ICON[t.id]} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
