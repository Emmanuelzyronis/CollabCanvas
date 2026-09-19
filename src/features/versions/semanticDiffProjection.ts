import type { SemanticEntityType, SemanticFieldChange, VersionComparison } from '../../../server/domain/version-types'

export interface SemanticDiffGroup {
  readonly entityType: SemanticEntityType
  readonly entityId: string
  readonly kind: SemanticFieldChange['kind']
  readonly fields: readonly SemanticFieldChange[]
}

export interface SemanticDiffProjection {
  readonly state: 'equivalent' | 'changed'
  readonly fromVersionId: string
  readonly toVersionId: string
  readonly fromHash: string
  readonly toHash: string
  readonly counts: Readonly<Record<SemanticFieldChange['kind'], number>>
  readonly groups: readonly SemanticDiffGroup[]
}

export function projectSemanticDiff(comparison: VersionComparison): SemanticDiffProjection {
  const grouped = new Map<string, SemanticDiffGroup>()
  for (const field of comparison.fieldChanges) {
    const key = `${field.entityType}:${field.entityId}`
    const current = grouped.get(key)
    if (current) {
      grouped.set(key, { ...current, fields: [...current.fields, structuredClone(field)].sort((left, right) => left.path.localeCompare(right.path)) })
    } else {
      const entityChange = comparison.changes.find((change) => change.entityType === field.entityType && change.entityId === field.entityId)
      grouped.set(key, { entityType: field.entityType, entityId: field.entityId, kind: entityChange?.kind ?? field.kind, fields: [structuredClone(field)] })
    }
  }
  const groups = [...grouped.values()].sort((left, right) => left.entityType.localeCompare(right.entityType) || left.entityId.localeCompare(right.entityId))
  const counts = comparison.changes.reduce((result, change) => ({ ...result, [change.kind]: result[change.kind] + 1 }), { added: 0, removed: 0, updated: 0 })
  return {
    state: comparison.equivalent ? 'equivalent' : 'changed',
    fromVersionId: comparison.fromVersionId,
    toVersionId: comparison.toVersionId,
    fromHash: comparison.fromHash,
    toHash: comparison.toHash,
    counts,
    groups,
  }
}
