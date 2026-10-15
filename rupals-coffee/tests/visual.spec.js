// Visual regression for the scroll story, the shop sheet and the delivery scene.
// Motion is made deterministic by (a) waiting until the scrubbed timeline reaches the target time and
// (b) letting Playwright freeze CSS animations. Baselines are per platform; regenerate with `npm run test:visual:update`.
const { test, expect } = require('@playwright/test');

const STORY_STOPS = [0, 2.6, 4.6, 6.4, 9.5, 12.2, 15.6];

async function ready(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.Rupal && Rupal.story && Rupal.delivery);
  await page.evaluate(() => document.fonts.ready);
}

async function seekStory(page, t) {
  await page.evaluate((time) => {
    const { st, TOTAL } = Rupal.story;
    window.scrollTo(0, st.start + (st.end - st.start) * (time / TOTAL));
  }, t);
  await page.waitForFunction((time) => Math.abs(Rupal.story.tl.time() - time) < 0.03, t, { timeout: 8000 });
}

async function fillAndOrder(page) {
  await page.locator('header .buy').click();
  await page.locator('#productList .prow').first().waitFor();
  await page.fill('#f-name', 'Asha Rao');
  await page.fill('#f-phone', '+91 98765 43210');
  await page.fill('#f-address', '12 Lake Road, Pune 411001');
}

test.describe('story', () => {
  for (const t of STORY_STOPS) {
    test(`brew at t=${t}`, async ({ page }) => {
      await ready(page);
      await seekStory(page, t);
      await expect(page).toHaveScreenshot(`story-${String(t).replace('.', '_')}.png`);
    });
  }
});

test('shop sheet with the default cart', async ({ page }) => {
  await ready(page);
  await fillAndOrder(page);
  await expect(page.locator('#placeBtn')).toHaveText(/Place order/);
  await expect(page).toHaveScreenshot('shop-sheet.png');
});

test.describe('delivery scene', () => {
  test('order through the UI, then check the scene', async ({ page, request }) => {
    await ready(page);
    await fillAndOrder(page);
    await page.locator('#placeBtn').click();
    await page.locator('#delivery:not([hidden])').waitFor();

    for (const t of [3, 6.8]) {
      await page.evaluate((time) => Rupal.delivery.seek(time), t);
      await expect(page).toHaveScreenshot(`delivery-${String(t).replace('.', '_')}.png`);
    }
    await page.locator('#delSkip').click();
    await expect(page.locator('#delivery')).toHaveAttribute('data-state', 'done');
    await expect(page.locator('#delTitle')).toHaveText('Thank you, Asha!');
    await expect(page).toHaveScreenshot('delivery-done.png', { mask: [page.locator('#delMsg')] });

    // The order really exists on the server, and the public lookup hides the address.
    const id = (await page.locator('#delMsg').textContent()).match(/RC-[A-Z0-9]{8}/)[0];
    const res = await request.get(`/api/orders/${id}`);
    expect(res.status()).toBe(200);
    expect(JSON.stringify(await res.json())).not.toContain('Lake Road');

    await page.locator('#delDone').click();
    await expect(page.locator('#delivery')).toBeHidden();
  });
});
