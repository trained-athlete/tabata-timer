const { test, expect } = require('@playwright/test');

// verify EMOM mode can be selected and app doesn't crash

test('EMOM mode loads without error', async ({ page }) => {
  await page.goto('file://' + process.cwd() + '/index.html');
  
  // verify default mode is Tabata
  const appTitle = page.locator('h1#appTitle');
  await expect(appTitle).toContainText('Tabata Timer');
  
  // click EMOM button - should not crash
  await page.click('.mode-btn[data-mode="emom"]');
  
  // app title should update to EMOM Timer
  await expect(appTitle).toContainText('EMOM Timer');
});

test('EMOM mode has required controls', async ({ page }) => {
  await page.goto('file://' + process.cwd() + '/index.html');
  await page.click('.mode-btn[data-mode="emom"]');
  
  // verify key EMOM inputs exist and are visible
  const workInput = page.locator('#work');
  const roundsInput = page.locator('#rounds');
  const startButton = page.locator('#btnStart');
  
  await expect(workInput).toBeVisible();
  await expect(roundsInput).toBeVisible();
  await expect(startButton).toBeVisible();
});