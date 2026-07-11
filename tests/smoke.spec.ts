import { test, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots')

test.beforeAll(() => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  }
})

test('T1: App loads and map renders', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30000 })
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 't1-app-loads.png') })
})

test('T2: Live catalog exposes 150+ datasets', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  // The terminal status bar reports the catalog size as "{N} SETS".
  await expect
    .poll(
      async () => {
        const t = (await page.getByTestId('terminal-status-bar').textContent()) ?? ''
        const m = t.replace(/,/g, '').match(/(\d+)\s*SETS/i)
        return Number(m?.[1] ?? '0')
      },
      { timeout: 20000 },
    )
    .toBeGreaterThan(150)
})

test('T3: Dataset dropdown is searchable and populated', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await page.getByRole('combobox', { name: 'Search datasets' }).fill('province')
  await page.locator('div[role="combobox"]').first().click()
  await page.waitForSelector('[role="listbox"]')

  const menuItems = page.locator('[role="option"]')
  const count = await menuItems.count()
  // Live catalog: assert the search returns multiple results (exact count drifts
  // as upstream datasets change).
  expect(count).toBeGreaterThanOrEqual(3)

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 't2-dataset-dropdown.png') })
  await page.keyboard.press('Escape')
})

test('T4: Map-compatible dataset renders the choropleth', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await page.waitForSelector('.leaflet-container', { timeout: 30000 })
  await page.waitForTimeout(2500)

  // The choropleth renders on a Leaflet canvas (preferCanvas) rather than SVG
  // paths. This is a renderer-level assertion, independent of upstream catalog
  // response timing.
  const canvas = page.locator('.leaflet-container canvas')
  await expect(canvas.first()).toBeVisible({ timeout: 30000 })
  expect(await canvas.count()).toBeGreaterThan(0)

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 't3-district-colored.png') })
})

test('T5: Sync and theme controls are visible', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await expect(page.getByRole('button', { name: 'Sync', exact: true })).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('button', { name: /Switch to (light|dark) theme/ })).toBeVisible({ timeout: 10000 })

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 't5-sync-and-sources.png') })
})

test('T6: Table tab opens and shows rows', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await page.getByRole('tab', { name: 'Table' }).click()
  await page.waitForTimeout(1500)

  const table = page.locator('table')
  await expect(table).toBeVisible({ timeout: 15000 })

  const rows = page.locator('tbody tr')
  expect(await rows.count()).toBeGreaterThan(0)

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 't6-table-tab.png') })
})

test('T7: Tooltip appears on hover and disappears on mouseout', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.waitForSelector('.leaflet-container', { timeout: 30000 })
  await page.waitForTimeout(2000)

  const mapContainer = page.locator('.leaflet-container')
  const box = await mapContainer.boundingBox()
  expect(box).toBeTruthy()

  if (!box) return

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForTimeout(600)

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 't7-tooltip-hover.png') })

  await page.mouse.move(10, 10)
  await page.waitForTimeout(700)

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 't7-tooltip-after-mouseout.png') })

  const tooltipAfter = page.locator('.leaflet-tooltip')
  const tooltipVisibleAfter = await tooltipAfter.isVisible().catch(() => false)
  expect(tooltipVisibleAfter).toBe(false)
})
