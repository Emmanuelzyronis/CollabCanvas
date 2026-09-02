import { useCanvasStore } from '../store/store'
import { Icon } from './icons'
import ConnectGuide from './ConnectGuide'

export default function TopBar() {
  const camera = useCanvasStore((s) => s.camera)
  const past = useCanvasStore((s) => s.past)
  const future = useCanvasStore((s) => s.future)
  const agent = useCanvasStore((s) => s.agent)
  const st = useCanvasStore.getState

  return (
    <div className="pointer-events-auto flex items-center gap-2">
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 shadow-lg backdrop-blur">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 text-white">
          <Icon name="sparkles" size={16} />
        </div>
        <span className="text-sm font-semibold tracking-tight text-slate-800">CollabCanvas</span>
      </div>

      <div className="flex items-center rounded-2xl border border-slate-200 bg-white/90 p-1 shadow-lg backdrop-blur">
        <button
          type="button"
          title="Undo — ⌘Z"
          disabled={past.length === 0}
          onClick={() => st().undo()}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Icon name="undo" size={17} />
        </button>
        <button
          type="button"
          title="Redo — ⌘⇧Z"
          disabled={future.length === 0}
          onClick={() => st().redo()}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Icon name="redo" size={17} />
        </button>
      </div>

      <div className="flex items-center rounded-2xl border border-slate-200 bg-white/90 p-1 shadow-lg backdrop-blur">
        <button type="button" title="Zoom out" onClick={() => st().zoomTo(camera.zoom / 1.2)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100">
          <Icon name="zoomOut" size={17} />
        </button>
        <button type="button" title="Reset zoom" onClick={() => st().zoomTo(1)} className="w-14 rounded-lg py-1 text-center text-xs font-medium text-slate-600 hover:bg-slate-100">
          {Math.round(camera.zoom * 100)}%
        </button>
        <button type="button" title="Zoom in" onClick={() => st().zoomTo(camera.zoom * 1.2)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100">
          <Icon name="zoomIn" size={17} />
        </button>
        <span className="mx-0.5 h-6 w-px bg-slate-200" />
        <button type="button" title="Zoom to fit" onClick={() => st().zoomToFit()} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100">
          <Icon name="fit" size={17} />
        </button>
      </div>

      <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white/90 px-2 py-1.5 shadow-lg backdrop-blur">
        <span className="relative flex h-6 w-6 items-center justify-center rounded-lg text-white" style={{ background: agent.color }}>
          <Icon name="bot" size={15} />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-white" style={{ background: agent.status ? '#22c55e' : '#cbd5e1' }} />
        </span>
        <div className="mr-1 leading-tight">
          <div className="text-xs font-semibold text-slate-800">{agent.name}</div>
          <div className="max-w-[140px] truncate text-[10px] text-slate-400">{agent.status ?? 'idle'}</div>
        </div>
        <span className="h-6 w-px bg-slate-200" />
        <ConnectGuide />
      </div>
    </div>
  )
}
