import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { expect, test } from '@playwright/test';

test('catalog search, filters, malformed records, and partial state', async ({
  page,
}) => {
  await page.route('**/api/catalog?**', async (route) => {
    const url = new URL(route.request().url());
    const collection = url.searchParams.get('collection');
    if (collection === 'packs') {
      await route.fulfill({
        status: 502,
        json: { error: 'permission_denied' },
      });
      return;
    }
    if (url.searchParams.has('pageToken')) {
      await route.fulfill({
        json: {
          items: [
            {
              id: 'wind-loop',
              collection: 'tracks',
              fields: {
                name: 'Wind through pines',
                tags: ['nature'],
                fileName: 'pine-wind',
              },
              rawFields: { fileName: { stringValue: 'pine-wind' } },
              warnings: [],
            },
          ],
          nextPageToken: null,
          complete: true,
          scannedAt: '2026-11-01T12:01:00.000Z',
        },
      });
      return;
    }
    await route.fulfill({
      json: {
        items: [
          {
            id: 'rain-loop',
            collection: 'tracks',
            fields: {
              name: 'Rain on stone',
              tags: ['weather', 'cave'],
              source: { author: 'Mira Vale' },
              fileName: 'rain-stone',
              extraField: 'preserved',
            },
            rawFields: { extraField: { stringValue: 'preserved' } },
            warnings: [],
          },
          {
            id: 'broken-record',
            collection: 'tracks',
            fields: { tags: 'wrong-shape' },
            rawFields: { tags: { stringValue: 'wrong-shape' } },
            warnings: [
              'Name is missing or is not text.',
              'Tags must be a list of text values.',
            ],
          },
        ],
        nextPageToken: 'resume-tracks',
        complete: false,
        scannedAt: '2026-11-01T12:00:00.000Z',
      },
    });
  });

  await page.goto('/');
  await expect(page.getByText('Rain on stone')).toBeVisible();
  await expect(page.getByText('broken-record')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Could not load Packs');
  await expect(page.getByText(/showing an incomplete catalog/i)).toBeVisible();
  await page.getByRole('button', { name: 'Load more Sounds' }).click();
  await expect(page.getByText('Wind through pines')).toBeVisible();
  await expect(page.getByText(/showing an incomplete catalog/i)).toHaveCount(0);

  await page
    .getByRole('searchbox', { name: 'Search catalog' })
    .fill('rain-stone');
  await expect(page.getByText('Rain on stone')).toBeVisible();
  await expect(page.getByText('broken-record')).toHaveCount(0);

  await page.getByRole('searchbox', { name: 'Search catalog' }).clear();
  await page.getByLabel('Type').selectOption('loop');
  await page.getByLabel('Exact tag').selectOption('weather');
  await page.getByLabel('Author').selectOption('Mira Vale');
  await expect(page.getByText('Rain on stone')).toBeVisible();
  await expect(page.getByText('broken-record')).toHaveCount(0);

  const capture = resolve(process.cwd(), 'docs/evidence/catalog-browsing.png');
  await mkdir(dirname(capture), { recursive: true });
  await page.screenshot({ path: capture, fullPage: true });
});
