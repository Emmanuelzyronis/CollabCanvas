import { useEffect, useState } from 'react'
import { Divider, IconButton, Panel, Stack, Text } from '../foundation'
import { Icon } from '../icons'
import type { LayersProjection } from '../../graph/graphProjection'
import LayerTree from '../layers/LayerTree'

/**
 * Product-facing navigation. Labels are designer words; `surface` stays the
 * stable URL key so existing links keep working.
 */
const NAV_SECTIONS = [
  { label: 'Overview', surface: 'overview' },
  { label: 'Canvas', surface: 'canvas' },
  { label: 'Design system', surface: 'design-system' },
  { label: 'Assets', surface: 'assets' },
  { label: 'Versions', surface: 'versions' },
  { label: 'Handoff', surface: 'handoff' },
  { label: 'Assistant', surface: 'assistant' },
] as const

/** Earlier links used an internal surface key; keep them resolving. */
const SURFACE_ALIASES: Readonly<Record<string, string>> = { 'agent-center': 'assistant' }

export default function LeftPanel({ onClose, layersProjection }: { onClose?: () => void; layersProjection?: LayersProjection }) {
  const sectionFromUrl = () => {
    const raw = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('surface') ?? ''
    const value = SURFACE_ALIASES[raw] ?? raw
    return NAV_SECTIONS.find((section) => section.surface === value)?.label ?? 'Canvas'
  }
  const [activeSection, setActiveSection] = useState(sectionFromUrl)
  useEffect(() => {
    const onPopState = () => setActiveSection(sectionFromUrl())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = (section: string) => {
    const target = NAV_SECTIONS.find((candidate) => candidate.label === section)
    if (!target) return
    const params = new URLSearchParams(window.location.search)
    params.set('surface', target.surface)
    window.history.pushState({}, '', `?${params.toString()}`)
    setActiveSection(target.label)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  return (
    <Panel elevation="none" className="flex h-full min-h-0 flex-col rounded-none border-0 bg-panel">
      <div className="flex min-h-12 items-center justify-between px-3">
        <Stack gap="1">
          <Text as="h2" role="label">Project</Text>
          <Text as="div" role="metadata" muted>Workspace navigation</Text>
        </Stack>
        {onClose ? <div className="cc-shell-compact-only"><IconButton id="project-navigation-close" label="Close project navigation" size="sm" onClick={onClose}><Icon name="close" size={16} /></IconButton></div> : null}
      </div>
      <Divider />
      <nav className="min-h-0 flex-1 overflow-y-auto p-3" aria-label="Project sections">
        <Stack gap="1">
          {NAV_SECTIONS.map(({ label: item }) => (
            <button key={item} type="button" onClick={() => navigate(item)} className={`min-h-9 w-full rounded-control px-3 text-left text-sm transition-colors focus-visible:outline-none ${activeSection === item ? 'bg-selected font-medium text-blue-800' : 'text-text-secondary hover:bg-hover hover:text-text-primary'}`} aria-current={activeSection === item ? 'page' : undefined}>
              {item}
            </button>
          ))}
        </Stack>
        <Divider className="my-4" />
        <Stack gap="2">
          <Text as="h3" role="label" muted>Layers</Text>
          {layersProjection ? <LayerTree projection={layersProjection} /> : (
            <div className="rounded-card border border-dashed border-border-strong px-3 py-4">
              <Text role="caption" muted>Layers appear here as you add elements to the canvas.</Text>
            </div>
          )}
        </Stack>
      </nav>
    </Panel>
  )
}
