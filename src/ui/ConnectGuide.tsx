import { useState } from 'react'
import { createPortal } from 'react-dom'
import { getToolDefs, isWebMcpAvailable } from '../mcp/registry'
import { Icon } from './icons'

/**
 * "Connect an Agent" guide. Explains that the board exposes WebMCP tools on
 * document.modelContext, so any MCP-aware browser/agent (or the built-in Aria
 * console) can drive it. Lists the live tool catalog so judges can see the
 * surface area at a glance. Opened from a button in the TopBar.
 */

export default function ConnectGuide() {
  const [open, setOpen] = useState(false)
  const tools = open ? getToolDefs() : []
  const available = isWebMcpAvailable()

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Connect an agent"
        className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
      >
        <Icon name="connector" size={16} />
        Connect
      </button>

      {open && createPortal(
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="flex max-h-[80vh] w-[560px] max-w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 text-white">
                <Icon name="bot" size={18} />
              </span>
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-800">Connect an agent</div>
                <div className="text-[11px] text-slate-400">This board speaks WebMCP.</div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto px-5 py-4 text-sm text-slate-600">
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs">
                <span className={`h-2 w-2 rounded-full ${available ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                {available
                  ? 'WebMCP is live — tools are registered on document.modelContext.'
                  : 'Running with the @mcp-b/global polyfill (no native host detected).'}
              </div>

              <div>
                <div className="mb-1 font-semibold text-slate-700">1. Use the built-in agent</div>
                <p className="text-[13px] leading-relaxed">
                  The <span className="font-medium text-violet-600">Aria</span> console (bottom-right) turns plain English into tool
                  calls. Try “generate a kanban with To Do, Doing, Done” or “make everything blue”. No setup required.
                </p>
              </div>

              <div>
                <div className="mb-1 font-semibold text-slate-700">2. Connect an external agent</div>
                <p className="text-[13px] leading-relaxed">
                  Open this page in a WebMCP-capable browser or agent (e.g. ChatGPT’s in-app browser, or Chrome with the WebMCP
                  flag). The agent discovers our tools automatically via <code className="rounded bg-slate-100 px-1 py-0.5 text-[12px]">document.modelContext.getTools()</code> and can call them directly.
                </p>
              </div>

              <div>
                <div className="mb-1 font-semibold text-slate-700">3. Drive it from the console</div>
                <p className="mb-1.5 text-[13px] leading-relaxed">Paste this into DevTools to call a tool by hand:</p>
                <pre className="overflow-x-auto rounded-lg bg-slate-900 px-3 py-2 text-[11px] leading-relaxed text-slate-100">{`await window.CollabCanvas.callTool('generate_layout', {
  kind: 'flowchart', items: ['Start', 'Validate?', 'Ship'] })`}</pre>
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2 font-semibold text-slate-700">
                  Tool catalog
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-600">{tools.length}</span>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {tools.map((t) => (
                    <div key={t.name} className="truncate rounded-md bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-600" title={t.description}>
                      {t.name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
