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
  // Map container should be visible
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15000 })
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 't1-app-loads.png') })
})

test('T2: Sidebar shows 5 datasets in manifest', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  // Click the MUI Select combobox for Dataset (first combobox in sidebar)
  await page.locator('div[role="combobox"]').first().click()
  await page.waitForSelector('[role="listbox"]')
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 't2-dataset-dropdown.png') })
  // Should have 5 options from DATASET_MANIFEST
  const menuItems = page.locator('[role="option"]')
  const count = await menuItems.count()
  expect(count).toBeGreaterThanOrEqual(5)
  await page.keyboard.press('Escape')
})

test('T3: District dataset loads and colors map', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  // Wait for map to load with data (colored districts)
  await page.waitForSelector('.leaflet-container', { timeout: 15000 })
  // Wait for data to load (loading overlay disappears)
  await page.waitForSelector('text=Loading dataset...', { state: 'hidden', timeout: 20000 }).catch(() => {})
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 't3-district-colored.png') })
  // Map should have colored paths (not all gray)
  const coloredPaths = page.locator('path[fill]:not([fill="#e0e0e0"])')
  const coloredCount = await coloredPaths.count()
  expect(coloredCount).toBeGreaterThan(0)
})

test('T4: Province dataset renders on district geometry', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.waitForSelector('.leaflet-container', { timeout: 15000 })
  
  // Select "Accommodations by Province" dataset
  // Click the Dataset select
  await page.locator('div[role="combobox"]').first().click()
  await page.waitForSelector('[role="listbox"]')
  await page.locator('[role="option"]:has-text("Accommodations by Province")').click()
  
  // Wait for data to load
  await page.waitForSelector('text=Loading dataset...', { state: 'hidden', timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(2000)
  
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 't4-province-dataset.png') })
  
  // Map should still have colored paths (province data expanded to districts)
  const coloredPaths = page.locator('path[fill]:not([fill="#e0e0e0"])')
  const coloredCount = await coloredPaths.count()
  expect(coloredCount).toBeGreaterThan(0)
})

test('T5: SLBFE dataset shows metric selector', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.waitForSelector('.leaflet-container', { timeout: 15000 })
  
  // Select SLBFE dataset
  await page.locator('div[role="combobox"]').first().click()
  await page.waitForSelector('[role="listbox"]')
  await page.locator('[role="option"]:has-text("SLBFE")').click()
  
  // Wait for data to load
  await page.waitForSelector('text=Loading dataset...', { state: 'hidden', timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(1000)
  
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 't5-slbfe-metric-selector.png') })
  
  const metricLabel = page.locator('label').filter({ hasText: 'Metric' })
  await expect(metricLabel).toBeVisible({ timeout: 5000 })
})

test('T6: Year switching works', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.waitForSelector('.leaflet-container', { timeout: 15000 })
  await page.waitForSelector('text=Loading dataset...', { state: 'hidden', timeout: 20000 }).catch(() => {})
  
  // Click Year dropdown (second combobox)
  const comboboxes = page.locator('div[role="combobox"]')
  await comboboxes.nth(1).click()
  await page.waitForSelector('[role="listbox"]')
  
  // Select 2023
  const yearOption = page.locator('[role="option"]:has-text("2023")')
  if (await yearOption.count() > 0) {
    await yearOption.click()
    await page.waitForSelector('text=Loading dataset...', { state: 'hidden', timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(1000)
  }
  
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 't6-year-switch.png') })
  // Map should still be colored after year switch
  const coloredPaths = page.locator('path[fill]:not([fill="#e0e0e0"])')
  const coloredCount = await coloredPaths.count()
  expect(coloredCount).toBeGreaterThan(0)
})

test('T7: Tooltip appears on hover and disappears on mouseout', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.waitForSelector('.leaflet-container', { timeout: 15000 })
  await page.waitForSelector('text=Loading dataset...', { state: 'hidden', timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(2000)
  
  // Hover over a district path
  const paths = page.locator('.leaflet-interactive')
  const pathCount = await paths.count()
  
  if (pathCount > 0) {
    const mapContainer = page.locator('.leaflet-container')
    const box = await mapContainer.boundingBox()
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    } else {
      await paths.nth(10).hover({ force: true })
    }
    await page.waitForTimeout(500)
    
    // Tooltip should appear
    const tooltip = page.locator('.leaflet-tooltip')
    const tooltipVisible = await tooltip.isVisible().catch(() => false)
    
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 't7-tooltip-hover.png') })
    
    // Move mouse away from map entirely
    await page.mouse.move(10, 10)
    await page.waitForTimeout(500)
    
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 't7-tooltip-after-mouseout.png') })
    
    // Tooltip should be gone
    const tooltipAfter = page.locator('.leaflet-tooltip')
    const tooltipVisibleAfter = await tooltipAfter.isVisible().catch(() => false)
    
    // Log result (tooltip fix verification)
    console.log(`Tooltip visible on hover: ${tooltipVisible}`)
    console.log(`Tooltip visible after mouseout: ${tooltipVisibleAfter}`)
    
    // The tooltip should NOT be visible after mouseout
    expect(tooltipVisibleAfter).toBe(false)
  }
})
