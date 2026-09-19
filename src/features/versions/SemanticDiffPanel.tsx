import type { SemanticDiffProjection } from './semanticDiffProjection'
import { Badge, Panel, Stack, Text } from '../../ui/foundation'

export interface SemanticDiffPanelProps {
  projection?: SemanticDiffProjection
  loading?: boolean
  error?: string
}

function formatValue(value: unknown): string {
  if (value === undefined) return 'Not present'
  if (value === null) return 'None'
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function tone(kind: 'added' | 'removed' | 'updated'): 'success' | 'error' | 'warning' {
  return kind === 'added' ? 'success' : kind === 'removed' ? 'error' : 'warning'
}

export default function SemanticDiffPanel({ projection, loading = false, error }: SemanticDiffPanelProps) {
  if (loading) return <Panel className="m-4 p-5" data-semantic-diff-state="loading"><Text role="heading">Comparing versions</Text><Text muted>Computing semantic graph changes.</Text></Panel>
  if (error) return <Panel className="m-4 border-error p-5" role="alert" data-semantic-diff-state="error"><Text role="heading">Version comparison unavailable</Text><Text muted>{error}</Text></Panel>
  if (!projection) return <Panel className="m-4 border-dashed p-5" data-semantic-diff-state="empty"><Text role="heading">Select two versions</Text><Text muted>Choose a base and target version to inspect semantic changes.</Text></Panel>

  return (
    <section className="h-full overflow-y-auto p-4 sm:p-6" aria-labelledby="semantic-diff-title" data-semantic-diff-state={projection.state}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-border-default pb-4">
          <div>
            <h1 id="semantic-diff-title" className="text-xl font-semibold text-text-primary">Semantic diff</h1>
            <p className="mt-1 text-sm text-text-secondary"><span className="font-mono">{projection.fromVersionId}</span> to <span className="font-mono">{projection.toVersionId}</span></p>
          </div>
          <div className="flex gap-2" aria-label="Change summary">
            <Badge tone="success">{projection.counts.added} added</Badge>
            <Badge tone="warning">{projection.counts.updated} updated</Badge>
            <Badge tone="error">{projection.counts.removed} removed</Badge>
          </div>
        </div>

        {projection.state === 'equivalent' ? (
          <Panel className="border-dashed p-6" data-semantic-diff-empty="true"><Text role="heading">No semantic changes</Text><Text muted>These two versions are the same.</Text></Panel>
        ) : (
          <Stack gap="3" aria-label="Semantic changes">
            {projection.groups.map((group) => (
              <Panel key={`${group.entityType}:${group.entityId}`} elevation="none" className="overflow-hidden" data-change-kind={group.kind}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle bg-surface px-4 py-3">
                  <div className="min-w-0"><Text role="label" className="capitalize">{group.entityType}</Text><Text role="code" muted className="break-all">{group.entityId}</Text></div>
                  <Badge tone={tone(group.kind)}>{group.kind}</Badge>
                </div>
                <div className="divide-y divide-border-subtle">
                  {group.fields.map((field) => (
                    <div key={field.path} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(8rem,0.7fr)_minmax(0,1fr)_minmax(0,1fr)]" data-field-path={field.path}>
                      <Text role="code" className="break-all">{field.path}</Text>
                      <div className="min-w-0"><Text role="metadata" muted>Before</Text><Text role="code" className="break-words text-red-700">{formatValue(field.before)}</Text></div>
                      <div className="min-w-0"><Text role="metadata" muted>After</Text><Text role="code" className="break-words text-emerald-700">{formatValue(field.after)}</Text></div>
                    </div>
                  ))}
                </div>
              </Panel>
            ))}
          </Stack>
        )}
        <div className="mt-5 grid gap-2 border-t border-border-subtle pt-4 text-[11px] text-text-muted sm:grid-cols-2">
          <p className="break-all">Base hash: <span className="font-mono">{projection.fromHash}</span></p>
          <p className="break-all sm:text-right">Target hash: <span className="font-mono">{projection.toHash}</span></p>
        </div>
      </div>
    </section>
  )
}
