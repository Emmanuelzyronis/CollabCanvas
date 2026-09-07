import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import AppShell from '../src/ui/shell/AppShell'
import LeftPanel from '../src/ui/shell/LeftPanel'
import RightInspector from '../src/ui/shell/RightInspector'
import StatusBar from '../src/ui/shell/StatusBar'
import TopBar from '../src/ui/shell/TopBar'

describe('Layer 02 application shell', () => {
  it('renders the structural regions and semantic landmarks', () => {
    const html = renderToStaticMarkup(createElement(AppShell, { children: createElement('div', null, 'canvas') }))
    expect(html).toContain('Application top bar')
    expect(html).toContain('Project navigation')
    expect(html).toContain('Canvas workspace')
    expect(html).toContain('Inspector')
    expect(html).toContain('Canvas status bar')
  })

  it('keeps shell pieces independently renderable', () => {
    expect(renderToStaticMarkup(createElement(TopBar, { onToggleLeft: () => undefined, onToggleRight: () => undefined, leftOpen: false, rightOpen: false }))).toContain('Application top bar')
    expect(renderToStaticMarkup(createElement(LeftPanel))).toContain('Project sections')
    expect(renderToStaticMarkup(createElement(RightInspector))).toContain('Inspector')
    expect(renderToStaticMarkup(createElement(StatusBar))).toContain('Canvas status bar')
  })

  it('uses accessible names for panel controls', () => {
    const html = renderToStaticMarkup(createElement(TopBar, { onToggleLeft: () => undefined, onToggleRight: () => undefined, leftOpen: false, rightOpen: false }))
    expect(html).toContain('Open project navigation')
    expect(html).toContain('Open inspector')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-controls="project-navigation-panel"')
    expect(html).toContain('aria-controls="inspector-panel"')
  })

  it('marks compact panels closed until shell controls open them', () => {
    const html = renderToStaticMarkup(createElement(AppShell, { children: createElement('div', null, 'canvas') }))
    expect(html).toContain('id="project-navigation-panel"')
    expect(html).toContain('id="inspector-panel"')
    expect(html.match(/data-open="false"/g)).toHaveLength(2)
  })

  it('does not depend on retired legacy presentation', async () => {
    const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
    const shellTopBar = await readFile(new URL('../src/ui/shell/TopBar.tsx', import.meta.url), 'utf8')
    const inspector = await readFile(new URL('../src/ui/shell/RightInspector.tsx', import.meta.url), 'utf8')

    expect(app).not.toMatch(/Toolbar|AgentConsole/)
    expect(shellTopBar).not.toMatch(/LegacyTopBar|\.\.\/TopBar/)
    expect(inspector).not.toMatch(/StylePanel/)
  })

  it('keeps closed compact panels non-interactive in the shell CSS contract', async () => {
    const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')
    expect(css).toMatch(/\.cc-shell-panel\s*\{[^}]*visibility:\s*hidden;[^}]*pointer-events:\s*none;/s)
    expect(css).toMatch(/\.cc-shell-panel\[data-open="true"\]\s*\{[^}]*visibility:\s*visible;[^}]*pointer-events:\s*auto;[^}]*transform:\s*translateX\(0\);/s)
  })
})
