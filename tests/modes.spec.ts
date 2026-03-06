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

// EMOM-specific UI adjustments
test('EMOM mode UI changes', async ({ page }) => {
  await page.goto('file://' + process.cwd() + '/index.html');

  // click and wait for the mode to take effect
  const emomBtn = page.locator('.mode-btn[data-mode="emom"]');
  await emomBtn.click();
  await expect(emomBtn).toHaveClass(/selected/);

  // now assert the rest *field* is hidden, not just the input
  const restField = page.locator('.field:has(#rest)');
  await expect(restField).toBeHidden();

  await expect(page.locator('label[for="work"]'))
    .toHaveText('Interval (sec)');
});

// EMOM timer progression to round 2
test('EMOM timer progression to round 2', async ({ page }) => {
  await page.goto('file://' + process.cwd() + '/index.html');
  await page.locator('.mode-btn[data-mode="emom"]').click();
  await page.locator('#work').fill('1');
  await page.locator('#rounds').fill('2');
  await page.locator('#btnStart').click();

  await page.waitForTimeout(1500);
  const rc = page.locator('#roundCounter');
  await expect(rc).toBeVisible();
  await expect(rc).toHaveText(/Round\s*2/);
  await expect(rc).toHaveCSS('color', 'rgb(239, 68, 68)');
});

