const { test, expect } = require('@playwright/test');

test('default page loads and has timer header', async ({ page }) => {
    await page.goto('file://' + process.cwd() + '/index.html');
    const title = await page.title();
    expect(title).toMatch(/Timer/);
    const header = await page.locator('h1#appTitle');
    await expect(header).toHaveText(/Tabata/i);
    // only Tabata and EMOM modes remain
    await expect(page.locator('.mode-btn')).toHaveCount(2);
});

