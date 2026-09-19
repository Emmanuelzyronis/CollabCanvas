const pw = await import('playwright')
const chromium = pw.chromium ?? pw.default?.chromium
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' })
await page.locator('[data-preset="website"]').click()
await page.waitForURL(/pageId=/)
await page.waitForTimeout(1200)
const hits = await page.evaluate(() => {
  const out = []
  document.querySelectorAll('*').forEach((el) => {
    if (el.children.length === 0) {
      const t = el.textContent ?? ''
      if (/design graph|canonical/i.test(t)) out.push({ tag: el.tagName, text: t.slice(0, 140) })
    }
  })
  return out
})
console.log(JSON.stringify(hits, null, 2))
await browser.close()
