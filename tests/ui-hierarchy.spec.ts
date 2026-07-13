import { test, expect } from '@playwright/test'

test('command surface is a single header above the map canvas', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const surface = page.getByTestId('command-surface')
  await expect(surface).toBeVisible({ timeout: 15000 })

  await expect(surface.getByTestId('command-brand')).toContainText('Lanka Mapper')
  await expect(surface.getByTestId('active-dataset-title')).not.toBeEmpty()
  await expect(surface.getByTestId('analysis-context')).toBeVisible()

  const canvas = page.locator('#main-content')
  await expect(canvas).toBeVisible()

  const surfaceBox = await surface.boundingBox()
  const canvasBox = await canvas.boundingBox()
  expect(surfaceBox).toBeTruthy()
  expect(canvasBox).toBeTruthy()
  if (surfaceBox && canvasBox) {
    expect(surfaceBox.y + surfaceBox.height).toBeLessThanOrEqual(canvasBox.y + 2)
  }

  await expect(page.getByTestId('terminal-status-bar')).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: 'Search all datasets' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sync dataset catalog' })).toHaveCount(1)
  await expect(page.getByLabel('Global dataset discovery')).toBeVisible()
  const hierarchy = await page.evaluate(() => {
    const title = document.querySelector<HTMLElement>('[data-testid="active-dataset-title"]')
    const brand = document.querySelector<HTMLElement>('[data-testid="command-brand-label"]')
    return { title: Number.parseFloat(getComputedStyle(title!).fontSize), brand: Number.parseFloat(getComputedStyle(brand!).fontSize) }
  })
  expect(hierarchy.title).toBeGreaterThan(hierarchy.brand)
})

test('inspector presents compatible data, stable framing, and unbroken values', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.waitForSelector('.leaflet-container', { timeout: 30000 })
  await expect(page.getByLabel('Map-compatible datasets')).toBeVisible()
  await expect(page.getByRole('radiogroup', { name: 'Map framing' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Auto' })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('radio', { name: 'Left' }).click()
  await expect(page.getByRole('radio', { name: 'Left' })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('button', { name: 'Reset map framing' }).click()
  await expect(page.getByRole('radio', { name: 'Left' })).toHaveAttribute('aria-checked', 'true')
  const noBrokenValues = await page.evaluate(() => Array.from(document.querySelectorAll('.mono')).every((element) => getComputedStyle(element).wordBreak !== 'break-all'))
  expect(noBrokenValues).toBe(true)
})

test('mobile first load keeps inspector collapsed and map visible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForLoadState('networkidle')

  await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.leaflet-container')).toBeVisible()

  const mapBox = await page.locator('.leaflet-container').boundingBox()
  expect(mapBox).toBeTruthy()
  if (mapBox) {
    expect(mapBox.height).toBeGreaterThan(200)
    expect(mapBox.width).toBeGreaterThan(200)
  }

  await expect(page.getByText('Inspector', { exact: true })).toHaveCount(0)
})

test('map time toolbar keeps scrubber play loop and step speed controls together', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await page.getByPlaceholder('Search all datasets').fill('Accommodations by District')
  await page.waitForSelector('[role="option"]', { timeout: 15000 })
  await page.getByRole('option').filter({ hasText: 'Accommodations by District' }).click()
  await page.waitForLoadState('networkidle')

  const toolbar = page.getByTestId('map-time-toolbar')
  await expect(toolbar).toBeVisible({ timeout: 30000 })
  await expect(toolbar.getByRole('button', { name: 'Play map time animation' })).toBeVisible()
  await expect(toolbar.getByRole('button', { name: 'Enable looping' })).toBeVisible()
  await expect(toolbar.getByRole('slider', { name: 'Timeline year scrubber' })).toBeVisible()
  await expect(toolbar.getByRole('button', { name: 'Slower playback' })).toBeVisible()
  await expect(toolbar.getByRole('button', { name: 'Faster playback' })).toBeVisible()
})
