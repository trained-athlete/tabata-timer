const { test, expect } = require('@playwright/test');

// verify EMOM mode UI adjustments and input constraints

test('EMOM mode labels and constraints update correctly', async ({ page }) => {
  await page.goto('file://' + process.cwd() + '/index.html');
  // click EMOM button
  await page.click('.mode-btn[data-mode="emom"]');
  // EMOM hides the regular rest field (it becomes irrelevant)
  const restField = page.locator('.field[data-modes="tabata"]');
  await expect(restField).toBeHidden();

  // work and rounds labels update appropriately
  const roundsLabel = await page.textContent('label[for="rounds"]');
  expect(roundsLabel).toContain('Minutes');

  // check rounds input constraints only
  const roundsInput = await page.$('#rounds');
  expect(await roundsInput.getAttribute('min')).toBe('10');
  expect(await roundsInput.getAttribute('max')).toBe('60');
});