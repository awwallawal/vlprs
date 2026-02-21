import { test, expect } from '@playwright/test';
import { TEST_USERS } from './setup/globalSetup';

test.describe('Authentication flows', () => {
  test('unauthenticated user visiting /dashboard is redirected to /login', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('super_admin logs in and lands on /dashboard', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/email/i).fill(TEST_USERS.super_admin.email);
    await page.getByLabel(/password/i).fill(TEST_USERS.super_admin.password);
    await page.getByRole('button', { name: /login/i }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
    await expect(
      page.getByRole('heading', { name: /executive dashboard/i })
    ).toBeVisible();
    await expect(page.getByText(/super admin/i)).toBeVisible();
  });

  test('dept_admin logs in and lands on /operations', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/email/i).fill(TEST_USERS.dept_admin.email);
    await page.getByLabel(/password/i).fill(TEST_USERS.dept_admin.password);
    await page.getByRole('button', { name: /login/i }).click();

    await expect(page).toHaveURL(/\/operations/, { timeout: 10_000 });
    await expect(
      page.getByRole('heading', { name: /operations hub/i })
    ).toBeVisible();
    await expect(page.getByText(/department admin/i)).toBeVisible();
  });

  test('mda_officer logs in and lands on /submissions', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/email/i).fill(TEST_USERS.mda_officer.email);
    await page.getByLabel(/password/i).fill(TEST_USERS.mda_officer.password);
    await page.getByRole('button', { name: /login/i }).click();

    await expect(page).toHaveURL(/\/submissions/, { timeout: 10_000 });
    await expect(
      page.getByRole('heading', { name: /monthly submissions/i })
    ).toBeVisible();
    await expect(page.getByText(/mda officer/i)).toBeVisible();
  });

  test('authenticated user logs out and is redirected to /login', async ({
    page,
  }) => {
    // Login first
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(TEST_USERS.super_admin.email);
    await page.getByLabel(/password/i).fill(TEST_USERS.super_admin.password);
    await page.getByRole('button', { name: /login/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    // Click logout
    await page.getByRole('button', { name: /logout/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

    // Verify protected route is inaccessible
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
