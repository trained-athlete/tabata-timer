import { test, expect } from '@playwright/test';

/**
 * Mode Switching Tests
 * Verifies that mode buttons are present and clickable.
 */

test('mode buttons are present and clickable', async ({ page }) => {
  await page.goto('http://localhost:3000/index.html');

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
  await page.goto('http://localhost:3000/index.html');

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
  await page.goto('http://localhost:3000/index.html');

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
  await page.goto('http://localhost:3000/index.html');
  await page.locator('.mode-btn[data-mode="emom"]').click();
  // Note: prep field is hidden in EMOM mode, so we don't set it
  await page.locator('#work').fill('1');
  await page.locator('#rounds').fill('2');
  await page.locator('#btnStart').click();

  // Wait for Prepare (10s default) + Round 1 work (1s) + transition buffer
  await page.waitForTimeout(12000);
  const rc = page.locator('#roundCounter');
  await expect(rc).toBeVisible();
  await expect(rc).toHaveText(/Round\s*2/);
  await expect(rc).toHaveCSS('color', 'rgb(239, 68, 68)');
});
// Button label resets when switching modes while timer is running
test('Start button label resets to "Start" when switching modes', async ({ page }) => {
  await page.goto('http://localhost:3000/index.html');

  const btnStart = page.locator('#btnStart');
  const emomBtn = page.locator('.mode-btn[data-mode="emom"]');

  // Initial state: button should show "Start"
  await expect(btnStart).toHaveText('▶ Start');

  // Click Start button (TABATA mode)
  await btnStart.click();
  
  // Brief wait for state update
  await page.waitForTimeout(100);

  // Button should now show "Running"
  await expect(btnStart).toHaveText('Running');

  // Switch to EMOM mode
  await emomBtn.click();

  // Brief wait for mode switch and reset
  await page.waitForTimeout(100);

  // Button should reset back to "▶ Start"
  await expect(btnStart).toHaveText('▶ Start');
});
