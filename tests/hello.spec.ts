import { test, expect } from '@playwright/test';

test('hello world', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page).toHaveTitle("Trained athlete's Tabata and EMOM Timer");
});
