import { test, expect } from '@playwright/test'

const SMALL_VIEWPORT = { width: 627, height: 676 }
const REQUIRED_VIEWPORTS = [
  { width: 320, height: 640 },
  { width: 390, height: 844 },
  { width: 627, height: 676 },
  { width: 768, height: 900 },
  { width: 1024, height: 768 },
  { width: 1440, height: 960 },
] as const

function overlap(a: DOMRect, b: DOMRect) {
  return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
    * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
}

async function openTimeMapDataset(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.waitForSelector('.leaflet-container', { timeout: 30000 })

  await page.getByRole('combobox', { name: 'Search all datasets' }).fill('Accommodations by District')
  await page.waitForSelector('[role="option"]', { timeout: 15000 })
  await page.getByRole('option').filter({ hasText: 'Accommodations by District' }).click()
  await page.waitForLoadState('networkidle')
  await page.waitForSelector('.leaflet-container', { timeout: 30000 })
  await expect(page.getByRole('button', { name: 'Play map time animation' })).toBeVisible({ timeout: 30000 })
}

test('small map viewport keeps controls from colliding', async ({ page }) => {
  await page.setViewportSize(SMALL_VIEWPORT)
  await openTimeMapDataset(page)

  await expect(page.getByText('Current year')).toHaveCount(0)

  const overlayState = await page.evaluate(() => {
    const area = (a: DOMRect, b: DOMRect) => {
      const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
      const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
      return Math.round(x * y)
    }
    const isVisible = (el: Element | null) => {
      if (!el) return false
      const rect = el.getBoundingClientRect()
      const style = window.getComputedStyle(el)
      return rect.width > 1 && rect.height > 1 && style.display !== 'none' && style.visibility !== 'hidden'
    }
    const elementWithText = (text: string) =>
      Array.from(document.querySelectorAll('#main-content *')).find((el) => el.textContent?.trim() === text)
    const panelForText = (text: string) => {
      let el = elementWithText(text)
      while (el && el.parentElement && el.id !== 'main-content') {
        const rect = el.getBoundingClientRect()
        const className = typeof el.className === 'string' ? el.className : ''
        if (rect.width > 80 && rect.height > 32 && /rounded|border|shadow/.test(className)) {
          return el
        }
        el = el.parentElement
      }
      return null
    }

    const scalePanel = panelForText('Scale')
    const playerPanel = Array.from(document.querySelectorAll('#main-content [class*="rounded-lg"]')).find(
      (el) => el.querySelector('[aria-label="Play map time animation"]'),
    )
    const regionsPanel = panelForText('Top Regions')
    const regionRows = regionsPanel
      ? Array.from(regionsPanel.querySelectorAll('button')).filter((button) => !button.textContent?.includes('Top Regions'))
      : []

    return {
      scaleVisible: isVisible(scalePanel),
      scalePlayerOverlap:
        scalePanel && playerPanel && isVisible(scalePanel)
          ? area(scalePanel.getBoundingClientRect(), playerPanel.getBoundingClientRect())
          : 0,
      visibleRegionRows: regionRows.filter(isVisible).length,
    }
  })

  expect(overlayState.scalePlayerOverlap).toBe(0)
  // Rankings auto-collapse on a short/narrow viewport so they don't cover the map.
  expect(await page.locator('[data-testid="ranking-row"]:visible').count()).toBe(0)

  await expect(page.getByRole('button', { name: 'Random dataset' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Region shading' }).first()).toBeVisible()

  // Expanding the panel reveals the ranking rows.
  await page.getByTestId('rankings-panel').getByRole('button', { name: 'Top Regions' }).click()
  await expect
    .poll(() => page.locator('[data-testid="ranking-row"]:visible').count(), { timeout: 5000 })
    .toBeGreaterThan(0)
})

test('mobile inspector uses dismissible dialog semantics', async ({ page }) => {
  await page.setViewportSize(SMALL_VIEWPORT)
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'Expand sidebar' }).click()
  await expect(page.getByRole('dialog', { name: 'Dataset inspector' })).toBeVisible()
  await expect(page.locator('.leaflet-container')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Dataset inspector' })).toHaveCount(0)
})

test('viewport framing controls preserve placement and reset the active framing', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.waitForSelector('.leaflet-container', { timeout: 30000 })
  const map = page.locator('.leaflet-container')
  await expect.poll(async () => Number(await map.getAttribute('data-map-frame-x'))).toBeGreaterThan(0.5)
  await page.getByRole('button', { name: 'Close Top Regions' }).click()
  await expect.poll(async () => Number(await map.getAttribute('data-map-frame-x'))).toBeCloseTo(0.5, 1)
  await page.getByRole('radio', { name: 'Right' }).click()
  await expect(page.getByRole('radio', { name: 'Right' })).toHaveAttribute('aria-checked', 'true')
  const requestedRight = Number(await map.getAttribute('data-map-frame-x'))
  expect(requestedRight).toBeGreaterThan(0.5)
  await page.getByRole('button', { name: 'Reset map framing' }).click()
  await expect(page.getByRole('radio', { name: 'Right' })).toHaveAttribute('aria-checked', 'true')
  await expect.poll(async () => Number(await map.getAttribute('data-map-frame-x'))).toBeCloseTo(requestedRight, 2)
})

test('mobile portrait keeps map time card clear of collapsed sidebar rail', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openTimeMapDataset(page)

  const layout = await page.evaluate(() => {
    const area = (a: DOMRect, b: DOMRect) => {
      const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
      const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
      return Math.round(x * y)
    }
    const playerPanel = document.querySelector('[data-testid="map-time-toolbar"]')
    const expandButton = document.querySelector('[aria-label="Expand sidebar"]')
    const sidebarRail = expandButton?.closest('[class*="fixed"]') ?? null
    if (!playerPanel || !sidebarRail) {
      return { missing: true, overlap: 0, playerRight: 0, railLeft: 0 }
    }
    const playerRect = playerPanel.getBoundingClientRect()
    const railRect = sidebarRail.getBoundingClientRect()
    return {
      missing: false,
      overlap: area(playerRect, railRect),
      playerRight: playerRect.right,
      railLeft: railRect.left,
    }
  })

  expect(layout.missing).toBe(false)
  expect(layout.overlap).toBe(0)
  expect(layout.playerRight).toBeLessThanOrEqual((layout.railLeft ?? 0) + 1)
})

test('every supported viewport has a fully usable, non-overflowing map canvas', async ({ page }) => {
  for (const viewport of REQUIRED_VIEWPORTS) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await page.waitForSelector('.leaflet-container', { timeout: 30000 })
    await expect(page.getByTestId('dataset-loading-overlay')).toHaveCount(0)

    const geometry = await page.evaluate(() => {
      const overlap = (a: DOMRect, b: DOMRect) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
        * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
      const visible = (element: Element | null) => {
        if (!element) return false
        const rect = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        return rect.width > 1 && rect.height > 1 && style.display !== 'none' && style.visibility !== 'hidden'
      }
      const rect = (selector: string) => {
        const element = document.querySelector(selector)
        return visible(element) ? element!.getBoundingClientRect() : null
      }
      const map = document.querySelector('.leaflet-container')
      const mapRect = map?.getBoundingClientRect()
      const canvas = document.querySelector('.leaflet-container canvas')
      const canvasRect = canvas?.getBoundingClientRect()
      const recenter = rect('[data-map-overlay-role="recenter"]')
      const expand = document.querySelector('[aria-label="Expand sidebar"]')
      const rail = visible(expand) ? expand?.closest('.fixed')?.getBoundingClientRect() ?? null : null
      const header = document.querySelector('[data-testid="command-surface"]')?.getBoundingClientRect() ?? null
      const legend = rect('[data-map-overlay-role="legend"]')
      const timeline = rect('[data-map-overlay-role="timeline"]')
      const rankings = rect('[data-map-overlay-role="rankings"]')
      const hit = recenter
        ? document.elementFromPoint(recenter.left + recenter.width / 2, recenter.top + recenter.height / 2)
        : null
      return {
        horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
        mapWidth: mapRect?.width ?? 0,
        mapHeight: mapRect?.height ?? 0,
        canvasWidth: canvasRect?.width ?? 0,
        canvasHeight: canvasRect?.height ?? 0,
        recenterHit: Boolean(hit?.closest('[data-map-overlay-role="recenter"]')),
        hitTag: hit?.tagName ?? null,
        hitClass: hit?.getAttribute('class') ?? null,
        railRecenter: rail && recenter ? overlap(rail, recenter) : 0,
        railTop: rail?.top ?? null,
        headerBottom: header?.bottom ?? null,
        legendTimeline: legend && timeline ? overlap(legend, timeline) : 0,
        rankingsTimeline: rankings && timeline ? overlap(rankings, timeline) : 0,
      }
    })

    expect(geometry.horizontalOverflow, `${viewport.width}×${viewport.height}`).toBeLessThanOrEqual(0)
    expect(geometry.mapWidth).toBeGreaterThan(150)
    expect(geometry.mapHeight).toBeGreaterThan(150)
    expect(geometry.canvasWidth).toBeGreaterThanOrEqual(geometry.mapWidth - 1)
    expect(geometry.canvasHeight).toBeGreaterThanOrEqual(geometry.mapHeight - 1)
    expect(geometry.recenterHit, `${viewport.width}×${viewport.height}: ${JSON.stringify(geometry)}`).toBe(true)
    expect(geometry.railRecenter).toBe(0)
    if (viewport.width < 768 && geometry.railTop !== null && geometry.headerBottom !== null) {
      expect(geometry.railTop, `${viewport.width}×${viewport.height}`).toBeGreaterThanOrEqual(geometry.headerBottom + 7)
    }
    expect(geometry.legendTimeline).toBe(0)
    expect(geometry.rankingsTimeline).toBe(0)
  }
})

test.describe('coarse-pointer inspector ergonomics', () => {
  test.use({ hasTouch: true })

  test('uses a map-preserving bottom sheet with focus restoration and 44px hit targets', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await page.waitForSelector('.leaflet-container', { timeout: 30000 })
    const opener = page.getByRole('button', { name: 'Expand sidebar' })
    await opener.focus()
    await opener.click()
    const dialog = page.getByRole('dialog', { name: 'Dataset inspector' })
    await expect(dialog).toBeVisible()
    await expect(page.locator('.leaflet-container')).toBeVisible()
    await expect(dialog.getByLabel('Map-compatible datasets')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
    await opener.click()
    await expect(dialog).toBeVisible()
    await page.getByRole('button', { name: 'Dismiss dataset inspector' }).click({ position: { x: 8, y: 8 } })
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
    // Measure after the required tweened rail transition settles, rather than
    // reading a transient transformed rectangle during collapse.
    await page.waitForTimeout(450)
    const targets = await page.evaluate(() => ['[aria-label="Expand sidebar"]', '[aria-label="Random dataset"]', '[aria-label="Region shading"]', '[data-map-overlay-role="recenter"]'].map((selector) => {
      const element = document.querySelector<HTMLElement>(selector)
      const target = selector === '[aria-label="Region shading"]'
        ? element?.closest<HTMLElement>('.MuiSwitch-root') ?? element
        : element
      const rect = target?.getBoundingClientRect()
      return { selector, width: rect?.width ?? 0, height: rect?.height ?? 0 }
    }))
    for (const target of targets) {
      expect(target.width, target.selector).toBeGreaterThanOrEqual(44)
      expect(target.height, target.selector).toBeGreaterThanOrEqual(44)
    }
  })

  test('gives every visible inspector interaction a 44px coarse-pointer target', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await page.waitForSelector('.leaflet-container', { timeout: 30000 })
    await page.getByRole('button', { name: 'Expand sidebar' }).click()
    const dialog = page.getByRole('dialog', { name: 'Dataset inspector' })
    await page.getByRole('button', { name: 'Data lineage' }).click()
    await page.getByRole('button', { name: 'Layers' }).click()
    await page.getByRole('button', { name: 'Theme', exact: true }).click()

    const targets = await dialog.evaluate((sheet) => Array.from(sheet.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [role="combobox"], [role="radio"], [role="checkbox"], [role="switch"]',
    )).filter((element) => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return rect.width > 1 && rect.height > 1 && style.visibility !== 'hidden' && style.display !== 'none'
    }).map((element) => {
      // MUI Select's native input is a full-width accessibility proxy. Its
      // 44px InputBase is the actual tappable control, so measure that root.
      const target = element.classList.contains('MuiSelect-nativeInput')
        ? element.closest<HTMLElement>('.MuiInputBase-root') ?? element
        : element.classList.contains('MuiSwitch-input')
          ? element.closest<HTMLElement>('.MuiSwitch-root') ?? element
          : element
      const rect = target.getBoundingClientRect()
      return { name: element.getAttribute('aria-label') || element.textContent?.trim() || element.tagName, tag: element.tagName, role: element.getAttribute('role'), className: element.className, width: rect.width, height: rect.height }
    }))

    expect(targets.length).toBeGreaterThan(10)
    for (const target of targets) {
      expect(target.width, JSON.stringify(target)).toBeGreaterThanOrEqual(44)
      expect(target.height, JSON.stringify(target)).toBeGreaterThanOrEqual(44)
    }
  })

  test('keeps visible global and movable-panel actions thumb-sized', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 })
    await page.goto('/')
    await page.waitForSelector('.leaflet-container', { timeout: 30000 })

    const targets = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>(
      '[data-testid="command-surface"] button:not([disabled]), [data-testid="command-surface"] input[role="combobox"]:not([disabled]), .map-overlay-handle button:not([disabled])',
    )).filter((element) => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return rect.width > 1 && rect.height > 1 && style.visibility !== 'hidden' && style.display !== 'none'
    }).map((element) => {
      // The MUI autocomplete input fills its InputBase wrapper; measure the
      // actual pointer surface rather than its text-only native input.
      const target = element.matches('input[role="combobox"]')
        ? element.closest<HTMLElement>('.MuiInputBase-root') ?? element
        : element
      const rect = target.getBoundingClientRect()
      return { name: element.getAttribute('aria-label') || element.textContent?.trim(), width: rect.width, height: rect.height }
    }))

    expect(targets.length).toBeGreaterThan(1)
    for (const target of targets) {
      expect(target.width, JSON.stringify(target)).toBeGreaterThanOrEqual(44)
      expect(target.height, JSON.stringify(target)).toBeGreaterThanOrEqual(44)
    }
  })

  test('keeps the timeline scrubber thumb-sized', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openTimeMapDataset(page)

    const rect = await page.getByLabel('Timeline year scrubber').evaluate((slider) => (
      slider.closest<HTMLElement>('.MuiSlider-root') ?? slider
    ).getBoundingClientRect())
    expect(rect.width).toBeGreaterThanOrEqual(44)
    expect(rect.height).toBeGreaterThanOrEqual(44)
  })
})
