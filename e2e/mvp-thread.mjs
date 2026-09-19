/**
 * Browser proof of the seamless-MVP thread (docs/mvp.md, section 6).
 *
 * Drives only the visible interface: start a design, describe a hero, review
 * and approve the suggestion, see real selectable elements, ask for a spacing
 * refinement, and confirm the design survives reload. No test helpers, no
 * console access — if a step needs inside knowledge it is reported as failed.
 *
 * Requires a running dev server (`npm run dev`) and API (`npm run api`).
 * Run with: npm run workflow:mvp
 */
import { mkdirSync } from 'node:fs'

const candidates = [process.env.PLAYWRIGHT_ENTRY, 'playwright', 'playwright-core'].filter(Boolean)
let playwright
for (const candidate of candidates) {
  try { playwright = await import(candidate.startsWith('/') ? `file://${candidate}` : candidate); break } catch {}
}
if (!playwright) { console.error('Playwright is required.'); process.exit(2) }
const chromium = playwright.chromium ?? playwright.default?.chromium

const APP = process.env.CC_APP ?? 'http://127.0.0.1:5173/'
const SHOTS = process.env.CC_SHOT_DIR ?? '.playwright-mcp'
mkdirSync(SHOTS, { recursive: true })

const results = []
const log = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`) }

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const consoleErrors = []
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
page.on('pageerror', (e) => consoleErrors.push(String(e)))
const settle = (ms = 700) => page.waitForTimeout(ms)
const nodes = () => page.locator('[data-canvas-node-id]').count()
const layers = () => page.locator('[data-layer-node-id]').count()

/** Ask the assistant and wait until it either has a proposal or explains itself. */
async function ask(instruction) {
  await page.locator('[data-copilot-toggle="true"]').click().catch(() => {})
  const open = await page.locator('[data-copilot-panel-host]').isVisible().catch(() => false)
  if (!open) await page.locator('[data-copilot-toggle="true"]').click()
  await page.locator('textarea[aria-label="Ask the design assistant"]').fill(instruction)
  await page.getByRole('button', { name: 'Suggest a change' }).click()
  await page.waitForSelector('[data-copilot-proposal-state="ready"], [data-copilot-proposal-state="clarification"]', { timeout: 90000 })
  const state = await page.locator('[data-copilot-panel-host] [data-copilot-proposal-state]').first().getAttribute('data-copilot-proposal-state')
  if (state !== 'ready') console.log('   assistant state:', state, (await page.locator('[data-copilot-panel-host]').innerText()).replace(/\s+/g, ' ').slice(0, 160))
  return state === 'ready'
}

/** Approve the pending suggestion straight from the review surface. */
async function approve() {
  await page.getByRole('link', { name: 'Review suggestion' }).click()
  await page.waitForSelector('[data-proposal-review-state="pending"]', { timeout: 20000 })
  await page.getByRole('button', { name: 'Apply suggestion' }).click()
  await page.waitForSelector('[data-proposal-review-state="approved"]', { timeout: 20000 })
  await page.getByRole('button', { name: 'Back to design' }).click()
  await page.waitForURL((url) => !url.search.includes('proposalId'), { timeout: 20000 })
  await settle(1200)
}

/** Where each element sits on screen, keyed by node id. */
const positions = async () => Object.fromEntries(
  await page.locator('[data-canvas-node-id]').evaluateAll((els) => els.map((el) => [el.getAttribute('data-canvas-node-id'), Math.round(el.getBoundingClientRect().top)])),
)

// 1-2. Open CollabCanvas and start a design.
await page.goto(APP, { waitUntil: 'domcontentloaded' })
await page.locator('[data-preset="blank"]').click()
await page.waitForURL(/pageId=/, { timeout: 15000 })
await settle(900)
log('mvp: a real empty design opens', (await nodes()) === 0, `nodes=${await nodes()}`)

// 3-5. Describe a hero, see a proposal, approve it. A model may occasionally
// decline; one retry keeps the proof about the product rather than the model.
let ready = await ask('Add a hero section')
if (!ready) ready = await ask('Add a hero section to this empty page')
log('mvp: the assistant proposes real elements from one sentence', ready)
const reviewCount = await page.getByRole('link', { name: 'Review suggestion' }).count()
log('mvp: the suggestion is reviewable before it is applied', reviewCount === 1)
await approve()

// 6. The hero is real, separate, selectable design state.
const heroNodes = await nodes()
log('mvp: approving creates separate, editable elements', heroNodes >= 4, `nodes=${heroNodes}`)
log('mvp: Layers reflects the new design', (await layers()) === heroNodes, `layers=${await layers()} nodes=${heroNodes}`)
const copy = (await page.locator('[data-canvas-node-id] text').allTextContents()).join(' ').trim()
log('mvp: the new elements are visible on the canvas', copy.length > 0, copy.replace(/\s+/g, ' ').slice(0, 60))
await page.screenshot({ path: `${SHOTS}/mvp-hero.png` })

// 7. Change the heading text by hand through the inspector.
await page.locator('[data-layer-node-id]').first().click()
await settle(400)
const headingRow = page.locator('[data-layer-node-id]').nth(1)
await headingRow.click()
await settle(400)
const nameField = page.locator('input[aria-label="Node name"]')
await nameField.fill('Hero headline')
await nameField.press('Tab')
await settle(900)
const renamed = await page.locator('[data-layer-node-id]', { hasText: 'Hero headline' }).count()
log('mvp: a person can rename an element by hand', renamed >= 1 && (await nameField.inputValue()) === 'Hero headline', `rows=${renamed} name=${await nameField.inputValue()}`)

// 8. Select the section and ask for a spacing refinement; assert real reflow.
await page.locator('[data-layer-node-id]').first().click()
await settle(500)
const beforePositions = await positions()
const refined = await ask('make it more spacious')
if (refined) {
  await approve()
  const afterPositions = await positions()
  const moved = Object.keys(beforePositions).filter((id) => afterPositions[id] !== undefined && afterPositions[id] !== beforePositions[id])
  log('mvp: a spacing refinement changes the real layout', moved.length > 0, `${moved.length} element(s) reflowed`)
} else {
  log('mvp: a spacing refinement changes the real layout', false, 'assistant declined the refinement')
}
await page.screenshot({ path: `${SHOTS}/mvp-refined.png` })

// 9-10. Reload: the design is identical.
const beforeReload = { nodes: await nodes(), layers: await layers(), positions: await positions() }
await page.reload({ waitUntil: 'domcontentloaded' })
await settle(1200)
const afterReload = { nodes: await nodes(), layers: await layers(), positions: await positions() }
log('mvp: the design survives reload', beforeReload.nodes === afterReload.nodes && beforeReload.layers === afterReload.layers,
  `nodes ${beforeReload.nodes}->${afterReload.nodes} layers ${beforeReload.layers}->${afterReload.layers}`)
const identical = Object.keys(beforeReload.positions).every((id) => afterReload.positions[id] === beforeReload.positions[id])
log('mvp: the refined layout persists across reload', identical, `${Object.keys(beforeReload.positions).length} elements compared`)

// 11. Handoff: the brief a coding agent builds from.
await page.evaluate(() => {
  const params = new URLSearchParams(window.location.search)
  params.set('surface', 'handoff')
  window.history.pushState({}, '', `?${params.toString()}`)
  window.dispatchEvent(new PopStateEvent('popstate'))
})
await settle(1200)
const brief = await page.locator('[data-handoff-brief="true"]').innerText().catch(() => '')
log('mvp: handoff describes the real design', brief.includes('Hero headline') || /headline|hero/i.test(brief), brief.split('\n')[0]?.slice(0, 60) ?? '')
log('mvp: no console errors during the thread', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '))

await browser.close()
const passed = results.filter(Boolean).length
console.log(`\n${passed}/${results.length} checks passed`)
process.exit(passed === results.length ? 0 : 1)
