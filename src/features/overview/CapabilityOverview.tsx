import { useEffect, useState } from 'react'
import { fetchAssistantStatus, fetchVersions, useWorkspaceContext, type AssistantStatus } from '../../workspace'
import { Badge, Button, Panel, Stack, Text } from '../../ui/foundation'

const CAPABILITIES = [
  { surface: 'canvas', title: 'Draw and arrange elements', detail: 'Create frames, text, images, buttons, and cards, then move and resize them.' },
  { surface: 'design-system', title: 'Style with your design system', detail: 'Apply shared colors, type, spacing, and radius so the design stays consistent.' },
  { surface: 'assets', title: 'Work with assets', detail: 'Keep the images and media used across the design in one place.' },
  { surface: 'versions', title: 'Save, compare, and restore versions', detail: 'Approve a version, compare two versions, and start new work from either.' },
  { surface: 'handoff', title: 'Hand the design to a coding agent', detail: 'Export a structured brief your coding agent can implement.' },
  { surface: 'assistant', title: 'Ask the design assistant', detail: 'Describe a change and review it before anything is applied.' },
] as const

function navigateSurface(surface: string): void {
  const params = new URLSearchParams(window.location.search)
  params.set('surface', surface)
  window.history.pushState({}, '', `?${params.toString()}`)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export default function CapabilityOverview() {
  const workspace = useWorkspaceContext()
  const [assistant, setAssistant] = useState<AssistantStatus>()
  const [versionCount, setVersionCount] = useState<number>()

  useEffect(() => { void fetchAssistantStatus().then(setAssistant).catch(() => undefined) }, [])
  useEffect(() => {
    if (!workspace.projectId || !workspace.documentId) return
    void fetchVersions(workspace.projectId, workspace.documentId).then((versions) => setVersionCount(versions.length)).catch(() => undefined)
  }, [workspace.projectId, workspace.documentId])

  const stats = [
    { label: 'Elements', value: workspace.graph?.nodes.length ?? 0 },
    { label: 'Components', value: workspace.graph?.componentDefinitions.length ?? 0 },
    { label: 'Design tokens', value: workspace.graph?.tokens.length ?? 0 },
    { label: 'Assets', value: workspace.graph?.assets.length ?? 0 },
    { label: 'Versions', value: versionCount ?? '—' },
  ]

  return <div className="h-full overflow-y-auto p-6">
    <section className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">{workspace.project?.name ?? 'Your project'}</h1>
          <p className="mt-1 text-sm text-text-secondary">{workspace.document?.name ?? 'Design workspace'}</p>
        </div>
        <Stack gap="2">
          <Badge tone={assistant?.provider === 'azure-openai' ? 'accent' : 'neutral'} data-assistant-provider={assistant?.provider ?? 'unknown'}>
            {assistant?.provider === 'azure-openai' ? 'Azure OpenAI assistant' : assistant ? 'Built-in assistant' : 'Assistant unavailable'}
          </Badge>
          <Badge tone="neutral">{workspace.version ? `Working on version ${workspace.version.number}` : 'No version yet'}</Badge>
        </Stack>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((stat) => <div key={stat.label} className="rounded-card border border-border-default bg-panel p-4"><p className="text-xs text-text-muted">{stat.label}</p><p className="mt-1 text-2xl font-semibold text-text-primary">{stat.value}</p></div>)}
      </div>

      <h2 className="mt-8 text-sm font-semibold text-text-primary">What you can do here</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {CAPABILITIES.map((capability) => <Panel key={capability.surface} elevation="subtle" className="flex flex-col gap-2 p-4">
          <Text role="label">{capability.title}</Text>
          <Text role="caption" muted>{capability.detail}</Text>
          <div className="mt-1"><Button variant="secondary" size="sm" data-overview-open={capability.surface} onClick={() => navigateSurface(capability.surface)}>Open</Button></div>
        </Panel>)}
      </div>

      <p className="mt-6 text-xs text-text-muted">Designs are saved as versions. The design assistant can suggest changes, but only you apply them.</p>
    </section>
  </div>
}
