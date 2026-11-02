import type { CatalogItem } from './catalog';

export interface TagOccurrence {
  item: CatalogItem;
  count: number;
}

export interface RepeatedTag {
  tag: string;
  item: CatalogItem;
  count: number;
}

export interface TagVariant {
  spellings: { tag: string; entries: TagOccurrence[] }[];
}

export interface TagReport {
  repeated: RepeatedTag[];
  variants: TagVariant[];
}

export function buildTagReport(items: CatalogItem[]): TagReport {
  const repeated: RepeatedTag[] = [];
  const variants = new Map<string, Map<string, TagOccurrence[]>>();

  for (const item of items) {
    if (!Array.isArray(item.fields.tags)) continue;
    const counts = new Map<string, number>();
    for (const tag of item.fields.tags) {
      if (typeof tag !== 'string') continue;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    for (const [tag, count] of counts) {
      if (count > 1) repeated.push({ tag, item, count });
      const normalized = tag.trim().replace(/\s+/gu, ' ').toLocaleLowerCase();
      if (!normalized) continue;
      let spellings = variants.get(normalized);
      if (!spellings) {
        spellings = new Map();
        variants.set(normalized, spellings);
      }
      const entries = spellings.get(tag) ?? [];
      entries.push({ item, count });
      spellings.set(tag, entries);
    }
  }

  return {
    repeated,
    variants: [...variants.values()]
      .filter((spellings) => spellings.size > 1)
      .map((spellings) => ({
        spellings: [...spellings].map(([tag, entries]) => ({ tag, entries })),
      })),
  };
}
