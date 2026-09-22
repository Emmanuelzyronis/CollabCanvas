import { useEffect, useRef, useState } from 'react'

/* --- colour math --- */
function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, Math.round(l * 100)]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6
    : max === g ? ((b - r) / d + 2) / 6
    : ((r - g) / d + 4) / 6
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s / 100, b = l / 100
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = b - a * Math.min(b, 1 - b) * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

function isValidHex(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex)
}

const SWATCHES = [
  '#ef4444','#f97316','#f59e0b','#84cc16','#22c55e',
  '#10b981','#06b6d4','#3b82f6','#6366f1','#8b5cf6',
  '#ec4899','#64748b','#000000','#ffffff',
]

interface ColorPickerProps {
  value: string
  onChange: (hex: string) => void
  label?: string
}

export function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  const safe = isValidHex(value) ? value : '#4f46e5'
  const [hsl, setHsl] = useState<[number, number, number]>(() => hexToHsl(safe))
  const [hexInput, setHexInput] = useState(safe)
  const [open, setOpen] = useState(false)
  const popRef = useRef<HTMLDivElement>(null)
  const satRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef(false)

  useEffect(() => {
    if (isValidHex(value)) {
      const next = hexToHsl(value)
      setHsl(next)
      setHexInput(value)
    }
  }, [value])

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (open && popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const [h, s, l] = hsl

  const commit = (next: [number, number, number]) => {
    setHsl(next)
    const hex = hslToHex(...next)
    setHexInput(hex)
    onChange(hex)
  }

  const onSatMove = (e: React.MouseEvent | MouseEvent) => {
    if (!satRef.current) return
    const rect = satRef.current.getBoundingClientRect()
    const sx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const sy = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    const ns = Math.round(sx * 100)
    const nl = Math.round((1 - sy) * 50 + (1 - sx) * 50 * sy)
    commit([h, ns, nl])
  }

  const onSatMouseDown = (e: React.MouseEvent) => {
    dragRef.current = true
    onSatMove(e)
    const onMove = (ev: MouseEvent) => { if (dragRef.current) onSatMove(ev) }
    const onUp = () => { dragRef.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div className="relative" ref={popRef}>
      {/* Trigger */}
      <button
        type="button"
        aria-label={label ?? 'Pick colour'}
        title={hexInput}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-indigo-500)]"
        style={{ borderColor: 'var(--cc-border-default)', background: 'var(--cc-panel)' }}
      >
        <span
          className="h-5 w-5 rounded shadow-sm"
          style={{ background: safe, border: '1px solid rgba(0,0,0,0.12)' }}
        />
        <span style={{ color: 'var(--cc-text-primary)', fontFamily: 'monospace' }}>{hexInput.toUpperCase()}</span>
      </button>

      {/* Popover */}
      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 flex w-56 flex-col gap-3 rounded-xl p-3 shadow-modal"
          style={{
            background: 'var(--cc-panel)',
            border: '1px solid var(--cc-border-default)',
          }}
        >
          {/* Saturation / lightness field */}
          <div
            ref={satRef}
            className="relative h-32 w-full cursor-crosshair rounded-lg select-none"
            style={{ background: `hsl(${h},100%,50%)` }}
            onMouseDown={onSatMouseDown}
          >
            <div className="absolute inset-0 rounded-lg" style={{ background: 'linear-gradient(to right, white, transparent)' }} />
            <div className="absolute inset-0 rounded-lg" style={{ background: 'linear-gradient(to bottom, transparent, black)' }} />
            {/* cursor dot */}
            <div
              className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
              style={{
                left: `${s}%`,
                top: `${100 - ((l - (1 - s / 100) * 50) / 50) * 100}%`,
              }}
            />
          </div>

          {/* Hue slider */}
          <input
            type="range"
            min={0} max={360}
            value={h}
            onChange={(e) => commit([Number(e.target.value), s, l])}
            className="w-full cursor-pointer appearance-none rounded-full"
            style={{
              height: '10px',
              background: 'linear-gradient(to right, #f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)',
              outline: 'none',
            }}
          />

          {/* Hex input */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium" style={{ color: 'var(--cc-text-muted)' }}>Hex</span>
            <input
              type="text"
              value={hexInput}
              maxLength={7}
              spellCheck={false}
              onChange={(e) => {
                const raw = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`
                setHexInput(raw)
                if (isValidHex(raw)) { const next = hexToHsl(raw); setHsl(next); onChange(raw) }
              }}
              className="flex-1 rounded-lg border px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[var(--cc-indigo-500)]"
              style={{
                background: 'var(--cc-surface)',
                borderColor: 'var(--cc-border-default)',
                color: 'var(--cc-text-primary)',
              }}
            />
            <div
              className="h-7 w-7 rounded-lg shadow-sm"
              style={{ background: safe, border: '1px solid rgba(0,0,0,0.1)' }}
            />
          </div>

          {/* Swatches */}
          <div className="grid grid-cols-7 gap-1">
            {SWATCHES.map((sw) => (
              <button
                key={sw}
                type="button"
                title={sw}
                onClick={() => { const next = hexToHsl(sw); setHsl(next); setHexInput(sw); onChange(sw) }}
                className="h-6 w-6 rounded-md transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--cc-indigo-500)]"
                style={{ background: sw, border: sw === '#ffffff' ? '1px solid rgba(0,0,0,0.15)' : '1px solid transparent' }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
