import { describe, expect, it } from 'vitest';
import type { CatalogItem } from './catalog';
import { buildTagReport } from './tagReport';

function item(
  id: string,
  tags: unknown,
  collection: 'tracks' | 'packs' = 'tracks',
): CatalogItem {
  return { id, collection, fields: { tags }, rawFields: {}, warnings: [] };
}

describe('duplicate-tag report', () => {
  it('separates exact repeats from case and whitespace variants across Sounds and Packs', () => {
    const report = buildTagReport([
      item('rain', ['forest', 'forest', 'Wind Gust']),
      item('wind', ['forest', ' wind  gust ', 'WIND GUST']),
      item('pack', ['wind gust', 'forest'], 'packs'),
    ]);

    expect(report.repeated).toEqual([
      {
        tag: 'forest',
        item: expect.objectContaining({ id: 'rain' }),
        count: 2,
      },
    ]);
    expect(report.variants).toEqual([
      {
        spellings: [
          {
            tag: 'Wind Gust',
            entries: [
              { item: expect.objectContaining({ id: 'rain' }), count: 1 },
            ],
          },
          {
            tag: ' wind  gust ',
            entries: [
              { item: expect.objectContaining({ id: 'wind' }), count: 1 },
            ],
          },
          {
            tag: 'WIND GUST',
            entries: [
              { item: expect.objectContaining({ id: 'wind' }), count: 1 },
            ],
          },
          {
            tag: 'wind gust',
            entries: [
              { item: expect.objectContaining({ id: 'pack' }), count: 1 },
            ],
          },
        ],
      },
    ]);
  });

  it('keeps malformed tags visible elsewhere without treating them as variants', () => {
    expect(
      buildTagReport([
        item('bad-list', 'forest'),
        item('mixed', [null, '  ', '  ', 'forest']),
        item('ordinary', ['forest']),
      ]),
    ).toEqual({
      repeated: [
        { tag: '  ', item: expect.objectContaining({ id: 'mixed' }), count: 2 },
      ],
      variants: [],
    });
  });
});
