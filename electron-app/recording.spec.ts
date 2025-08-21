import { test, expect } from '@playwright/test';

test('Login flow example', async ({ page }) => {
  // Navigate to login page
  await page.goto('https://example.com/login');
  
  // Wait for page to load
  await page.waitForLoadState('domcontentloaded');
  
  // Enter username
  await page.locator('input[name="username"]').fill('{{USERNAME}}');
  
  // Enter password
  await page.locator('input[name="password"]').fill('{{PASSWORD}}');
  
  // Click login button
  await page.locator('button[type="submit"]').click();
  
  // Wait for navigation
  await page.waitForTimeout(2000);
  
  // Verify success
  await expect(page.locator('.welcome-message')).toBeVisible();
});