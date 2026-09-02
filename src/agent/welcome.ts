import { useCanvasStore } from '../store/store'

/**
 * First-run experience. On an empty board with no prior visit, seed a small
 * sample scene and an agent-signed welcome comment so the value prop is obvious
 * the moment the page loads — the human sees the agent has already "done work".
 * Guarded by localStorage so we never clobber a returning user's board.
 */

const SEEN_KEY = 'collabcanvas:visited'

export function hasVisited(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export function markVisited(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    /* private mode — fine, we just reseed next time */
  }
}

/** Seed a welcoming sample board. Safe no-op if the board already has content. */
export function seedWelcomeBoard(): void {
  const store = useCanvasStore.getState()
  if (store.order.length > 0) return

  const title = store.addElement(
    { type: 'text', x: 80, y: 40, width: 460, height: 44, text: 'Welcome to CollabCanvas', fontSize: 30, fontWeight: 700, textColor: '#1e293b' },
    'agent',
  )
  const sub = store.addElement(
    {
      type: 'text',
      x: 80,
      y: 92,
      width: 520,
      height: 48,
      text: 'A human and their AI agent share this canvas. Ask Aria (bottom-right) to build something, or draw it yourself.',
      fontSize: 15,
      textColor: '#64748b',
    },
    'agent',
  )

  const a = store.addElement({ type: 'sticky', x: 90, y: 200, width: 170, height: 130, text: '1. Type a request →', fill: '#fde68a' }, 'agent')
  const b = store.addElement({ type: 'sticky', x: 300, y: 200, width: 170, height: 130, text: '2. Aria builds it with WebMCP tools', fill: '#c7d2fe' }, 'agent')
  const c = store.addElement({ type: 'sticky', x: 510, y: 200, width: 170, height: 130, text: '3. You stay in control — edit anything', fill: '#bbf7d0' }, 'agent')

  // Connectors are plain elements referencing from/to ids (no dedicated action).
  store.addElements(
    [
      { type: 'connector', from: a, to: b, x: 0, y: 0 },
      { type: 'connector', from: b, to: c, x: 0, y: 0 },
    ],
    'agent',
  )

  store.addComment({
    x: 720,
    y: 190,
    text: "Hi! I seeded this sample so you can see how we work together. Say \"clear the board\" when you're ready to start fresh.",
    author: 'agent',
    targetId: c,
  })

  // Fit the scene, then nudge the camera so the hero text isn't hidden behind
  // the Aria console (which overlays the right ~380px of the viewport). Shifting
  // the camera right in world space slides content leftward into clear space.
  store.zoomToFit(undefined, 'agent')
  const { camera } = useCanvasStore.getState()
  const CONSOLE_INSET = 380 // px of viewport the console covers on the right
  useCanvasStore.getState().setCamera({ x: camera.x + CONSOLE_INSET / (2 * camera.zoom) })
  store.setSelection([])
  void title
  void sub
}
