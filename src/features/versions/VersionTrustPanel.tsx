import { useEffect, useMemo, useState } from 'react'
import type { DesignVersion } from '../../../server/domain/version-types'
import { approveVersion, createDraftVersion, fetchVersions, WorkspaceApiError } from '../../workspace'
import { Badge, Button, Panel, Stack, Text } from '../../ui/foundation'

export default function VersionTrustPanel({ documentId, projectId, author = 'designer', reviewer = 'reviewer' }: { documentId: string; projectId: string; author?: string; reviewer?: string }) {
  const [versions, setVersions] = useState<DesignVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const refresh = async () => {
    setLoading(true); setError(undefined)
    try {
      const result = await fetchVersions(projectId, documentId)
      setVersions(result.filter((version) => version.projectId === projectId && version.documentId === documentId))
    } catch (caught) { setError(caught instanceof WorkspaceApiError ? caught.message : 'Version state is unavailable.') } finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [documentId, projectId])
  const draft = useMemo(() => versions.find((version) => version.status === 'draft'), [versions])
  const approved = useMemo(() => versions.filter((version) => version.status === 'approved').sort((a, b) => b.number - a.number)[0], [versions])
  const act = async (operation: () => Promise<DesignVersion>) => { setBusy(true); setError(undefined); try { const next = await operation(); setVersions((current) => [...current.filter((version) => version.id !== next.id), next].sort((a, b) => a.number - b.number)) } catch (caught) { setError(caught instanceof WorkspaceApiError ? caught.message : 'Version operation failed.') } finally { setBusy(false) } }
  return <Panel className="m-4 max-w-xl p-5" data-version-trust-state={loading ? 'loading' : error ? 'error' : 'ready'}>
    <Stack gap="3">
      <div><Text role="title">Version trust</Text><Text muted>Approved designs are immutable; changes flow through drafts.</Text></div>
      {loading ? <Text muted>Loading versions…</Text> : error ? <Text role="body" className="text-red-700" aria-live="assertive">{error}</Text> : <>
        <div className="flex flex-wrap gap-2" aria-label="Version lifecycle">{approved ? <Badge tone="success">Approved v{approved.number} · immutable</Badge> : <Badge> No approved version</Badge>}{draft ? <Badge tone="warning">Draft v{draft.number}</Badge> : <Badge tone="neutral">No draft</Badge>}</div>
        <div className="flex flex-wrap gap-2">
          {!draft ? <Button disabled={busy} loading={busy} onClick={() => void act(() => createDraftVersion(projectId, documentId, author))}>Create draft</Button> : <Button disabled={busy} loading={busy} onClick={() => void act(() => approveVersion(projectId, documentId, draft.id, reviewer))}>Approve draft</Button>}
          <Button variant="quiet" disabled={busy} onClick={() => void refresh()}>Refresh</Button>
        </div>
      </>}
    </Stack>
  </Panel>
}
