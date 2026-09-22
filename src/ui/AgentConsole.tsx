import { useEffect, useRef, useState } from 'react'
import { useCanvasStore } from '../store/store'
import { runCommand } from '../agent/runner'
import { isWebMcpAvailable } from '../mcp/registry'
import { isLlmConfigured } from '../agent/llm'
import AiSettings from './AiSettings'
import { Icon } from './icons'
import type { ActivityKind } from '../types'
import { useWorkspaceContext } from '../workspace'
import { buildIntelligenceContext } from '../features/intelligence'

interface ChatMsg {
  id: number
  role: 'user' | 'agent'
  text: string
  error?: boolean
}

const KIND_ICON: Record<ActivityKind, Parameters<typeof Icon>[0]['name']> = {
  create:   'rectangle',
  update:   'select',
  delete:   'trash',
  style:    'sparkles',
  group:    'group',
  arrange:  'grid',
  comment:  'comment',
  view:     'fit',
  generate: 'sparkles',
  export:   'download',
  presence: 'bot',
  select:   'select',
}

const SUGGESTIONS = [
  'Generate a kanban with To Do, Doing, Done',
  'Make a flowchart: Start, Validate?, Process, End',
  'Make everything indigo',
  'Tidy everything into a grid',
  'What is on the board?',
]

function timeAgo(at: number): string {
  const s = Math.round((Date.now() - at) / 1000)
  if (s < 5) return 'now'
  if (s < 60) return `${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  return `${Math.round(m / 60)}h`
}

function AriaAvatar() {
  return (
    <div
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
      style={{ background: 'linear-gradient(135deg, var(--cc-violet-500), var(--cc-violet-700))' }}
    >
      <svg viewBox="0 0 14 14" fill="none" className="h-3.5 w-3.5">
        <circle cx="7" cy="5" r="2.5" fill="white" opacity="0.9" />
        <path d="M2 13a5 5 0 0 1 10 0" stroke="white" strokeWidth="1.4" strokeLinecap="round" opacity="0.8" />
      </svg>
    </div>
  )
}

export default function AgentConsole() {
  const workspace = useWorkspaceContext()
  const runtimeSelection = useCanvasStore((s) => s.selection)
  const intelligence = buildIntelligenceContext({ availability: workspace.availability, identifiers: workspace, graph: workspace.graph, selectedNodeIds: runtimeSelection, error: workspace.error?.message })
  const [open, setOpen] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const aiOn = isLlmConfigured()
  const webMcp = isWebMcpAvailable()
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    { id: 0, role: 'agent', text: "Hi, I'm Aria. Tell me what to build — try a suggestion below, or type your own." },
  ])
  const activity = useCanvasStore((s) => s.activity)
  const agentName = useCanvasStore((s) => s.agent.name)
  const nextId = useRef(1)
  const feedRef = useRef<HTMLDivElement>(null)
  const chatRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' })
  }, [msgs])

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight })
  }, [activity])

  async function send(raw?: string) {
    const text = (raw ?? input).trim()
    if (!text || busy) return
    setInput('')
    setMsgs((m) => [...m, { id: nextId.current++, role: 'user', text }])
    setBusy(true)
    try {
      const res = await runCommand(text, undefined, intelligence)
      const reply = res.reply || (res.ok ? 'Done.' : 'Something went wrong.')
      setMsgs((m) => [...m, { id: nextId.current++, role: 'agent', text: reply, error: !res.ok }])
    } catch (e) {
      setMsgs((m) => [...m, { id: nextId.current++, role: 'agent', text: `Error: ${(e as Error).message}`, error: true }])
    } finally {
      setBusy(false)
    }
  }

  /* Minimized state — violet orb */
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Open Aria"
        className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-xl transition-transform hover:scale-105 aria-active"
        style={{ background: 'linear-gradient(135deg, var(--cc-violet-500), var(--cc-violet-700))' }}
      >
        <svg viewBox="0 0 18 18" fill="none" className="h-5 w-5">
          <circle cx="9" cy="6.5" r="3.5" fill="white" opacity="0.9" />
          <path d="M2 17a7 7 0 0 1 14 0" stroke="white" strokeWidth="1.6" strokeLinecap="round" opacity="0.75" />
        </svg>
      </button>
    )
  }

  const statusColor = aiOn ? 'var(--cc-violet-500)' : webMcp ? 'var(--cc-emerald-500)' : 'var(--cc-amber-500)'
  const statusText  = aiOn ? 'Live AI · WebMCP' : webMcp ? 'WebMCP connected' : 'WebMCP polyfill'

  return (
    <div
      className="pointer-events-auto flex h-[min(580px,calc(100vh-5rem))] w-[340px] flex-col overflow-hidden rounded-2xl shadow-modal"
      style={{
        background: 'var(--cc-panel)',
        border: '1px solid var(--cc-border-default)',
      }}
    >
      {showSettings && <AiSettings onClose={() => setShowSettings(false)} />}

      {/* Header */}
      <div
        className="flex shrink-0 items-center gap-2.5 px-3 py-2.5"
        style={{ borderBottom: '1px solid var(--cc-border-subtle)' }}
      >
        <AriaAvatar />
        <div className="flex-1 min-w-0 leading-tight">
          <div className="text-sm font-semibold" style={{ color: 'var(--cc-text-primary)' }}>{agentName}</div>
          <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--cc-text-muted)' }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusColor }} />
            {statusText}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          title="AI model settings"
          className="relative flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--cc-surface)] focus-visible:outline-none"
          style={{ color: 'var(--cc-text-muted)' }}
        >
          <Icon name="settings" size={15} />
          {aiOn && (
            <span
              className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full"
              style={{ background: 'var(--cc-violet-500)' }}
            />
          )}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          title="Minimize"
          className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--cc-surface)] focus-visible:outline-none"
          style={{ color: 'var(--cc-text-muted)' }}
        >
          <Icon name="close" size={15} />
        </button>
      </div>

      {/* Chat messages */}
      <div ref={chatRef} className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        {msgs.map((m) => (
          <div key={m.id} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start items-end'}`}>
            {m.role === 'agent' && <AriaAvatar />}
            <div
              className="max-w-[82%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs leading-relaxed"
              style={m.role === 'user'
                ? { background: 'var(--cc-indigo-600)', color: '#fff' }
                : m.error
                  ? { background: '#fff1f2', color: 'var(--cc-red-500)', border: '1px solid #fecdd3' }
                  : { background: 'var(--cc-surface)', color: 'var(--cc-text-primary)', border: '1px solid var(--cc-border-subtle)' }
              }
            >
              {m.text}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex items-end gap-2">
            <AriaAvatar />
            <div
              className="flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs"
              style={{ background: 'var(--cc-surface)', color: 'var(--cc-text-muted)', border: '1px solid var(--cc-border-subtle)' }}
            >
              <span className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ background: 'var(--cc-violet-500)' }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:0.15s]" style={{ background: 'var(--cc-violet-500)' }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:0.3s]" style={{ background: 'var(--cc-violet-500)' }} />
            </div>
          </div>
        )}

        {msgs.length <= 1 && (
          <div className="space-y-1.5 pt-1">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="block w-full rounded-xl px-3 py-2 text-left text-[11px] transition-colors hover:text-[var(--cc-violet-700)] focus-visible:outline-none"
                style={{
                  background: 'var(--cc-violet-50)',
                  color: 'var(--cc-violet-600)',
                  border: '1px solid var(--cc-violet-100)',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <div
        className="shrink-0 px-2.5 py-2.5"
        style={{ borderTop: '1px solid var(--cc-border-subtle)' }}
      >
        <div
          className="flex items-end gap-1.5 rounded-xl px-2.5 py-1.5 transition-all focus-within:ring-2 focus-within:ring-[var(--cc-violet-500)]"
          style={{
            background: 'var(--cc-surface)',
            border: '1px solid var(--cc-border-default)',
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
            rows={1}
            placeholder="Ask Aria to build or change something…"
            className="max-h-24 flex-1 resize-none bg-transparent py-1 text-xs outline-none placeholder:text-[var(--cc-text-muted)]"
            style={{ color: 'var(--cc-text-primary)' }}
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy || !input.trim()}
            title="Send — Enter"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white transition-all hover:opacity-90 disabled:opacity-30 focus-visible:outline-none"
            style={{ background: 'var(--cc-violet-600)' }}
          >
            <Icon name="send" size={14} />
          </button>
        </div>
      </div>

      {/* Activity feed */}
      <div
        className="shrink-0"
        style={{ borderTop: '1px solid var(--cc-border-subtle)', background: 'var(--cc-surface)' }}
      >
        <div
          className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: 'var(--cc-text-muted)' }}
        >
          Activity
        </div>
        <div ref={feedRef} className="max-h-28 space-y-0.5 overflow-y-auto px-2 pb-2">
          {activity.length === 0 && (
            <p className="px-1 pb-1 text-[11px]" style={{ color: 'var(--cc-text-muted)' }}>No activity yet.</p>
          )}
          {activity.slice(-40).map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-[11px]">
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
                style={a.author === 'agent'
                  ? { background: 'var(--cc-violet-100)', color: 'var(--cc-violet-600)' }
                  : { background: 'var(--cc-indigo-100)', color: 'var(--cc-indigo-600)' }
                }
              >
                <Icon name={KIND_ICON[a.kind]} size={11} />
              </span>
              <span className="flex-1 truncate" style={{ color: 'var(--cc-text-secondary)' }}>{a.message}</span>
              <span className="shrink-0 text-[10px]" style={{ color: 'var(--cc-text-muted)' }}>{timeAgo(a.at)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
