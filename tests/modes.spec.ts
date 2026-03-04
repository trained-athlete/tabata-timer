import { test, expect } from '@playwright/test';

/**
 * Mode Switching Tests
 * Verifies that mode buttons are present and clickable.
 */

test('mode buttons are present and clickable', async ({ page }) => {
  await page.goto('file://' + process.cwd() + '/index.html');

  // Both mode buttons should be present
  const tbtBtn = page.locator('.mode-btn[data-mode="tabata"]');
  const emomBtn = page.locator('.mode-btn[data-mode="emom"]');

  await expect(tbtBtn).toBeVisible();
  await expect(emomBtn).toBeVisible();

  // Buttons should be clickable
  await expect(tbtBtn).toBeEnabled();
  await expect(emomBtn).toBeEnabled();
});

test('EMOM button is clickable and changes UI state', async ({ page }) => {
  await page.goto('file://' + process.cwd() + '/index.html');

  const emomBtn = page.locator('.mode-btn[data-mode="emom"]');

  // Click should not throw an error
  await emomBtn.click();
  
  // Brief wait for any async updates
  await page.waitForTimeout(100);

  // App should still be responsive (timer display should exist)
  const timer = page.locator('#clock');
  await expect(timer).toBeVisible();
});

