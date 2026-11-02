import type { CatalogItem } from './catalog';
import type { TagReport } from './tagReport';

export type ItemType = 'loop' | 'one-shot' | 'pack' | 'unknown';

export function authorOf(item: CatalogItem): string {
  const source = item.fields.source;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return '';
  const author = (source as Record<string, unknown>).author;
  return typeof author === 'string' ? author : '';
}

export function tagsOf(item: CatalogItem): string[] {
  return Array.isArray(item.fields.tags)
    ? item.fields.tags.filter((tag): tag is string => typeof tag === 'string')
    : [];
}

export function itemType(item: CatalogItem): ItemType {
  if (item.collection === 'packs') return 'pack';
  const hasFileName = typeof item.fields.fileName === 'string';
  const hasSamples = Array.isArray(item.fields.samples);
  if (hasFileName && !hasSamples) return 'loop';
  if (hasSamples && !hasFileName) return 'one-shot';
  return 'unknown';
}

export interface FileResult {
  status: 'available' | 'missing' | 'inaccessible';
  checkedAt: string;
  playback?: 'ready' | 'decode-failed' | 'unavailable';
}

export interface Statistics {
  loops: number;
  oneShots: number;
  packs: number;
  unknownSounds: number;
  samples: number;
  authors: { name: string; count: number }[];
  tags: { name: string; count: number }[];
  dataProblems: number;
  exactTagRepeats: number;
  tagVariantGroups: number;
  referencedFiles: number;
  checkedFiles: number;
  missingFiles: number;
  inaccessibleFiles: number;
  decodeFailures: number;
  playbackUnavailable: number;
}

export function referencedFileNames(items: CatalogItem[]): string[] {
  return [
    ...new Set(
      items
        .filter((item) => item.collection === 'tracks')
        .flatMap((item) => {
          const stems = [
            item.fields.fileName,
            ...(Array.isArray(item.fields.samples) ? item.fields.samples : []),
          ].filter(
            (value): value is string =>
              typeof value === 'string' && Boolean(value.trim()),
          );
          return stems.flatMap((stem) => [`${stem}.mp3`, `${stem}.webm`]);
        }),
    ),
  ];
}

function breakdown(counts: Map<string, number>) {
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort(
      (left, right) =>
        right.count - left.count || left.name.localeCompare(right.name),
    );
}

export function buildStatistics(
  items: CatalogItem[],
  tagReport: TagReport,
  warningsForItem: (item: CatalogItem) => string[],
  fileChecks: Record<string, FileResult>,
): Statistics {
  const authors = new Map<string, number>();
  const tags = new Map<string, number>();
  const counts = { loops: 0, oneShots: 0, packs: 0, unknownSounds: 0 };
  let samples = 0;
  let dataProblems = 0;

  for (const item of items) {
    const type = itemType(item);
    if (type === 'loop') counts.loops++;
    if (type === 'one-shot') counts.oneShots++;
    if (type === 'pack') counts.packs++;
    if (type === 'unknown') counts.unknownSounds++;
    if (warningsForItem(item).length) dataProblems++;
    if (item.collection === 'tracks') {
      if (Array.isArray(item.fields.samples)) {
        samples += item.fields.samples.filter(
          (sample) => typeof sample === 'string' && Boolean(sample.trim()),
        ).length;
      }
      const author = authorOf(item);
      const name = author.trim() ? author : '(no author)';
      authors.set(name, (authors.get(name) ?? 0) + 1);
    }
    for (const tag of new Set(tagsOf(item)))
      tags.set(tag, (tags.get(tag) ?? 0) + 1);
  }

  const names = referencedFileNames(items);
  const checked = names
    .map((name) => fileChecks[name])
    .filter((check) => Boolean(check?.checkedAt));
  return {
    ...counts,
    samples,
    authors: breakdown(authors),
    tags: breakdown(tags),
    dataProblems,
    exactTagRepeats: tagReport.repeated.length,
    tagVariantGroups: tagReport.variants.length,
    referencedFiles: names.length,
    checkedFiles: checked.length,
    missingFiles: checked.filter((check) => check.status === 'missing').length,
    inaccessibleFiles: checked.filter(
      (check) => check.status === 'inaccessible',
    ).length,
    decodeFailures: names.filter(
      (name) => fileChecks[name]?.playback === 'decode-failed',
    ).length,
    playbackUnavailable: names.filter(
      (name) => fileChecks[name]?.playback === 'unavailable',
    ).length,
  };
}
