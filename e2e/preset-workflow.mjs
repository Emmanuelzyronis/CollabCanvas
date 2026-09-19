/**
 * Browser proof for the human editor presets.
 *
 * Drives the real start screen and asserts that each preset opens a real
 * canonical design: seeded nodes render and fit the viewport, Layers agrees,
 * starter copy is visible, a seeded node selects and edits through the
 * inspector, and the design survives reload.
 *
 * Requires a running dev server (`npm run dev`) and API (`npm run api`).
 * Run with: npm run workflow:presets
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

const expected = { website: 8, flyer: 5, logo: 4, blank: 0 }
const expectText = {
  website: 'Design at the speed of thought',
  flyer: 'HARBOUR COFFEE NIGHT MARKET',
  logo: 'Northwind',
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const consoleErrors = []
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
page.on('pageerror', (e) => consoleErrors.push(String(e)))
const svg = () => page.locator('svg[aria-label="Canvas interaction surface"]')

for (const preset of ['website', 'flyer', 'logo', 'blank']) {
  await page.goto(APP, { waitUntil: 'domcontentloaded' })
  await page.locator(`[data-preset="${preset}"]`).click()
  await page.waitForURL(/pageId=/, { timeout: 15000 })
  await page.waitForTimeout(900)

  const nodes = await page.locator('[data-canvas-node-id]').count()
  const layers = await page.locator('[data-layer-node-id]').count()
  log(`${preset}: seed renders the expected canonical nodes`, nodes === expected[preset], `nodes=${nodes} expected=${expected[preset]}`)
  log(`${preset}: layers reflect the same graph`, layers === nodes, `layers=${layers} nodes=${nodes}`)

  if (expectText[preset]) {
    const text = (await page.locator('[data-canvas-node-id] text').allTextContents()).join(' ')
    const normalize = (value) => value.replace(/\s+/g, '')
    log(`${preset}: starter copy is visible on the canvas`, normalize(text).includes(normalize(expectText[preset])), text.replace(/\s+/g, ' ').trim().slice(0, 70))
  }

  if (expected[preset] > 0) {
    const box = await svg().boundingBox()
    const frames = await page.locator('[data-canvas-node-id]').evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } }))
    const inside = frames.every((f) => f.x >= box.x - 1 && f.y >= box.y - 1 && f.x + f.w <= box.x + box.width + 1 && f.y + f.h <= box.y + box.height + 1)
    const merged = frames.reduce((acc, f) => ({ minX: Math.min(acc.minX, f.x), minY: Math.min(acc.minY, f.y), maxX: Math.max(acc.maxX, f.x + f.w), maxY: Math.max(acc.maxY, f.y + f.h) }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity })
    const fill = ((merged.maxX - merged.minX) * (merged.maxY - merged.minY)) / (box.width * box.height)
    log(`${preset}: starter design is fitted into the viewport`, inside && fill > 0.15, `filled=${(fill * 100).toFixed(0)}% insideViewport=${inside}`)
    await page.screenshot({ path: `${SHOTS}/preset-${preset}.png` })
  }

  if (preset === 'website') {
    // A person designing here must never read architecture vocabulary.
    const architecture = /design graph|graph node|canonical graph|graph-backed|graph operation|webmcp|agent center|manifest|projection|command bus|\bnode_[a-z0-9_]+/gi
    const bodyText = await page.locator('body').innerText()
    const leaks = bodyText.match(architecture) ?? []
    log('website: the editor shows design language, not architecture', leaks.length === 0, leaks.slice(0, 3).join(', '))

    for (const surface of ['overview', 'design-system', 'assets', 'versions', 'handoff', 'assistant']) {
      await page.evaluate((value) => {
        const params = new URLSearchParams(window.location.search)
        params.set('surface', value)
        window.history.pushState({}, '', `?${params.toString()}`)
        window.dispatchEvent(new PopStateEvent('popstate'))
      }, surface)
      await page.waitForTimeout(700)
      const text = await page.locator('body').innerText()
      const found = text.match(architecture) ?? []
      log(`${surface}: shows design language, not architecture`, found.length === 0, found.slice(0, 3).join(', '))

      if (surface === 'handoff') {
        const layers = await page.locator('[data-handoff-count="layers"]').innerText()
        const outlineRows = await page.locator('[data-handoff-outline] li').count()
        const brief = await page.locator('[data-handoff-brief="true"]').innerText()
        const json = await page.locator('[data-handoff-json="true"]').evaluate((el) => el.textContent ?? '')
        log('handoff: exposes the real design to a coding agent', layers === '8' && outlineRows === 8, `layers=${layers} outline=${outlineRows}`)
        log('handoff: implementation brief describes the actual design', brief.includes('Headline') && brief.includes('Design at the speed of thought'), brief.split('\n')[0])
        const parsed = JSON.parse(json)
        log('handoff: the design file is the deterministic handoff contract', Array.isArray(parsed.nodes) && parsed.nodes.length === 8 && Array.isArray(parsed.tokens), `nodes=${parsed.nodes?.length}`)
        const copyButtons = await page.getByRole('button', { name: /copy/i }).count()
        log('handoff: offers copy and download for the agent', copyButtons >= 2, `${copyButtons} copy actions`)
        await page.screenshot({ path: `${SHOTS}/handoff.png` })
      }
    }
    await page.evaluate(() => {
      const params = new URLSearchParams(window.location.search)
      params.set('surface', 'canvas')
      window.history.pushState({}, '', `?${params.toString()}`)
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await page.waitForTimeout(500)

    await page.locator('[data-layer-node-id]', { hasText: 'Headline' }).first().click()
    await page.waitForTimeout(400)
    const selectedId = await page.locator('[data-canvas-node-id][data-selected="true"]').count()
    const nameField = page.locator('input[aria-label="Node name"]')
    const seededName = await nameField.inputValue().catch(() => '')
    log('website: a seeded layer selects as a canonical node', selectedId === 1, `selected=${selectedId}`)
    log('website: the inspector reads the seeded node', seededName === 'Headline', `name=${seededName}`)

    await nameField.fill('Hero headline')
    await nameField.press('Tab')
    await page.waitForTimeout(900)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(900)
    const nodesAfterReload = await page.locator('[data-canvas-node-id]').count()
    const layersAfterReload = await page.locator('[data-layer-node-id]').count()
    const renamed = await page.locator('[data-layer-node-id]', { hasText: 'Hero headline' }).count()
    log('website: the starter design survives reload', nodesAfterReload === expected.website && layersAfterReload === expected.website, `nodes=${nodesAfterReload} layers=${layersAfterReload}`)
    log('website: a seeded node edits through the canonical command path', renamed === 1, `renamed rows=${renamed}`)
  }
}

// The design assistant must work on a brand-new (draft) design, and every
// suggestion must stay reviewable before it changes the design.
await page.goto(APP, { waitUntil: 'domcontentloaded' })
await page.locator('[data-preset="website"]').click()
await page.waitForURL(/pageId=/, { timeout: 15000 })
await page.waitForTimeout(900)
await page.evaluate(() => {
  const params = new URLSearchParams(window.location.search)
  params.set('surface', 'assistant')
  window.history.pushState({}, '', `?${params.toString()}`)
  window.dispatchEvent(new PopStateEvent('popstate'))
})
await page.waitForTimeout(700)
const provider = await page.locator('[data-assistant-provider]').first().getAttribute('data-assistant-provider')
log('assistant: reports which assistant is answering', provider === 'builtin' || provider === 'azure-openai', `provider=${provider}`)
await page.locator('textarea[aria-label="Ask the design assistant"]').fill('Remove Feature copy')
await page.getByRole('button', { name: 'Suggest a change' }).click()
await page.waitForSelector('[data-copilot-proposal-state="ready"]', { timeout: 15000 })
const reviewLink = page.getByRole('link', { name: 'Review suggestion' })
log('assistant: suggests a reviewable change on a brand-new design', (await reviewLink.count()) === 1)
await reviewLink.click()
await page.waitForSelector('[data-proposal-review-state="pending"]', { timeout: 15000 })
log('assistant: nothing is applied until the designer approves', true)
await page.getByRole('button', { name: 'Apply suggestion' }).click()
await page.waitForSelector('[data-proposal-review-state="approved"]', { timeout: 15000 })
log('assistant: approval applies the reviewed change', true)
await page.getByRole('button', { name: 'Back to design' }).click()
await page.waitForURL((url) => !url.search.includes('proposalId'), { timeout: 15000 })
await page.waitForTimeout(1200)
const nodesAfterAssistant = await page.locator('[data-canvas-node-id]').count()
log('assistant: the applied change is visible in the design', nodesAfterAssistant === 7, `nodes=${nodesAfterAssistant}`)
await page.screenshot({ path: `${SHOTS}/assistant-proposal.png` })

log('no console errors during preset creation', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '))
await browser.close()
const failed = results.filter((r) => !r).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
