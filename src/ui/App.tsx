import { useEffect, useMemo, useState } from 'react';
import type { CatalogCollection, CatalogItem } from '../catalog';

interface CatalogPage {
  items: CatalogItem[];
  nextPageToken: string | null;
  complete: boolean;
  scannedAt: string;
}

interface CollectionState {
  items: CatalogItem[];
  nextPageToken: string | null;
  complete: boolean;
  loading: boolean;
  error: string | null;
  scannedAt: string | null;
}

type ItemType = 'loop' | 'one-shot' | 'pack' | 'unknown';

const emptyCollection = (): CollectionState => ({
  items: [],
  nextPageToken: null,
  complete: false,
  loading: true,
  error: null,
  scannedAt: null,
});

function itemType(item: CatalogItem): ItemType {
  if (item.collection === 'packs') return 'pack';
  const hasFileName = typeof item.fields.fileName === 'string';
  const hasSamples = Array.isArray(item.fields.samples);
  if (hasFileName && !hasSamples) return 'loop';
  if (hasSamples && !hasFileName) return 'one-shot';
  return 'unknown';
}

function authorOf(item: CatalogItem): string {
  const source = item.fields.source;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return '';
  const author = (source as Record<string, unknown>).author;
  return typeof author === 'string' ? author : '';
}

function tagsOf(item: CatalogItem): string[] {
  return Array.isArray(item.fields.tags)
    ? item.fields.tags.filter((tag): tag is string => typeof tag === 'string')
    : [];
}

function searchableText(item: CatalogItem): string {
  const fields = item.fields;
  return [
    fields.name,
    item.id,
    authorOf(item),
    ...tagsOf(item),
    fields.fileName,
    ...(Array.isArray(fields.samples) ? fields.samples : []),
  ]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLocaleLowerCase();
}

function titleOf(item: CatalogItem): string {
  return typeof item.fields.name === 'string' && item.fields.name.trim()
    ? item.fields.name
    : '(unnamed entry)';
}

function typeLabel(type: ItemType): string {
  if (type === 'one-shot') return 'One-shot';
  if (type === 'unknown') return 'Sound · unknown type';
  return type === 'loop' ? 'Loop' : 'Pack';
}

async function loadCollectionPage(
  collection: CatalogCollection,
  pageToken?: string | null,
): Promise<CatalogPage> {
  const url = new URL('/api/catalog', window.location.origin);
  url.searchParams.set('collection', collection);
  if (pageToken) url.searchParams.set('pageToken', pageToken);
  const response = await fetch(url);
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(body.error ?? `HTTP ${response.status}`);
  }
  return (await response.json()) as CatalogPage;
}

export default function App() {
  const [collections, setCollections] = useState<
    Record<CatalogCollection, CollectionState>
  >({
    tracks: emptyCollection(),
    packs: emptyCollection(),
  });
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [tag, setTag] = useState('');
  const [author, setAuthor] = useState('');
  const [problemFilter, setProblemFilter] = useState('all');

  async function loadCollection(collection: CatalogCollection, resume = false) {
    const current = collections[collection];
    setCollections((previous) => ({
      ...previous,
      [collection]: { ...previous[collection], loading: true, error: null },
    }));
    try {
      const page = await loadCollectionPage(
        collection,
        resume ? current.nextPageToken : null,
      );
      setCollections((previous) => ({
        ...previous,
        [collection]: {
          ...previous[collection],
          items: resume
            ? [...previous[collection].items, ...page.items]
            : page.items,
          nextPageToken: page.nextPageToken,
          complete: page.complete,
          loading: false,
          error: null,
          scannedAt: page.scannedAt,
        },
      }));
    } catch (error) {
      setCollections((previous) => ({
        ...previous,
        [collection]: {
          ...previous[collection],
          loading: false,
          error: error instanceof Error ? error.message : 'request_failed',
        },
      }));
    }
  }

  useEffect(() => {
    void loadCollection('tracks');
    void loadCollection('packs');
  }, []);

  const allItems = useMemo(
    () => [...collections.tracks.items, ...collections.packs.items],
    [collections],
  );
  const tags = useMemo(
    () =>
      [...new Set(allItems.flatMap(tagsOf))].sort((left, right) =>
        left.localeCompare(right),
      ),
    [allItems],
  );
  const authors = useMemo(
    () =>
      [...new Set(allItems.map(authorOf).filter(Boolean))].sort((left, right) =>
        left.localeCompare(right),
      ),
    [allItems],
  );
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleItems = allItems.filter((item) => {
    const matchesSearch =
      !normalizedSearch || searchableText(item).includes(normalizedSearch);
    const matchesType = type === 'all' || itemType(item) === type;
    const matchesTag = !tag || tagsOf(item).includes(tag);
    const matchesAuthor = !author || authorOf(item) === author;
    const hasProblems = item.warnings.length > 0;
    const matchesProblems =
      problemFilter === 'all' ||
      (problemFilter === 'problems' && hasProblems) ||
      (problemFilter === 'clear' && !hasProblems);
    return (
      matchesSearch &&
      matchesType &&
      matchesTag &&
      matchesAuthor &&
      matchesProblems
    );
  });
  const loading = collections.tracks.loading || collections.packs.loading;
  const hasErrors = Boolean(
    collections.tracks.error || collections.packs.error,
  );
  const isIncomplete = Object.values(collections).some(
    (collection) =>
      !collection.complete &&
      Boolean(collection.scannedAt) &&
      !collection.error,
  );

  return (
    <main className="admin-shell catalog-shell">
      <header className="admin-header">
        <p className="eyebrow">Turbobard</p>
        <h1>Admin</h1>
        <span className="read-only-mark">Read only</span>
      </header>

      <section className="catalog-heading" aria-labelledby="catalog-title">
        <div>
          <p className="eyebrow">Sound catalog</p>
          <h2 id="catalog-title">Catalog browser</h2>
          <p>
            Search and inspect Sound and Pack records from the authoritative
            catalog.
          </p>
        </div>
        <div className="catalog-count" aria-live="polite">
          <strong>{visibleItems.length}</strong>
          <span>visible entries</span>
        </div>
      </section>

      {hasErrors && (
        <div className="load-error" role="alert">
          <strong>Some catalog data could not be loaded.</strong>
          {(['tracks', 'packs'] as const).map((collection) =>
            collections[collection].error ? (
              <p key={collection}>
                Could not load {collection === 'tracks' ? 'Sounds' : 'Packs'}:{' '}
                {collections[collection].error}{' '}
                <button
                  type="button"
                  onClick={() => void loadCollection(collection)}
                >
                  Retry
                </button>
              </p>
            ) : null,
          )}
        </div>
      )}
      {isIncomplete && (
        <div className="load-notice" role="status">
          Showing an incomplete catalog. Continue loading to reach the end of
          the catalog.
        </div>
      )}
      {loading && (
        <p className="loading-state" role="status">
          Loading Sounds and Packs…
        </p>
      )}

      <section className="catalog-controls" aria-label="Catalog filters">
        <label className="search-control">
          <span>Search name, tags, author, ID, or filename</span>
          <input
            type="search"
            aria-label="Search catalog"
            placeholder="Try a Sound name, tag, author, ID, or filename"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label>
          <span>Type</span>
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="all">All types</option>
            <option value="loop">Loop</option>
            <option value="one-shot">One-shot</option>
            <option value="pack">Pack</option>
            <option value="unknown">Unknown Sound type</option>
          </select>
        </label>
        <label>
          <span>Exact tag</span>
          <select value={tag} onChange={(event) => setTag(event.target.value)}>
            <option value="">All tags</option>
            {tags.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Author</span>
          <select
            value={author}
            onChange={(event) => setAuthor(event.target.value)}
          >
            <option value="">All authors</option>
            {authors.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Problems</span>
          <select
            value={problemFilter}
            onChange={(event) => setProblemFilter(event.target.value)}
          >
            <option value="all">All entries</option>
            <option value="problems">Has problems</option>
            <option value="clear">No detected problems</option>
          </select>
        </label>
      </section>

      <section className="catalog-table-wrap" aria-label="Catalog entries">
        <table>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Type</th>
              <th scope="col">ID</th>
              <th scope="col">Author</th>
              <th scope="col">Tags</th>
              <th scope="col">Data</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item) => {
              const kind = itemType(item);
              return (
                <tr key={`${item.collection}/${item.id}`}>
                  <td>
                    <strong>{titleOf(item)}</strong>
                    {item.warnings.length > 0 && (
                      <ul
                        className="record-warnings"
                        aria-label={`Problems with ${item.id}`}
                      >
                        {item.warnings.map((warning, index) => (
                          <li key={`${warning}-${index}`}>{warning}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td>
                    <span className={`type-pill type-${kind}`}>
                      {typeLabel(kind)}
                    </span>
                  </td>
                  <td className="id-cell">{item.id}</td>
                  <td>{authorOf(item) || '—'}</td>
                  <td>
                    {tagsOf(item).length > 0 ? (
                      <span className="tag-list">
                        {tagsOf(item).join(', ')}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {item.warnings.length > 0 ? (
                      <span className="problem-label">Problems</span>
                    ) : (
                      'OK'
                    )}
                  </td>
                </tr>
              );
            })}
            {!loading && visibleItems.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-results">
                  No entries match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {(['tracks', 'packs'] as const).map((collection) =>
        collections[collection].nextPageToken ? (
          <div className="load-more-row" key={collection}>
            <button
              type="button"
              disabled={collections[collection].loading}
              onClick={() => void loadCollection(collection, true)}
            >
              {collections[collection].loading
                ? 'Loading…'
                : `Load more ${collection === 'tracks' ? 'Sounds' : 'Packs'}`}
            </button>
          </div>
        ) : null,
      )}
    </main>
  );
}
