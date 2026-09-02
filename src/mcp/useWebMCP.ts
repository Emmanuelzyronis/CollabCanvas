import { useEffect, useState } from 'react'
import { isWebMcpAvailable, registerAll } from './registry'

export interface WebMcpState {
  available: boolean
  registered: boolean
  toolCount: number
}

/**
 * Registers the CollabCanvas tool suite with document.modelContext on mount
 * and tears it down on unmount. Safe to call when no WebMCP host is present —
 * the in-page Agent Console still works through our own registry.
 */
export function useWebMCP(): WebMcpState {
  const [state, setState] = useState<WebMcpState>({ available: false, registered: false, toolCount: 0 })

  useEffect(() => {
    let dispose: (() => void) | null = null
    let cancelled = false

    registerAll().then((unregister) => {
      if (cancelled) {
        unregister()
        return
      }
      dispose = unregister
      setState({ available: isWebMcpAvailable(), registered: isWebMcpAvailable(), toolCount: 0 })
    })

    return () => {
      cancelled = true
      dispose?.()
    }
  }, [])

  return state
}
