import { test, expect } from '@playwright/test';

/**
 * Mode Switching Tests
 * Verifies that mode buttons are present and clickable.
 */

test('mode buttons are present and clickable', async ({ page }) => {
  await page.goto('/index.html');

  const tbtBtn = page.locator('.mode-btn[data-mode="tabata"]');
  const emomBtn = page.locator('.mode-btn[data-mode="emom"]');

  await expect(tbtBtn).toBeVisible();
  await expect(emomBtn).toBeVisible();
  await expect(tbtBtn).toBeEnabled();
  await expect(emomBtn).toBeEnabled();
});

test('EMOM button is clickable and changes UI state', async ({ page }) => {
  await page.goto('/index.html');

  const emomBtn = page.locator('.mode-btn[data-mode="emom"]');
  await emomBtn.click();
  await page.waitForTimeout(100);

  const timer = page.locator('#clock');
  await expect(timer).toBeVisible();
});

test('EMOM mode UI changes', async ({ page }) => {
  await page.goto('/index.html');

  const emomBtn = page.locator('.mode-btn[data-mode="emom"]');
  await emomBtn.click();
  await expect(emomBtn).toHaveClass(/selected/);

  const restField = page.locator('.field:has(#rest)');
  await expect(restField).toBeHidden();

  await expect(page.locator('label[for="work"]')).toHaveText('Interval (sec)');
});

test('EMOM timer progression to round 2', async ({ page }) => {
  await page.goto('/index.html');
  await page.locator('.mode-btn[data-mode="emom"]').click();
  await page.locator('#work').fill('1');
  await page.locator('#rounds').fill('2');
  await page.locator('#btnStart').click();

  await page.locator('#btnSkip').click();
  await page.locator('#btnSkip').click();

  const rc = page.locator('#roundCounter');
  await expect(rc).toBeVisible();
  await expect(rc).toHaveText(/Round\s*2/);
  await expect(rc).toHaveCSS('color', 'rgb(239, 68, 68)');
});

test('Start button label resets to "Start" when switching modes', async ({ page }) => {
  await page.goto('/index.html');

  const btnStart = page.locator('#btnStart');
  const emomBtn = page.locator('.mode-btn[data-mode="emom"]');

  await expect(btnStart).toHaveText('Start');
  await btnStart.click();
  await page.waitForTimeout(100);
  await expect(btnStart).toHaveText('Running');

  await emomBtn.click();
  await page.waitForTimeout(100);
  await expect(btnStart).toHaveText('Start');
});
