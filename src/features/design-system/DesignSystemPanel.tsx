import { useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import type { DesignGraph, DesignToken, TypographyDefinition } from '../../../server/domain/contracts'
import { ColorPicker } from '../../ui/ColorPicker'
import { deleteToken, deleteTypography, importDesignSystem, upsertToken, upsertTypography } from './api'

const TOKEN_CATEGORIES = ['color', 'spacing', 'radius', 'shadow', 'border'] as const
type Tab = 'colors' | 'typography' | 'spacing' | 'import'

interface Props {
  documentId: string
  graph: DesignGraph
  onGraphChange?: (graph: DesignGraph) => void
}

/* ---- helpers ---- */
function colorTokens(graph: DesignGraph) {
  return (graph.tokens ?? []).filter((t) => t.category === 'color')
}
function spacingTokens(graph: DesignGraph) {
  return (graph.tokens ?? []).filter((t) => t.category !== 'color')
}

/* ---- sub-components ---- */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--cc-text-muted)' }}>
      {children}
    </div>
  )
}

function ActionBtn({ onClick, children, danger }: { onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-indigo-500)]"
      style={danger
        ? { background: '#fff1f2', color: 'var(--cc-error)', border: '1px solid #fecdd3' }
        : { background: 'var(--cc-indigo-50)', color: 'var(--cc-indigo-700)', border: '1px solid var(--cc-indigo-100)' }
      }
    >
      {children}
    </button>
  )
}

/* ---- Colors tab ---- */
function ColorsTab({ documentId, graph, onGraphChange }: Props) {
  const [newName, setNewName] = useState('')
  const [newValue, setNewValue] = useState('#4f46e5')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const add = async () => {
    if (!newName.trim()) return
    setBusy(true)
    setError(undefined)
    try {
      const next = await upsertToken(documentId, {
        id: `token_${nanoid(8)}`,
        name: newName.trim(),
        category: 'color',
        value: newValue,
      })
      onGraphChange?.(next)
      setNewName('')
      setNewValue('#4f46e5')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The color token could not be saved.')
    } finally { setBusy(false) }
  }

  const remove = async (tokenId: string) => {
    setError(undefined)
    try {
      const next = await deleteToken(documentId, tokenId)
      onGraphChange?.(next)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The token could not be removed.')
    }
  }

  const update = async (token: DesignToken, color: string) => {
    try {
      const next = await upsertToken(documentId, { ...token, value: color })
      onGraphChange?.(next)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The color could not be updated.')
    }
  }

  const colors = colorTokens(graph)

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-lg border px-3 py-2 text-[11px]" style={{ background: '#fff1f2', borderColor: '#fecdd3', color: 'var(--cc-error)' }}>
          {error}
        </p>
      )}

      {colors.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed py-8 text-center" style={{ borderColor: 'var(--cc-border-default)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7" style={{ color: 'var(--cc-text-muted)' }}>
            <circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>
          </svg>
          <p className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>No color tokens yet — add one below.</p>
        </div>
      ) : (
        <div>
          <SectionLabel>Color tokens</SectionLabel>
          <div className="space-y-1.5">
            {colors.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: 'var(--cc-surface)' }}>
                <ColorPicker
                  value={typeof t.value === 'string' ? t.value : '#000000'}
                  onChange={(hex) => void update(t, hex)}
                  label={t.name}
                />
                <span className="flex-1 min-w-0 truncate text-xs font-medium" style={{ color: 'var(--cc-text-primary)' }}>{t.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${t.name}`}
                  onClick={() => void remove(t.id)}
                  className="text-xs transition-colors hover:text-red-500"
                  style={{ color: 'var(--cc-text-muted)' }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add new */}
      <div>
        <SectionLabel>Add color</SectionLabel>
        <div className="flex items-center gap-2">
          <ColorPicker value={newValue} onChange={setNewValue} label="New color" />
          <input
            type="text"
            placeholder="Token name (e.g. brand-primary)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void add() }}
            className="flex-1 min-w-0 rounded-lg border px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--cc-indigo-500)]"
            style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border-default)', color: 'var(--cc-text-primary)' }}
          />
          <ActionBtn onClick={() => void add()}>{busy ? '…' : 'Add'}</ActionBtn>
        </div>
      </div>
    </div>
  )
}

/* ---- Typography tab ---- */
const DEFAULT_TYPO: Omit<TypographyDefinition, 'id' | 'name'> = {
  fontFamily: 'Plus Jakarta Sans, ui-sans-serif, sans-serif',
  fontSize: 16,
  fontWeight: 400,
  lineHeight: 1.5,
  letterSpacing: 0,
  style: 'normal',
}

const GOOGLE_FONT_SUGGESTIONS = [
  'Plus Jakarta Sans', 'Inter', 'Geist', 'DM Sans', 'Outfit', 'Sora',
  'Manrope', 'Space Grotesk', 'Bricolage Grotesque', 'Playfair Display',
  'Lora', 'Fraunces', 'Cabinet Grotesk', 'Satoshi',
]

function TypographyTab({ documentId, graph, onGraphChange }: Props) {
  const [form, setForm] = useState<Omit<TypographyDefinition, 'id'>>({ name: '', ...DEFAULT_TYPO })
  const [busy, setBusy] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [error, setError] = useState<string>()

  const filtered = GOOGLE_FONT_SUGGESTIONS.filter((f) => f.toLowerCase().includes(form.fontFamily.toLowerCase()))

  const add = async () => {
    if (!form.name.trim()) return
    setBusy(true)
    setError(undefined)
    try {
      const next = await upsertTypography(documentId, { id: `typo_${nanoid(8)}`, ...form })
      onGraphChange?.(next)
      setForm({ name: '', ...DEFAULT_TYPO })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The type style could not be saved.')
    } finally { setBusy(false) }
  }

  const remove = async (id: string) => {
    setError(undefined)
    try {
      const next = await deleteTypography(documentId, id)
      onGraphChange?.(next)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The type style could not be removed.')
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <p role="alert" className="rounded-lg border px-3 py-2 text-[11px]" style={{ background: '#fff1f2', borderColor: '#fecdd3', color: 'var(--cc-error)' }}>
          {error}
        </p>
      )}
      {/* Existing */}
      {(graph.typography ?? []).length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed py-8 text-center" style={{ borderColor: 'var(--cc-border-default)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7" style={{ color: 'var(--cc-text-muted)' }}>
            <path d="M4 7V5h16v2M9 20h6M12 5v15"/>
          </svg>
          <p className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>No type styles yet — add one below.</p>
        </div>
      ) : (
        <div>
          <SectionLabel>Type styles</SectionLabel>
          <div className="space-y-2">
            {(graph.typography ?? []).map((t) => (
              <div
                key={t.id}
                className="flex items-start justify-between gap-3 rounded-lg px-3 py-2.5"
                style={{ background: 'var(--cc-surface)', border: '1px solid var(--cc-border-subtle)' }}
              >
                <div>
                  <div className="text-sm font-medium" style={{ fontFamily: t.fontFamily, fontWeight: Number(t.fontWeight), color: 'var(--cc-text-primary)' }}>
                    {t.name}
                  </div>
                  <div className="mt-0.5 text-[11px]" style={{ color: 'var(--cc-text-muted)' }}>
                    {t.fontFamily.split(',')[0]} · {t.fontSize}px / {t.fontWeight} · {t.lineHeight}lh
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${t.name}`}
                  onClick={() => void remove(t.id)}
                  className="text-xs transition-colors hover:text-red-500 shrink-0"
                  style={{ color: 'var(--cc-text-muted)' }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create */}
      <div>
        <SectionLabel>Add type style</SectionLabel>
        <div className="space-y-2">
          <input
            type="text" placeholder="Style name (e.g. Heading / Body large)"
            value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--cc-indigo-500)]"
            style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border-default)', color: 'var(--cc-text-primary)' }}
          />
          {/* Font family with suggestions */}
          <div className="relative">
            <input
              type="text" placeholder="Font family"
              value={form.fontFamily}
              onChange={(e) => { setForm((f) => ({ ...f, fontFamily: e.target.value })); setShowSuggestions(true) }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              className="w-full rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--cc-indigo-500)]"
              style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border-default)', color: 'var(--cc-text-primary)', fontFamily: form.fontFamily }}
            />
            {showSuggestions && filtered.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-40 mt-0.5 overflow-hidden rounded-lg shadow-floating" style={{ background: 'var(--cc-panel)', border: '1px solid var(--cc-border-default)' }}>
                {filtered.slice(0, 6).map((f) => (
                  <button
                    key={f} type="button"
                    onMouseDown={() => { setForm((fm) => ({ ...fm, fontFamily: f })); setShowSuggestions(false) }}
                    className="block w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-[var(--cc-hover)]"
                    style={{ color: 'var(--cc-text-primary)', fontFamily: f }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-[11px]" style={{ color: 'var(--cc-text-muted)' }}>
              Size
              <input type="number" min={8} max={200} value={form.fontSize as number}
                onChange={(e) => setForm((f) => ({ ...f, fontSize: Number(e.target.value) }))}
                className="mt-1 w-full rounded-lg border px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--cc-indigo-500)]"
                style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border-default)', color: 'var(--cc-text-primary)' }}
              />
            </label>
            <label className="text-[11px]" style={{ color: 'var(--cc-text-muted)' }}>
              Weight
              <select value={form.fontWeight as number}
                onChange={(e) => setForm((f) => ({ ...f, fontWeight: Number(e.target.value) }))}
                className="mt-1 w-full rounded-lg border px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--cc-indigo-500)]"
                style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border-default)', color: 'var(--cc-text-primary)' }}
              >
                {[300,400,500,600,700,800].map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </label>
            <label className="text-[11px]" style={{ color: 'var(--cc-text-muted)' }}>
              Line height
              <input type="number" min={0.8} max={3} step={0.05} value={form.lineHeight as number}
                onChange={(e) => setForm((f) => ({ ...f, lineHeight: Number(e.target.value) }))}
                className="mt-1 w-full rounded-lg border px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--cc-indigo-500)]"
                style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border-default)', color: 'var(--cc-text-primary)' }}
              />
            </label>
          </div>
          {/* Preview */}
          {form.name && (
            <div className="rounded-lg px-3 py-2" style={{ background: 'var(--cc-surface)', border: '1px solid var(--cc-border-subtle)' }}>
              <div
                style={{
                  fontFamily: form.fontFamily,
                  fontSize: `${form.fontSize}px`,
                  fontWeight: form.fontWeight as number,
                  lineHeight: form.lineHeight as number,
                  color: 'var(--cc-text-primary)',
                }}
              >
                {form.name}
              </div>
              <div className="mt-0.5 text-[10px]" style={{ color: 'var(--cc-text-muted)' }}>Preview</div>
            </div>
          )}
          <ActionBtn onClick={() => void add()}>{busy ? 'Adding…' : 'Add type style'}</ActionBtn>
        </div>
      </div>
    </div>
  )
}

/* ---- Spacing tab ---- */
function SpacingTab({ documentId, graph, onGraphChange }: Props) {
  const [newName, setNewName] = useState('')
  const [newValue, setNewValue] = useState('8')
  const [category, setCategory] = useState<'spacing' | 'radius' | 'shadow' | 'border'>('spacing')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const tokens = spacingTokens(graph)

  const add = async () => {
    if (!newName.trim()) return
    setBusy(true)
    setError(undefined)
    try {
      const next = await upsertToken(documentId, {
        id: `token_${nanoid(8)}`,
        name: newName.trim(),
        category,
        value: newValue,
      })
      onGraphChange?.(next)
      setNewName('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The token could not be saved.')
    } finally { setBusy(false) }
  }

  const remove = async (tokenId: string) => {
    setError(undefined)
    try {
      const next = await deleteToken(documentId, tokenId)
      onGraphChange?.(next)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The token could not be removed.')
    }
  }

  const categoryGroups = TOKEN_CATEGORIES.filter((c) => c !== 'color') as readonly string[]
  const hasTokens = tokens.length > 0

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-lg border px-3 py-2 text-[11px]" style={{ background: '#fff1f2', borderColor: '#fecdd3', color: 'var(--cc-error)' }}>
          {error}
        </p>
      )}

      {!hasTokens && (
        <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed py-8 text-center" style={{ borderColor: 'var(--cc-border-default)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7" style={{ color: 'var(--cc-text-muted)' }}>
            <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
          </svg>
          <p className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>No tokens yet — add spacing, radius, shadow or border tokens below.</p>
        </div>
      )}

      {categoryGroups.map((cat) => {
        const group = tokens.filter((t) => t.category === cat)
        if (group.length === 0) return null
        return (
          <div key={cat}>
            <SectionLabel>{cat}</SectionLabel>
            <div className="space-y-1">
              {group.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ background: 'var(--cc-surface)' }}>
                  <span className="text-xs font-medium" style={{ color: 'var(--cc-text-primary)' }}>{t.name}</span>
                  <span className="text-[11px]" style={{ color: 'var(--cc-text-muted)' }}>{String(t.value)}</span>
                  <div className="flex-1" />
                  <button type="button" onClick={() => void remove(t.id)} className="text-xs hover:text-red-500" style={{ color: 'var(--cc-text-muted)' }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      <div>
        <SectionLabel>Add token</SectionLabel>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder="Name (e.g. space-4)" value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--cc-indigo-500)]"
              style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border-default)', color: 'var(--cc-text-primary)' }}
            />
            <input type="text" placeholder="Value (e.g. 16px)" value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--cc-indigo-500)]"
              style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border-default)', color: 'var(--cc-text-primary)' }}
            />
          </div>
          <div className="flex items-center gap-2">
            <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)}
              className="rounded-lg border px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--cc-indigo-500)]"
              style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border-default)', color: 'var(--cc-text-primary)' }}
            >
              <option value="spacing">Spacing</option>
              <option value="radius">Radius</option>
              <option value="shadow">Shadow</option>
              <option value="border">Border</option>
            </select>
            <ActionBtn onClick={() => void add()}>{busy ? '…' : 'Add'}</ActionBtn>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---- Import tab ---- */
function ImportTab({ documentId, onGraphChange }: { documentId: string; onGraphChange?: (g: DesignGraph) => void }) {
  const [json, setJson] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [success, setSuccess] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const parseAndImport = async (raw: string) => {
    setError(undefined)
    setSuccess(false)
    let parsed: unknown
    try { parsed = JSON.parse(raw) }
    catch { setError('Invalid JSON — paste a valid design tokens JSON file.'); return }

    const data = parsed as Record<string, unknown>
    const tokens = Array.isArray(data.tokens) ? data.tokens : []
    const typography = Array.isArray(data.typography) ? data.typography : []
    if (tokens.length === 0 && typography.length === 0) {
      setError('No tokens or typography found. Expected { tokens: [...], typography: [...] }.')
      return
    }
    setBusy(true)
    try {
      const next = await importDesignSystem(documentId, { tokens, typography })
      onGraphChange?.(next)
      setSuccess(true)
      setJson('')
    } catch (e) {
      setError((e as Error).message)
    } finally { setBusy(false) }
  }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => { if (typeof reader.result === 'string') setJson(reader.result) }
    reader.readAsText(file)
  }

  return (
    <div className="space-y-4">
      <div>
        <SectionLabel>Import design tokens (JSON)</SectionLabel>
        <p className="mb-3 text-[11px] leading-relaxed" style={{ color: 'var(--cc-text-muted)' }}>
          Paste a JSON file or load from disk. Expected format:
          <code className="mx-1 rounded px-1 py-0.5 text-[10px]" style={{ background: 'var(--cc-surface)', color: 'var(--cc-text-secondary)' }}>
            {'{ "tokens": [...], "typography": [...] }'}
          </code>
        </p>
        {/* File picker */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed py-4 text-xs font-medium transition-colors hover:bg-[var(--cc-hover)] focus-visible:outline-none"
          style={{ borderColor: 'var(--cc-border-default)', color: 'var(--cc-text-secondary)' }}
        >
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M9 3v9M5 7l4-4 4 4"/>
            <rect x="2" y="12" width="14" height="4" rx="1" opacity="0.4"/>
          </svg>
          Load JSON file
        </button>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onFile} />

        <textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          rows={8}
          placeholder={'{\n  "tokens": [\n    { "id": "t1", "name": "brand-primary", "category": "color", "value": "#4f46e5" }\n  ],\n  "typography": []\n}'}
          className="w-full rounded-xl border p-3 font-mono text-[11px] leading-relaxed focus:outline-none focus:ring-1 focus:ring-[var(--cc-indigo-500)]"
          style={{
            background: 'var(--cc-surface)',
            borderColor: 'var(--cc-border-default)',
            color: 'var(--cc-text-primary)',
            resize: 'vertical',
          }}
        />

        {error && <p className="mt-2 text-[11px]" style={{ color: 'var(--cc-error)' }}>{error}</p>}
        {success && <p className="mt-2 text-[11px]" style={{ color: 'var(--cc-success)' }}>Imported successfully.</p>}

        <div className="mt-3 flex gap-2">
          <ActionBtn onClick={() => void parseAndImport(json)}>{busy ? 'Importing…' : 'Import'}</ActionBtn>
        </div>
      </div>

      {/* Example schemas */}
      <div>
        <SectionLabel>Quick-start palettes</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Indigo / Violet (default)', tokens: [
              { id: 'c_primary', name: 'primary', category: 'color', value: '#4f46e5' },
              { id: 'c_accent',  name: 'accent',  category: 'color', value: '#7c3aed' },
              { id: 'c_success', name: 'success', category: 'color', value: '#10b981' },
              { id: 'c_error',   name: 'error',   category: 'color', value: '#ef4444' },
              { id: 'c_canvas',  name: 'canvas',  category: 'color', value: '#ebebf0' },
            ]},
            { label: 'Ocean (blue / teal)', tokens: [
              { id: 'c_primary', name: 'primary', category: 'color', value: '#0284c7' },
              { id: 'c_accent',  name: 'accent',  category: 'color', value: '#0d9488' },
              { id: 'c_success', name: 'success', category: 'color', value: '#22c55e' },
              { id: 'c_error',   name: 'error',   category: 'color', value: '#dc2626' },
              { id: 'c_canvas',  name: 'canvas',  category: 'color', value: '#f0f9ff' },
            ]},
            { label: 'Warm (rose / amber)', tokens: [
              { id: 'c_primary', name: 'primary', category: 'color', value: '#e11d48' },
              { id: 'c_accent',  name: 'accent',  category: 'color', value: '#d97706' },
              { id: 'c_success', name: 'success', category: 'color', value: '#65a30d' },
              { id: 'c_error',   name: 'error',   category: 'color', value: '#9f1239' },
              { id: 'c_canvas',  name: 'canvas',  category: 'color', value: '#fff7ed' },
            ]},
            { label: 'Monochrome', tokens: [
              { id: 'c_primary', name: 'primary', category: 'color', value: '#111111' },
              { id: 'c_accent',  name: 'accent',  category: 'color', value: '#555555' },
              { id: 'c_success', name: 'success', category: 'color', value: '#16a34a' },
              { id: 'c_error',   name: 'error',   category: 'color', value: '#dc2626' },
              { id: 'c_canvas',  name: 'canvas',  category: 'color', value: '#f5f5f5' },
            ]},
          ].map(({ label, tokens }) => (
            <button
              key={label}
              type="button"
              onClick={() => void importDesignSystem(documentId, { tokens: tokens as DesignToken[] }).then((next) => { onGraphChange?.(next); setSuccess(true) })}
              className="rounded-xl px-3 py-2.5 text-left text-[11px] font-medium transition-colors hover:bg-[var(--cc-hover)] focus-visible:outline-none"
              style={{ background: 'var(--cc-surface)', border: '1px solid var(--cc-border-subtle)', color: 'var(--cc-text-primary)' }}
            >
              <div className="mb-2 flex gap-1">
                {(tokens as DesignToken[]).slice(0, 5).map((t) => (
                  <span key={t.id} className="h-4 w-4 rounded" style={{ background: String(t.value), border: '1px solid rgba(0,0,0,0.1)' }} />
                ))}
              </div>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---- Main panel ---- */
export default function DesignSystemPanel({ documentId, graph, onGraphChange }: Props) {
  const [tab, setTab] = useState<Tab>('colors')

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'colors',     label: 'Colors',      count: colorTokens(graph).length },
    { id: 'typography', label: 'Type',        count: (graph.typography ?? []).length },
    { id: 'spacing',    label: 'Tokens',      count: spacingTokens(graph).length },
    { id: 'import',     label: 'Import' },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex shrink-0 gap-0.5 border-b p-2" style={{ borderColor: 'var(--cc-border-subtle)' }}>
        {tabs.map(({ id, label, count }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--cc-indigo-500)]"
            style={tab === id
              ? { background: 'var(--cc-indigo-50)', color: 'var(--cc-indigo-700)', border: '1px solid var(--cc-indigo-100)' }
              : { background: 'transparent', color: 'var(--cc-text-secondary)', border: '1px solid transparent' }
            }
          >
            {label}
            {count != null && count > 0 && (
              <span
                className="rounded-full px-1.5 text-[10px] font-semibold"
                style={tab === id
                  ? { background: 'var(--cc-indigo-600)', color: 'white' }
                  : { background: 'var(--cc-surface)', color: 'var(--cc-text-muted)' }
                }
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'colors'     && <ColorsTab     documentId={documentId} graph={graph} onGraphChange={onGraphChange} />}
        {tab === 'typography' && <TypographyTab documentId={documentId} graph={graph} onGraphChange={onGraphChange} />}
        {tab === 'spacing'    && <SpacingTab    documentId={documentId} graph={graph} onGraphChange={onGraphChange} />}
        {tab === 'import'     && <ImportTab     documentId={documentId}               onGraphChange={onGraphChange} />}
      </div>
    </div>
  )
}
