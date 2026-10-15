// User flows from the acceptance criteria, against the real API (the FastAPI sample on PostgreSQL).
import { expect, test } from '@playwright/test';

const email = (tag: string) => `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

test('a new user appears in the list (Arabic by default, right-to-left)', async ({ page }) => {
  await page.goto('/users');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.getByLabel('اللغة').selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await page.getByRole('link', { name: 'New user' }).click();
  const address = email('e2e');
  await page.getByLabel('Email').fill(address);
  await page.getByLabel('Name').fill('Playwright User');
  await page.getByRole('button', { name: 'Create user' }).click();
  await expect(page).toHaveURL(/\/users$/);
  await expect(page.getByText(address)).toBeVisible();
});

test('a taken email is shown on the email field', async ({ page, request }) => {
  const address = email('taken');
  expect((await request.post('/v1/users', { data: { email: address, displayName: 'First' } })).status()).toBe(201);
  await page.goto('/users/new');
  await page.getByLabel('اللغة').selectOption('en');
  await page.getByLabel('Email').fill(address);
  await page.getByLabel('Name').fill('Second');
  await page.getByRole('button', { name: 'Create user' }).click();
  await expect(page.getByText('This email is already used')).toBeVisible();
});
