import { test, expect } from '@playwright/test'

const SMALL_VIEWPORT = { width: 627, height: 676 }

async function openTimeMapDataset(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.waitForSelector('.leaflet-container', { timeout: 30000 })

  await page.getByRole('combobox', { name: 'Search datasets' }).fill('Accommodations by District')
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
  await expect(page.getByRole('button', { name: 'Toggle region shading' })).toBeVisible()

  // Expanding the panel reveals the ranking rows.
  await page.getByRole('button', { name: 'Top Regions' }).click()
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
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Dataset inspector' })).toHaveCount(0)
})
