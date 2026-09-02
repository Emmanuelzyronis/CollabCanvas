import { registerAll } from './registry'

/**
 * Module-level entry point called once from main.tsx.
 * Registers the full CollabCanvas tool suite with document.modelContext
 * (native WebMCP or @mcp-b/global polyfill). No-op when no host is present;
 * the in-page Agent Console still drives tools via the local registry.
 */
export function registerWebMCP(): void {
  registerAll().catch((e) => console.warn('[CollabCanvas] WebMCP registration failed:', e))
}
