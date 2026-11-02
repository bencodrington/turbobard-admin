import { describe, expect, it } from 'vitest';
import type { CatalogItem } from './catalog';
import { buildStatistics, referencedFileNames } from './statistics';
import { buildTagReport } from './tagReport';

function item(
  id: string,
  collection: 'tracks' | 'packs',
  fields: Record<string, unknown>,
  warnings: string[] = [],
): CatalogItem {
  return { id, collection, fields, rawFields: {}, warnings };
}

describe('catalog statistics', () => {
  it('counts loaded entries, valid samples, exact tags, and problems without losing malformed Sounds', () => {
    const items = [
      item('rain', 'tracks', {
        fileName: 'rain',
        tags: ['Storm', 'Storm'],
        source: { author: 'Mira' },
      }),
      item(
        'horn',
        'tracks',
        {
          samples: ['horn-a', '', null, 'horn-b'],
          tags: [' storm ', 'battle'],
          source: { author: 'Mira' },
        },
        ['Invalid sample'],
      ),
      item('broken', 'tracks', { fileName: 42, tags: 'bad' }, [
        'Invalid filename',
      ]),
      item('weather', 'packs', { tracks: [], tags: ['Storm'] }),
    ];
    const report = buildTagReport(items);
    const statistics = buildStatistics(
      items,
      report,
      (entry) => entry.warnings,
      {
        'rain.mp3': { status: 'missing', checkedAt: '2026-11-02T12:00:00Z' },
        'rain.webm': {
          status: 'available',
          checkedAt: '2026-11-02T12:00:00Z',
          playback: 'decode-failed',
        },
        'horn-a.mp3': {
          status: 'inaccessible',
          checkedAt: '2026-11-02T12:00:00Z',
        },
        'obsolete.mp3': {
          status: 'missing',
          checkedAt: '2026-11-02T12:00:00Z',
        },
      },
    );

    expect(statistics).toMatchObject({
      loops: 1,
      oneShots: 1,
      packs: 1,
      unknownSounds: 1,
      samples: 2,
      authors: [
        { name: 'Mira', count: 2 },
        { name: '(no author)', count: 1 },
      ],
      tags: [
        { name: 'Storm', count: 2 },
        { name: ' storm ', count: 1 },
        { name: 'battle', count: 1 },
      ],
      dataProblems: 2,
      exactTagRepeats: 1,
      tagVariantGroups: 1,
      referencedFiles: 6,
      checkedFiles: 3,
      missingFiles: 1,
      inaccessibleFiles: 1,
      decodeFailures: 1,
    });
    expect(referencedFileNames(items)).toEqual([
      'rain.mp3',
      'rain.webm',
      'horn-a.mp3',
      'horn-a.webm',
      'horn-b.mp3',
      'horn-b.webm',
    ]);
  });
});
