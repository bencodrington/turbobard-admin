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

test('Sound and Pack detail supports references and individual One-shot playback', async ({
  page,
}) => {
  await page.route('**/api/catalog?**', async (route) => {
    const collection = new URL(route.request().url()).searchParams.get(
      'collection',
    );
    const item =
      collection === 'tracks'
        ? {
            id: 'owl-call',
            collection: 'tracks',
            fields: {
              name: 'Owl call',
              tags: ['forest'],
              source: { author: 'Field Notes' },
              samples: ['owl-a', 'owl-b'],
              minSecondsBetween: 5,
              maxSecondsBetween: 9,
              extra: 'kept',
            },
            rawFields: {},
            warnings: [],
          }
        : {
            id: 'night-pack',
            collection: 'packs',
            fields: {
              name: 'Night sounds',
              tags: ['night'],
              tracks: [{ id: 'owl-call', volume: 0.6 }],
            },
            rawFields: {},
            warnings: [],
          };
    await route.fulfill({
      json: {
        items: [item],
        nextPageToken: null,
        complete: true,
        scannedAt: '2026-11-02T12:00:00.000Z',
      },
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Owl call' }).click();
  const detail = page.getByRole('dialog');
  await expect(
    detail.locator('.metadata-grid').getByText('Field Notes'),
  ).toBeVisible();
  await expect(detail.getByText('Variation 1: owl-a')).toBeVisible();
  await expect(detail.locator('audio')).toHaveCount(4);
  await expect(detail.getByText(/"extra": "kept"/)).toBeVisible();
  const capture = resolve(
    process.cwd(),
    'docs/evidence/sound-pack-inspection.png',
  );
  await mkdir(dirname(capture), { recursive: true });
  await detail.screenshot({ path: capture });
  await detail.getByRole('button', { name: /Night sounds/ }).click();
  await expect(page.getByRole('dialog')).toContainText('Sounds in this Pack');
  await expect(page.getByRole('dialog').locator('audio')).toHaveCount(4);
});

test('referenced-file health shows partial coverage and a per-file decode failure', async ({
  page,
}) => {
  await page.route('**/api/catalog?**', async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.has('pageToken')) {
      await route.fulfill({ status: 504, json: { error: 'upstream_timeout' } });
      return;
    }
    await route.fulfill({
      json: {
        items:
          url.searchParams.get('collection') === 'tracks'
            ? [
                {
                  id: 'rain',
                  collection: 'tracks',
                  fields: { name: 'Rain', tags: [], fileName: 'rain' },
                  rawFields: {},
                  warnings: [],
                },
                {
                  id: 'broken',
                  collection: 'tracks',
                  fields: { name: 'Broken', samples: [null] },
                  rawFields: {},
                  warnings: ['Samples must be a list of text values.'],
                },
              ]
            : [],
        nextPageToken:
          url.searchParams.get('collection') === 'tracks' ? 'more' : null,
        complete: url.searchParams.get('collection') !== 'tracks',
        scannedAt: '2026-11-02T12:00:00Z',
      },
    });
  });
  await page.route('**/api/file?**', async (route) => {
    const name = new URL(route.request().url()).searchParams.get('name');
    await route.fulfill({
      json: {
        name,
        status: name === 'rain.webm' ? 'missing' : 'available',
        checkedAt: '2026-11-02T12:30:00Z',
        size: '123',
      },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Check referenced files' }).click();
  await expect(
    page.getByText(/2 of 2 file checks complete.*catalog scan incomplete/i),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Rain' }).click();
  const detail = page.getByRole('dialog');
  await expect(detail.getByText(/rain\.webm.*Missing/i)).toBeVisible();
  await detail.locator('audio[aria-label="rain MP3"]').evaluate((audio) => {
    Object.defineProperty(audio, 'error', {
      configurable: true,
      value: { code: 3 },
    });
    audio.dispatchEvent(new Event('error'));
  });
  await expect(detail.getByText(/rain\.mp3.*Decode failed/i)).toBeVisible();
  const capture = resolve(
    process.cwd(),
    'docs/evidence/referenced-file-health.png',
  );
  await mkdir(dirname(capture), { recursive: true });
  await page.screenshot({ path: capture, fullPage: true });
});
