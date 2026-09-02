import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@mcp-b/global'
import './index.css'
import App from './App.tsx'
import { registerWebMCP } from './mcp/register'
import { callTool, getToolDefs, isWebMcpAvailable } from './mcp/registry'
import { hasVisited, markVisited, seedWelcomeBoard } from './agent/welcome'

declare global {
  interface Window {
    /** Stable console handle for driving the board by hand (works in dev + prod). */
    CollabCanvas?: {
      callTool: typeof callTool
      getToolDefs: typeof getToolDefs
      isWebMcpAvailable: typeof isWebMcpAvailable
    }
  }
}

registerWebMCP()

// Expose a stable handle so anyone can drive the board from DevTools on the live
// site — the production bundle has no /src/* paths to import at runtime:
//   window.CollabCanvas.callTool('generate_layout', { kind: 'kanban', items: [...] })
window.CollabCanvas = { callTool, getToolDefs, isWebMcpAvailable }

if (!hasVisited()) {
  seedWelcomeBoard()
  markVisited()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
