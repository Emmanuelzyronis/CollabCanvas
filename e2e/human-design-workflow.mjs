/**
 * Human design workflow proof for the visual design slice.
 *
 * Drives a real browser with real pointer and keyboard input: create a
 * composition from scratch, style typography, shapes and a real image, then
 * prove canonical undo/redo, reload persistence, Canvas/Layers/Inspector
 * convergence and viewport stability.
 *
 * Requires a running dev server (`npm run dev`) and API (`npm run api`).
 * Run with: npm run workflow:human
 */
import { mkdirSync } from 'node:fs'

const moduleCandidates = [process.env.PLAYWRIGHT_ENTRY, 'playwright', 'playwright-core'].filter(Boolean)
let playwright
for (const candidate of moduleCandidates) {
  try {
    playwright = await import(candidate.startsWith('/') ? `file://${candidate}` : candidate)
    break
  } catch {
    // try the next candidate
  }
}
if (!playwright) {
  console.error('Playwright is required. Install it (`npm i -D playwright`) or point PLAYWRIGHT_ENTRY at a playwright entry file.')
  process.exit(2)
}
const chromium = playwright.chromium ?? playwright.default?.chromium

const APP = process.env.CC_APP ?? 'http://127.0.0.1:5173/'
const SHOTS = process.env.CC_SHOT_DIR ?? '.playwright-mcp'
mkdirSync(SHOTS, { recursive: true })
const results = []
const log = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`) }

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const consoleErrors = []
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
page.on('pageerror', (e) => consoleErrors.push(String(e)))
page.on('request', (r) => { if (r.url().includes('/history')) console.log('HISTORY-LOG req', r.postData()) })
page.on('response', async (r) => { if (r.url().includes('/history')) console.log('HISTORY-LOG res', r.status()) })

const settle = (ms = 400) => page.waitForTimeout(ms)
const svg = () => page.locator('svg[aria-label="Canvas interaction surface"]')
const selected = () => page.locator('[data-canvas-node-id][data-selected="true"]').first()

async function dragScreen(x1, y1, x2, y2) {
  await page.mouse.move(x1, y1)
  await page.mouse.down()
  await page.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, { steps: 8 })
  await page.mouse.move(x2, y2, { steps: 8 })
  await page.mouse.up()
  await settle()
}

async function insert(tool, x1, y1, x2, y2) {
  await page.locator(`[data-tool="${tool}"]`).click()
  const box = await svg().boundingBox()
  await dragScreen(box.x + x1, box.y + y1, box.x + x2, box.y + y2)
}

async function selectLayer(name) {
  await page.locator(`button[aria-label="Select ${name}"]`).first().click()
  await settle()
}

async function setField(selector, value) {
  const input = page.locator(selector).first()
  await input.fill(value)
  await input.press('Tab')
  await settle(450)
}

await page.goto(APP)
await page.locator('[data-preset="blank"]').click()
await page.waitForSelector('[data-editor-toolbar="true"]')
await settle(600)
log('blank workspace opens in the human editor', true)

await insert('section', 60, 40, 900, 700)
await selectLayer('Section')
await setField('input[aria-label="Fill"]', '#f1f5f9')
await setField('input[aria-label="Border width"]', '0')
await setField('input[aria-label="Radius"]', '24')

await insert('heading', 110, 80, 780, 200)
await selectLayer('Heading')
const headingBox = await selected().boundingBox()
await page.mouse.dblclick(headingBox.x + headingBox.width / 2, headingBox.y + headingBox.height / 2)
await page.waitForSelector('[data-inline-text-editor="true"]')
await page.locator('[data-inline-text-editor="true"]').fill('Harbour Coffee Roasters')
await page.locator('[data-inline-text-editor="true"]').press('Enter')
await settle(600)
await selectLayer('Heading')
const inlineText = await page.locator('textarea[aria-label="Text content"]').first().inputValue()
log('heading text changed with inline editing', inlineText === 'Harbour Coffee Roasters', inlineText)
await setField('input[aria-label="Font size"]', '34')
await page.locator('select[aria-label="Font weight"]').selectOption('800')
await settle(450)
await page.locator('select[aria-label="Text alignment"]').selectOption('left')
await settle(450)
await setField('input[aria-label="Text color"]', '#0f172a')
const canvasHeading = (await page.locator('[data-canvas-node-id][data-selected="true"] text tspan').allTextContents()).join(' ').replace(/\s+/g, ' ').trim()
log('canvas renders the styled heading text', canvasHeading === 'Harbour Coffee Roasters', String(canvasHeading))

await insert('card', 110, 250, 470, 480)
await selectLayer('Card')
await setField('input[aria-label="Fill"]', '#ffffff')
await setField('input[aria-label="Border"]', '#cbd5e1')
await setField('input[aria-label="Border width"]', '2')
await setField('input[aria-label="Radius"]', '20')

const cardBox = await selected().boundingBox()
await page.mouse.dblclick(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2)
await page.waitForSelector('[data-inline-text-editor="true"]')
await page.locator('[data-inline-text-editor="true"]').fill('Signature blend')
await page.locator('[data-inline-text-editor="true"]').press('Enter')
await settle(600)
await selectLayer('Card')
const cardText = await page.locator('textarea[aria-label="Text content"]').first().inputValue()
const cardHasTypography = await page.locator('select[aria-label="Font weight"]').count()
log('text typed into a shape stays editable in the inspector', cardText === 'Signature blend' && cardHasTypography === 1, `${cardText} / typography controls=${cardHasTypography}`)

await insert('image', 540, 250, 850, 520)
await selectLayer('Image')
const imageBefore = await selected().boundingBox()
await dragScreen(imageBefore.x + imageBefore.width / 2, imageBefore.y + imageBefore.height / 2, imageBefore.x + imageBefore.width / 2 + 40, imageBefore.y + imageBefore.height / 2 + 60)
await selectLayer('Image')
const imageAfterMove = await selected().boundingBox()
log('image moves by direct manipulation', imageAfterMove.y > imageBefore.y + 20, `dy=${Math.round(imageAfterMove.y - imageBefore.y)}`)

await selectLayer('Image')
await page.keyboard.press('Control+z'); await settle(800)
await selectLayer('Image')
const imageAfterUndoMove = await selected().boundingBox()
await page.keyboard.press('Control+Shift+z'); await settle(800)
await selectLayer('Image')
const imageAfterRedoMove = await selected().boundingBox()
log('image move participates in canonical undo/redo',
  Math.abs(imageAfterUndoMove.y - imageBefore.y) < 8 && Math.abs(imageAfterRedoMove.y - imageAfterMove.y) < 8,
  `y ${Math.round(imageBefore.y)} -> ${Math.round(imageAfterMove.y)} -> undo ${Math.round(imageAfterUndoMove.y)} -> redo ${Math.round(imageAfterRedoMove.y)}`)

const zoom = Number((await page.locator('button[title="Reset zoom"]').first().textContent().catch(() => '152%') ?? '152%').replace('%', '')) / 100
const imageBeforeWorldWidth = Number(await page.locator('input[aria-label="Width"]').first().inputValue())
const se = await page.locator('[data-resize-handle="se"]').boundingBox()
await dragScreen(se.x + se.width / 2, se.y + se.height / 2, se.x + se.width / 2 + 90, se.y + se.height / 2 + 70)
const imageAfterResize = await selected().boundingBox()
log('image resizes by direct manipulation', imageAfterResize.width > imageAfterMove.width + 40, `dw=${Math.round(imageAfterResize.width - imageAfterMove.width)}`)

const imageWidthAfterResize = Number(await page.locator('input[aria-label="Width"]').first().inputValue())
await selectLayer('Image')
await page.keyboard.press('Control+z'); await settle(800)
const imageWidthAfterUndoResize = Number(await page.locator('input[aria-label="Width"]').first().inputValue())
await page.keyboard.press('Control+Shift+z'); await settle(800)
const imageWidthAfterRedoResize = Number(await page.locator('input[aria-label="Width"]').first().inputValue())
log('image resize participates in canonical undo/redo',
  Math.abs(imageWidthAfterUndoResize - imageBeforeWorldWidth) < 0.01 && Math.abs(imageWidthAfterRedoResize - imageWidthAfterResize) < 0.01,
  `width ${imageBeforeWorldWidth} -> ${imageWidthAfterResize} -> undo ${imageWidthAfterUndoResize} -> redo ${imageWidthAfterRedoResize}`)
const imageHref = await page.locator('[data-canvas-node-id][data-selected="true"] image').first().getAttribute('href')
log('image renders a real asset source on the canvas', Boolean(imageHref && imageHref.startsWith('data:image/')), String(imageHref).slice(0, 24))

const imageGeometry = await page.locator('[data-canvas-node-id][data-selected="true"]').first().evaluate((g) => {
  const num = (el, attr) => Number(el.getAttribute(attr))
  const frame = g.querySelector('rect')
  const image = g.querySelector('image')
  return {
    frame: { x: num(frame, 'x'), y: num(frame, 'y'), w: num(frame, 'width'), h: num(frame, 'height') },
    cover: { x: num(image, 'x'), y: num(image, 'y'), w: num(image, 'width'), h: num(image, 'height') },
    clip: image.getAttribute('clip-path'),
  }
})
const coverCoversFrame = imageGeometry.cover.w >= imageGeometry.frame.w - 0.01 && imageGeometry.cover.h >= imageGeometry.frame.h - 0.01
const coverTouchesEdge = Math.abs(imageGeometry.cover.w - imageGeometry.frame.w) < 0.01 || Math.abs(imageGeometry.cover.h - imageGeometry.frame.h) < 0.01
const coverCentered = Math.abs((imageGeometry.cover.x + imageGeometry.cover.w / 2) - (imageGeometry.frame.x + imageGeometry.frame.w / 2)) < 0.01
  && Math.abs((imageGeometry.cover.y + imageGeometry.cover.h / 2) - (imageGeometry.frame.y + imageGeometry.frame.h / 2)) < 0.01
const coverAspect = imageGeometry.cover.w / imageGeometry.cover.h
log('resized image fills its frame instead of letterboxing', coverCoversFrame && coverTouchesEdge && coverCentered && Math.abs(coverAspect - 800 / 520) < 0.001 && Boolean(imageGeometry.clip), `frame=${imageGeometry.frame.w.toFixed(1)}x${imageGeometry.frame.h.toFixed(1)} cover=${imageGeometry.cover.w.toFixed(1)}x${imageGeometry.cover.h.toFixed(1)} clip=${imageGeometry.clip}`)

await insert('button', 110, 540, 330, 610)
await selectLayer('Button')
await setField('input[aria-label="Fill"]', '#1d4ed8')
await setField('input[aria-label="Border width"]', '0')
await setField('input[aria-label="Radius"]', '14')
await setField('input[aria-label="Text color"]', '#ffffff')
const buttonFillBeforeUndo = await page.locator('input[aria-label="Fill"]').first().inputValue()
log('button styled as a rounded filled action', buttonFillBeforeUndo === '#1d4ed8', buttonFillBeforeUndo)

await setField('input[aria-label="Radius"]', '30')
const radiusBeforeUndo = await page.locator('input[aria-label="Radius"]').first().inputValue()
await selectLayer('Button')
await page.keyboard.press('Control+z'); await settle(800)
const radiusAfterUndo = await page.locator('input[aria-label="Radius"]').first().inputValue()
await page.keyboard.press('Control+Shift+z'); await settle(800)
const radiusAfterRedo = await page.locator('input[aria-label="Radius"]').first().inputValue()
log('undo reverts and redo restores a visual mutation', radiusBeforeUndo === '30' && radiusAfterUndo !== '30' && radiusAfterRedo === '30', `radius ${radiusBeforeUndo} -> ${radiusAfterUndo} -> ${radiusAfterRedo}`)

await page.screenshot({ path: `${SHOTS}/human-workflow-1440x1000.png` })

await page.reload()
await page.waitForSelector('[data-editor-toolbar="true"]')
await settle(900)
const nodesAfterReload = await page.locator('[data-canvas-node-id]').count()
log('composition survives reload', nodesAfterReload === 5, `${nodesAfterReload} nodes`)

await selectLayer('Heading')
const fontSizeAfterReload = await page.locator('input[aria-label="Font size"]').first().inputValue()
const textAfterReload = await page.locator('textarea[aria-label="Text content"]').first().inputValue()
const weightAfterReload = await page.locator('select[aria-label="Font weight"]').first().inputValue()
log('typography persists through reload', fontSizeAfterReload === '34' && textAfterReload === 'Harbour Coffee Roasters' && weightAfterReload === '800', `size=${fontSizeAfterReload} weight=${weightAfterReload} text=${textAfterReload}`)

await selectLayer('Card')
const cardFill = await page.locator('input[aria-label="Fill"]').first().inputValue()
const cardRadius = await page.locator('input[aria-label="Radius"]').first().inputValue()
const cardBorder = await page.locator('input[aria-label="Border width"]').first().inputValue()
log('shape styling persists through reload', cardFill === '#ffffff' && cardRadius === '20' && cardBorder === '2', `fill=${cardFill} radius=${cardRadius} border=${cardBorder}`)

await selectLayer('Image')
const imagePreview = await page.locator('[data-inspector-image-preview="true"]').count()
const inspectorText = await page.locator('[data-inspector-state="single"]').innerText()
log('inspector previews the image without dumping the raw asset source', imagePreview === 1 && !inspectorText.includes('data:image/'), `preview=${imagePreview}`)
const imageLayout = {
  width: await page.locator('input[aria-label="Width"]').first().inputValue(),
  height: await page.locator('input[aria-label="Height"]').first().inputValue(),
}
log('resized image geometry persists through reload', Number(imageLayout.width) > imageBeforeWorldWidth + 20, `width=${imageLayout.width} (was ~${imageBeforeWorldWidth.toFixed(1)})`)

const layerRows = await page.locator('[data-layer-node-id]').count()
log('canvas, layers and inspector agree on the composition', layerRows === nodesAfterReload, `${layerRows} layer rows`)

const metrics1440 = await page.evaluate(() => ({ scrollHeight: document.documentElement.scrollHeight, innerHeight: window.innerHeight, svgHeight: document.querySelector('svg[aria-label="Canvas interaction surface"]')?.getBoundingClientRect().height ?? 0 }))
log('no viewport ballooning at 1440x1000', metrics1440.scrollHeight <= metrics1440.innerHeight + 1 && metrics1440.svgHeight < metrics1440.innerHeight, JSON.stringify(metrics1440))

await page.setViewportSize({ width: 1600, height: 900 })
await settle(600)
const metrics1600 = await page.evaluate(() => ({ scrollHeight: document.documentElement.scrollHeight, innerHeight: window.innerHeight, svgHeight: document.querySelector('svg[aria-label="Canvas interaction surface"]')?.getBoundingClientRect().height ?? 0 }))
log('canvas stays stable at 1600x900', metrics1600.scrollHeight <= metrics1600.innerHeight + 1 && metrics1600.svgHeight < metrics1600.innerHeight, JSON.stringify(metrics1600))
await page.screenshot({ path: `${SHOTS}/human-workflow-1600x900.png` })

log('no console errors during the workflow', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))
console.log('\nURL:', page.url())
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
await browser.close()
process.exit(failed.length ? 1 : 0)
