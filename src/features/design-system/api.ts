import type { DesignGraph, DesignToken, TypographyDefinition } from '../../../server/domain/contracts'
import { resolveApiBase, WorkspaceApiError } from '../../application/commands'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${resolveApiBase()}${path}`, {
    headers: { 'content-type': 'application/json' },
    ...init,
  })
  const json = await res.json() as { data?: T; error?: { code: string; message: string } }
  if (!res.ok || json.error) throw new WorkspaceApiError(json.error?.code ?? 'ERROR', json.error?.message ?? 'Request failed', res.status)
  return json.data as T
}

export function upsertToken(documentId: string, token: DesignToken): Promise<DesignGraph> {
  return req(`/api/v1/documents/${documentId}/tokens`, {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

export function deleteToken(documentId: string, tokenId: string): Promise<DesignGraph> {
  return req(`/api/v1/documents/${documentId}/tokens/${tokenId}`, { method: 'DELETE' })
}

export function upsertTypography(documentId: string, def: TypographyDefinition): Promise<DesignGraph> {
  return req(`/api/v1/documents/${documentId}/typography`, {
    method: 'POST',
    body: JSON.stringify({ typography: def }),
  })
}

export function deleteTypography(documentId: string, typographyId: string): Promise<DesignGraph> {
  return req(`/api/v1/documents/${documentId}/typography/${typographyId}`, { method: 'DELETE' })
}

export function importDesignSystem(documentId: string, patch: { tokens?: DesignToken[]; typography?: TypographyDefinition[] }): Promise<DesignGraph> {
  return req(`/api/v1/documents/${documentId}/import`, {
    method: 'POST',
    body: JSON.stringify(patch),
  })
}
