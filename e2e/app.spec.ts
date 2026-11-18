import { expect, test } from '@playwright/test';

test('visits the app root url', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/PAWNDER/);
  await expect(page.locator('body')).toContainText('PAWNDER');
});
