import { test, expect } from '@playwright/test';

/**
 * Smoke Tests
 * Basic page-load sanity checks for the EMOM/Tabata timer app.
 */

test('app loads without error', async ({ page }) => {
  await page.goto('http://localhost:3000/index.html');

  // Check that the app element exists
  const appEl = page.locator('.app');
  await expect(appEl).toBeVisible();

  // Check that key controls are present
  const startButton = page.locator('#btnStart');
  await expect(startButton).toBeVisible();

  const timer = page.locator('#clock');
  await expect(timer).toBeVisible();

  // Verify we have exactly 2 mode buttons (Tabata and EMOM)
  const modeButtons = page.locator('.mode-btn');
  await expect(modeButtons).toHaveCount(2);
});
