// The first user flow: the app opens in Arabic, right-to-left, and switches to English.
import { expect, test } from '@playwright/test';

test('the app opens in Arabic, right-to-left, and switches to English', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 2, name: 'مرحبًا' })).toBeVisible();
  await page.getByLabel('اللغة').selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('heading', { level: 2, name: 'Welcome' })).toBeVisible();
});
