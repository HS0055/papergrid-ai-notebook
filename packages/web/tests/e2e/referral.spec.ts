// Playwright e2e spec for the user-referral program.
//
// Status: DORMANT — Playwright is not installed in this repo yet.
// To run:
//   1. cd packages/web
//   2. npm i -D @playwright/test
//   3. npx playwright install chromium
//   4. Create a playwright.config.ts pointing `testDir` to this folder
//      and `baseURL` to your dev server (e.g. http://localhost:3000)
//   5. Start `npm run dev` and `npx convex dev` in separate terminals
//   6. npx playwright test tests/e2e/referral.spec.ts
//
// The test hits the real landing page + Convex HTTP routes. It needs a
// fresh browser context per case so localStorage is isolated.
//
// ⚠️ This spec intentionally lives outside the default Vite include
// globs so `tsc --noEmit` doesn't try to type-check it without
// `@playwright/test` installed. Add `tests/e2e` to tsconfig `exclude`
// if you see type errors before installing Playwright.

// @ts-expect-error — @playwright/test not installed yet
import { test, expect } from '@playwright/test';

const VALID_CODE_PLACEHOLDER = 'seedcode01'; // replace with a real seeded referral code in your test DB
const INVALID_CODE = 'thiscodeisnotreal';

test.describe('Referral capture + banner', () => {
  test('valid ?ref= persists to localStorage and renders the banner', async ({ page }) => {
    // Intercept the lookup so the test is hermetic — don't require a
    // live Convex deployment with a pre-seeded code.
    await page.route('**/api/referral/lookup*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          valid: true,
          rewards: { referrer: 25, referred: 25 },
        }),
      }),
    );
    await page.route('**/api/referral/track-click', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      }),
    );

    await page.goto(`/?ref=${VALID_CODE_PLACEHOLDER}`);

    // URL is cleaned immediately.
    await expect(page).toHaveURL('/');

    // Code landed in localStorage.
    const stored = await page.evaluate(() =>
      localStorage.getItem('papergrid_referral_ref'),
    );
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored as string);
    expect(parsed.code).toBe(VALID_CODE_PLACEHOLDER);
    expect(typeof parsed.capturedAt).toBe('number');

    // Click dedup TTL key is set.
    const clickTtl = await page.evaluate(() =>
      localStorage.getItem('papergrid_referral_click_ttl'),
    );
    expect(clickTtl).toBeTruthy();

    // Banner renders with the reward copy.
    await expect(
      page.getByRole('banner', { name: /referral bonus/i }),
    ).toBeVisible();
    await expect(page.getByText(/claim 25 free Ink/i)).toBeVisible();
  });

  test('invalid ?ref= does NOT persist and does NOT render the banner', async ({
    page,
  }) => {
    await page.route('**/api/referral/lookup*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ valid: false, reason: 'not_found' }),
      }),
    );
    const clickCalls: string[] = [];
    await page.route('**/api/referral/track-click', (route) => {
      clickCalls.push(route.request().url());
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto(`/?ref=${INVALID_CODE}`);
    await expect(page).toHaveURL('/');

    const stored = await page.evaluate(() =>
      localStorage.getItem('papergrid_referral_ref'),
    );
    expect(stored).toBeNull();

    // No click should have been fired for an invalid code.
    expect(clickCalls).toHaveLength(0);

    // Banner should not exist at all.
    await expect(
      page.getByRole('banner', { name: /referral bonus/i }),
    ).toHaveCount(0);
  });

  test('click dedup — reload within 24h does not fire a second track-click', async ({
    page,
  }) => {
    let clickCount = 0;
    await page.route('**/api/referral/lookup*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          valid: true,
          rewards: { referrer: 25, referred: 25 },
        }),
      }),
    );
    await page.route('**/api/referral/track-click', (route) => {
      clickCount += 1;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto(`/?ref=${VALID_CODE_PLACEHOLDER}`);
    await expect(
      page.getByRole('banner', { name: /referral bonus/i }),
    ).toBeVisible();
    expect(clickCount).toBe(1);

    await page.reload();
    await page.reload();
    await page.reload();

    // Dedup keeps us at 1 despite three reloads.
    expect(clickCount).toBe(1);
  });

  test('banner dismissal persists across navigation in the same tab', async ({
    page,
  }) => {
    await page.route('**/api/referral/lookup*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          valid: true,
          rewards: { referrer: 25, referred: 25 },
        }),
      }),
    );
    await page.route('**/api/referral/track-click', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      }),
    );

    await page.goto(`/?ref=${VALID_CODE_PLACEHOLDER}`);
    const banner = page.getByRole('banner', { name: /referral bonus/i });
    await expect(banner).toBeVisible();

    await page.getByRole('button', { name: /dismiss banner/i }).click();
    await expect(banner).toHaveCount(0);

    // Reload in same tab → sessionStorage keeps dismissal
    await page.reload();
    await expect(banner).toHaveCount(0);
  });
});
