import type { JsonObject, JsonValue } from './contracts.js'
import type { DesignManifest } from './manifest-types.js'

function sortKeys(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value === null || typeof value !== 'object') return value
  const output: JsonObject = {}
  for (const key of Object.keys(value).sort()) output[key] = sortKeys(value[key])
  return output
}

/** Stable JSON suitable for API responses, export, and future hashing. */
export function serializeDesignManifest(manifest: DesignManifest): string {
  return JSON.stringify(sortKeys(manifest as unknown as JsonValue))
}
