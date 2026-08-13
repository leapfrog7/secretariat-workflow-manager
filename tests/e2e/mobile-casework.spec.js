import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.__unexpectedErrors = errors;
  await page.goto('/#/issues', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Issues', exact: true })).toBeVisible();
});

test.afterEach(async ({ page }) => {
  expect(page.__unexpectedErrors, `Browser errors: ${page.__unexpectedErrors?.join('\n')}`).toEqual([]);
});

test('mobile shell fits the viewport and exposes primary navigation', async ({ page }) => {
  expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
  const navigation = page.getByRole('navigation', { name: 'Mobile navigation' });
  await expect(navigation).toBeVisible();
  for (const label of ['Issues', 'Casework', 'Create', 'Reports']) {
    await expect(navigation.getByText(label, { exact: true })).toBeVisible();
  }
});

test('Create action opens a usable mobile Issue form', async ({ page }) => {
  await page.getByRole('link', { name: 'Create' }).click();
  await expect(page.getByRole('heading', { name: 'Create Issue', level: 1 })).toBeVisible();
  await expect(page.getByLabel('Title')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create Issue' })).toBeVisible();
  await expect(page.getByLabel('Title')).toHaveCSS('font-size', '16px');
});

test('Casework source and paste sheets remain inside the viewport', async ({ page }) => {
  await page.goto('/#/issues/new');
  await page.getByLabel('Title').fill(`Mobile source test ${Date.now()}`);
  await page.getByRole('button', { name: 'Create Issue' }).click();
  await expect(page.getByRole('link', { name: 'Open Casework' })).toBeVisible();
  await page.getByRole('link', { name: 'Open Casework' }).click();

  await page.getByRole('button', { name: 'Add note' }).click();
  await page.getByRole('button', { name: 'Add source' }).click();
  const sourceDialog = page.getByRole('dialog', { name: 'Add source' });
  await expect(sourceDialog).toBeVisible();
  await expect(sourceDialog.getByText('Choose a file')).toBeVisible();
  await expect(sourceDialog.getByText('Paste text', { exact: true })).toBeVisible();
  await expect(sourceDialog.getByText('Use Issue records')).toBeVisible();
  await expectDialogInsideViewport(page, sourceDialog);

  await sourceDialog.getByRole('button', { name: /Paste text/ }).click();
  const pasteDialog = page.getByRole('dialog', { name: 'Paste source text' });
  await expect(pasteDialog).toBeVisible();
  await expectDialogInsideViewport(page, pasteDialog);
  await pasteDialog.getByLabel('Source text').fill('Finance Division has requested comments within seven days.');
  await expect(pasteDialog.getByRole('button', { name: 'Use this text' })).toBeEnabled();
});

test('Reference Library opens from mobile navigation and accepts retained text', async ({ page }) => {
  await page.getByRole('button', { name: 'More navigation' }).click();
  await page.getByRole('menuitem', { name: 'Reference Library' }).click();
  await expect(page.getByRole('heading', { name: 'Reference Library', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Create reference' }).click();
  await page.getByLabel('Title').fill('Mobile reference test');
  await page.getByLabel('Retained relevant text').fill('Rule 12 applies to the present case.');
  await expect(page.getByRole('button', { name: 'Save reference' })).toBeVisible();
  expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
});

async function expectDialogInsideViewport(page, dialog) {
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}
