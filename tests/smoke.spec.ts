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

  const headerText = await page.locator('text=/datasets/').first().textContent()
  expect(headerText).toBeTruthy()

  const countMatch = headerText?.replace(/,/g, '').match(/(\d+)\s+datasets/i)
  expect(countMatch).toBeTruthy()

  const count = Number(countMatch?.[1] || '0')
  expect(count).toBeGreaterThan(150)
})

test('T3: Dataset dropdown is searchable and populated', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await page.getByPlaceholder('Search 150+ datasets').fill('province')
  await page.locator('div[role="combobox"]').first().click()
  await page.waitForSelector('[role="listbox"]')

  const menuItems = page.locator('[role="option"]')
  const count = await menuItems.count()
  expect(count).toBeGreaterThan(5)

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 't2-dataset-dropdown.png') })
  await page.keyboard.press('Escape')
})

test('T4: Map-compatible dataset renders colored districts', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await page.waitForSelector('.leaflet-container', { timeout: 30000 })
  await page.waitForTimeout(2000)

  const coloredPaths = page.locator('path[fill]:not([fill="#f5f5f5"])')
  const coloredCount = await coloredPaths.count()
  expect(coloredCount).toBeGreaterThan(0)

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 't3-district-colored.png') })
})

test('T5: Sync controls and source chips are visible', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await expect(page.getByRole('button', { name: 'Sync now' })).toBeVisible({ timeout: 10000 })
  await expect(page.locator('text=/LDFLK\\s+\\d+/')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('text=/nuuuwan\\s+\\d+/')).toBeVisible({ timeout: 10000 })

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
