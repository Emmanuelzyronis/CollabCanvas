import clsx from 'clsx'
import { useCanvasStore } from '../store/store'
import { FILL_SWATCHES, STROKE_SWATCHES } from '../constants'
import { Icon, type IconName } from './icons'
import type { CanvasElement, TextAlign } from '../types'

function Swatch({ color, active, onClick }: { color: string; active: boolean; onClick: () => void }) {
  const transparent = color === 'transparent'
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx('h-6 w-6 rounded-md border transition', active ? 'ring-2 ring-blue-500 ring-offset-1' : 'border-slate-200 hover:scale-110')}
      style={
        transparent
          ? { backgroundImage: 'linear-gradient(45deg,#e2e8f0 25%,transparent 25%,transparent 75%,#e2e8f0 75%),linear-gradient(45deg,#e2e8f0 25%,#fff 25%,#fff 75%,#e2e8f0 75%)', backgroundSize: '8px 8px', backgroundPosition: '0 0,4px 4px' }
          : { background: color }
      }
      title={color}
    />
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-100 px-3 py-2.5 last:border-0">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title}</div>
      {children}
    </div>
  )
}

function ActionBtn({ icon, label, onClick, disabled }: { icon: IconName; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      <Icon name={icon} size={17} />
    </button>
  )
}

export default function StylePanel() {
  const selection = useCanvasStore((s) => s.selection)
  const elements = useCanvasStore((s) => s.elements)
  const setStyle = useCanvasStore((s) => s.setStyle)
  const pushHistory = useCanvasStore((s) => s.pushHistory)
  const expandGroups = useCanvasStore((s) => s.expandGroups)

  if (selection.length === 0) return null
  const ids = expandGroups(selection)
  const selEls = ids.map((id) => elements[id]).filter(Boolean) as CanvasElement[]
  if (selEls.length === 0) return null
  const first = selEls[0]

  const st = useCanvasStore.getState()
  const apply = (patch: Partial<CanvasElement>) => setStyle(ids, patch)
  const applyLive = (patch: Partial<CanvasElement>) => setStyle(ids, patch, { record: false })

  const hasFill = selEls.some((e) => !['connector', 'line', 'text'].includes(e.type))
  const hasStroke = selEls.some((e) => !['sticky', 'text'].includes(e.type))
  const hasText = selEls.some((e) => ['text', 'sticky', 'rectangle', 'ellipse', 'diamond', 'frame'].includes(e.type))
  const multiple = selEls.length >= 2

  return (
    <div className="pointer-events-auto flex w-60 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-sm font-semibold text-slate-700">
          {selEls.length === 1 ? cap(first.type) : `${selEls.length} selected`}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{ background: first.author === 'agent' ? '#ede9fe' : '#dbeafe', color: first.author === 'agent' ? '#6d28d9' : '#1d4ed8' }}
        >
          {first.author === 'agent' ? st.agent.name : 'You'}
        </span>
      </div>

      {hasFill && (
        <Section title="Fill">
          <div className="flex flex-wrap gap-1.5">
            <Swatch color="transparent" active={first.fill === 'transparent'} onClick={() => apply({ fill: 'transparent' })} />
            {FILL_SWATCHES.map((c) => (
              <Swatch key={c} color={c} active={first.fill === c} onClick={() => apply({ fill: c })} />
            ))}
          </div>
        </Section>
      )}

      {hasStroke && (
        <Section title="Stroke">
          <div className="flex flex-wrap gap-1.5">
            {STROKE_SWATCHES.map((c) => (
              <Swatch key={c} color={c} active={first.stroke === c} onClick={() => apply({ stroke: c })} />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={12}
              step={1}
              defaultValue={first.strokeWidth}
              onPointerDown={() => pushHistory()}
              onChange={(e) => applyLive({ strokeWidth: Number(e.target.value) })}
              className="flex-1 accent-blue-600"
            />
            <button
              type="button"
              onClick={() => apply({ dashed: !first.dashed })}
              className={clsx('rounded-md border px-2 py-1 text-xs', first.dashed ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-500')}
            >
              Dashed
            </button>
          </div>
        </Section>
      )}

      {hasText && (
        <Section title="Text">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={8}
              max={200}
              value={Math.round(first.fontSize)}
              onChange={(e) => apply({ fontSize: Number(e.target.value) })}
              className="w-16 rounded-md border border-slate-200 px-2 py-1 text-sm outline-none focus:border-blue-400"
            />
            <button
              type="button"
              onClick={() => apply({ fontWeight: first.fontWeight >= 600 ? 400 : 700 })}
              className={clsx('h-8 w-8 rounded-md border text-sm font-bold', first.fontWeight >= 600 ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-600')}
            >
              B
            </button>
            <div className="ml-auto flex rounded-md border border-slate-200">
              {(['left', 'center', 'right'] as TextAlign[]).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => apply({ textAlign: a })}
                  className={clsx('flex h-8 w-8 items-center justify-center', first.textAlign === a ? 'bg-blue-50 text-blue-600' : 'text-slate-500')}
                >
                  <Icon name={a === 'left' ? 'alignLeft' : a === 'center' ? 'alignCenterX' : 'alignRight'} size={15} />
                </button>
              ))}
            </div>
          </div>
        </Section>
      )}

      <Section title="Opacity">
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          defaultValue={first.opacity}
          onPointerDown={() => pushHistory()}
          onChange={(e) => applyLive({ opacity: Number(e.target.value) })}
          className="w-full accent-blue-600"
        />
      </Section>

      {multiple && (
        <Section title="Align">
          <div className="flex gap-0.5">
            <ActionBtn icon="alignLeft" label="Align left" onClick={() => st.alignElements(ids, 'left')} />
            <ActionBtn icon="alignCenterX" label="Align center X" onClick={() => st.alignElements(ids, 'centerX')} />
            <ActionBtn icon="alignRight" label="Align right" onClick={() => st.alignElements(ids, 'right')} />
            <ActionBtn icon="alignTop" label="Align top" onClick={() => st.alignElements(ids, 'top')} />
            <ActionBtn icon="alignCenterY" label="Align center Y" onClick={() => st.alignElements(ids, 'centerY')} />
            <ActionBtn icon="alignBottom" label="Align bottom" onClick={() => st.alignElements(ids, 'bottom')} />
          </div>
          <div className="mt-1 flex gap-0.5">
            <ActionBtn icon="grid" label="Arrange in grid" onClick={() => st.arrangeGrid(ids, {})} />
            <ActionBtn icon="group" label="Group" onClick={() => st.groupElements(ids)} />
            <ActionBtn icon="ungroup" label="Ungroup" onClick={() => st.ungroupElements(ids)} />
          </div>
        </Section>
      )}

      <Section title="Arrange">
        <div className="flex gap-0.5">
          <ActionBtn icon="front" label="Bring to front" onClick={() => st.bringToFront(ids)} />
          <ActionBtn icon="back" label="Send to back" onClick={() => st.sendToBack(ids)} />
          <ActionBtn icon="duplicate" label="Duplicate" onClick={() => st.duplicateElements(ids)} />
          <ActionBtn icon={first.locked ? 'lock' : 'unlock'} label={first.locked ? 'Unlock' : 'Lock'} onClick={() => apply({ locked: !first.locked })} />
          <div className="ml-auto" />
          <ActionBtn icon="trash" label="Delete" onClick={() => st.deleteElements(ids)} />
        </div>
      </Section>
    </div>
  )
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
