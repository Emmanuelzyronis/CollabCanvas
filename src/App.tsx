import Canvas from './canvas/Canvas'
import TopBar from './ui/TopBar'
import Toolbar from './ui/Toolbar'
import StylePanel from './ui/StylePanel'
import AgentConsole from './ui/AgentConsole'

export default function App() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-50 text-slate-900">
      <Canvas />

      {/* floating chrome */}
      <div className="pointer-events-none absolute inset-0 flex flex-col p-3">
        <div className="flex items-start justify-between">
          <TopBar />
          <StylePanel />
        </div>

        <div className="mt-auto flex items-end justify-between gap-3">
          <div className="flex-1" />
          <Toolbar />
          <div className="flex flex-1 justify-end">
            <AgentConsole />
          </div>
        </div>
      </div>
    </div>
  )
}
