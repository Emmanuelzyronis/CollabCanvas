import { useState } from 'react'
import { createPortal } from 'react-dom'
import { getLlmConfig, setLlmConfig } from '../agent/llm'
import { Icon } from './icons'

/**
 * Bring-your-own-model settings for Aria. CollabCanvas ships with no backend, so
 * the real LLM is opt-in: the user pastes an OpenAI-compatible endpoint, model,
 * and key here. Everything is stored in localStorage on this device only and is
 * sent nowhere except the endpoint the user names. With no key, Aria falls back
 * to the built-in deterministic interpreter, so the board still works offline.
 *
 * Rendered through a portal to document.body — the app's canvas overlay uses
 * pointer-events/transform tricks that would otherwise clip a nested modal.
 */

export default function AiSettings({ onClose }: { onClose: () => void }) {
  const initial = getLlmConfig()
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl)
  const [model, setModel] = useState(initial.model)
  const [apiKey, setApiKey] = useState(initial.apiKey)
  const [saved, setSaved] = useState(false)

  function save() {
    setLlmConfig({ baseUrl: baseUrl.trim(), model: model.trim(), apiKey: apiKey.trim() })
    setSaved(true)
    window.setTimeout(onClose, 550)
  }

  function clearKey() {
    setApiKey('')
    setLlmConfig({ apiKey: '' })
    setSaved(false)
  }

  const active = apiKey.trim().length > 0

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 text-white">
            <Icon name="settings" size={17} />
          </span>
          <div className="flex-1 leading-tight">
            <div className="text-sm font-semibold text-slate-800">AI model settings</div>
            <div className="text-[11px] text-slate-400">Connect your own OpenAI-compatible model</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
            title="Close"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* body */}
        <div className="space-y-3 px-4 py-4">
          <div
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] ${
              active ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            {active
              ? 'Live model active — Aria will reason and call tools directly.'
              : 'No key set — Aria uses the built-in rule-based agent.'}
          </div>

          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-500">Endpoint (base URL)</span>
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
              spellCheck={false}
              autoComplete="off"
              className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-violet-400"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-500">Model</span>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="gpt-4o-mini"
              spellCheck={false}
              autoComplete="off"
              className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-violet-400"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-500">API key</span>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              type="password"
              placeholder="sk-…"
              spellCheck={false}
              autoComplete="off"
              className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-violet-400"
            />
          </label>

          <p className="text-[10.5px] leading-relaxed text-slate-400">
            Stored only in this browser (localStorage) and sent only to the endpoint above. Works with OpenAI,
            Groq, Together, DeepSeek, or any OpenAI-compatible API.
          </p>
        </div>

        {/* footer */}
        <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            onClick={clearKey}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100"
          >
            Clear key
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="flex items-center gap-1.5 rounded-lg bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-600"
          >
            <Icon name={saved ? 'check' : 'send'} size={14} />
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
