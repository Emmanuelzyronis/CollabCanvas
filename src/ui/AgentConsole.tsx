import { useEffect, useRef, useState } from 'react'
import { useCanvasStore } from '../store/store'
import { runCommand } from '../agent/runner'
import { isWebMcpAvailable } from '../mcp/registry'
import { isLlmConfigured } from '../agent/llm'
import AiSettings from './AiSettings'
import { Icon } from './icons'
import type { ActivityKind } from '../types'

/**
 * The in-page Agent Console. A chat-style panel where the human types natural
 * language; each message is interpreted into WebMCP tool calls (see agent/runner)
 * and executed against the same store the UI mutates. Below the composer is a
 * live activity feed — every human OR agent action shows up here, so the two
 * peers can see what the other just did.
 */

interface ChatMsg {
  id: number
  role: 'user' | 'agent'
  text: string
  error?: boolean
}

const KIND_ICON: Record<ActivityKind, Parameters<typeof Icon>[0]['name']> = {
  create: 'rectangle',
  update: 'select',
  delete: 'trash',
  style: 'sparkles',
  group: 'group',
  arrange: 'grid',
  comment: 'comment',
  view: 'fit',
  generate: 'sparkles',
  export: 'download',
  presence: 'bot',
  select: 'select',
}

const SUGGESTIONS = [
  'Generate a kanban with To Do, Doing, Done',
  'Make a flowchart: Start, Validate?, Process, End',
  'Make everything blue',
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

export default function AgentConsole() {
  const [open, setOpen] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const aiOn = isLlmConfigured()
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
      const res = await runCommand(text)
      const reply = res.reply || (res.ok ? 'Done.' : 'Something went wrong.')
      setMsgs((m) => [...m, { id: nextId.current++, role: 'agent', text: reply, error: !res.ok }])
    } catch (e) {
      setMsgs((m) => [...m, { id: nextId.current++, role: 'agent', text: `Error: ${(e as Error).message}`, error: true }])
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 text-white shadow-xl transition hover:scale-105"
        title="Open Agent Console"
      >
        <Icon name="bot" size={22} />
      </button>
    )
  }

  return (
    <div className="pointer-events-auto flex h-[min(560px,calc(100vh-6rem))] w-[340px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-2xl backdrop-blur">
      {showSettings && <AiSettings onClose={() => setShowSettings(false)} />}
      {/* header */}
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 text-white">
          <Icon name="bot" size={16} />
        </span>
        <div className="flex-1 leading-tight">
          <div className="text-sm font-semibold text-slate-800">{agentName}</div>
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <span className={`h-1.5 w-1.5 rounded-full ${aiOn ? 'bg-violet-500' : isWebMcpAvailable() ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            {aiOn ? 'Live AI · WebMCP' : isWebMcpAvailable() ? 'WebMCP connected' : 'WebMCP polyfill'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="relative flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
          title="AI model settings"
        >
          <Icon name="settings" size={16} />
          {aiOn && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-violet-500" />}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100" title="Minimize">
          <Icon name="close" size={16} />
        </button>
      </div>

      {/* chat */}
      <div ref={chatRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {msgs.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                m.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : m.error
                    ? 'bg-rose-50 text-rose-700'
                    : 'bg-slate-100 text-slate-700'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-slate-100 px-3 py-2 text-xs text-slate-400">Working…</div>
          </div>
        )}
        {msgs.length <= 1 && (
          <div className="space-y-1.5 pt-1">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="block w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-left text-[11px] text-slate-600 transition hover:border-violet-300 hover:bg-violet-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* composer */}
      <div className="border-t border-slate-100 px-2.5 py-2">
        <div className="flex items-end gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-1 focus-within:border-violet-400">
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
            className="max-h-24 flex-1 resize-none bg-transparent py-1 text-xs text-slate-700 outline-none placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy || !input.trim()}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500 text-white transition hover:bg-violet-600 disabled:opacity-30"
            title="Send — Enter"
          >
            <Icon name="send" size={15} />
          </button>
        </div>
      </div>

      {/* activity feed */}
      <div className="border-t border-slate-100 bg-slate-50/60">
        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Activity</div>
        <div ref={feedRef} className="max-h-32 space-y-0.5 overflow-y-auto px-2 pb-2">
          {activity.length === 0 && <div className="px-1 pb-1 text-[11px] text-slate-400">No activity yet.</div>}
          {activity.slice(-40).map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-[11px]">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${a.author === 'agent' ? 'bg-violet-100 text-violet-600' : 'bg-blue-100 text-blue-600'}`}
              >
                <Icon name={KIND_ICON[a.kind]} size={12} />
              </span>
              <span className="flex-1 truncate text-slate-600">{a.message}</span>
              <span className="shrink-0 text-[10px] text-slate-300">{timeAgo(a.at)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
