const { test, expect } = require('@playwright/test');

test('default page loads and has timer header', async ({ page }) => {
    await page.goto('file://' + process.cwd() + '/index.html');
    const title = await page.title();
    expect(title).toMatch(/Timer/);
    const header = await page.locator('h1#appTitle');
    await expect(header).toHaveText(/Tabata/i);
});

test('mode buttons exist and selecting updates title', async ({ page }) => {
    await page.goto('file://' + process.cwd() + '/index.html');
    const modes = ['tabata', 'emom', 'fortime', 'amrap'];
    for (const m of modes) {
        const btn = page.locator(`.mode-btn[data-mode="${m}"]`);
        await expect(btn).toBeVisible();
        await btn.click();
        const header = page.locator('h1#appTitle');
        await expect(header).toHaveText(new RegExp(m, 'i'));
    }
});