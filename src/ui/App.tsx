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

interface FileCheck {
  name: string;
  status: 'available' | 'missing' | 'inaccessible';
  checkedAt: string;
  size?: string;
  contentType?: string;
  updated?: string;
  playback?: 'ready' | 'decode-failed' | 'unavailable';
  playbackCheckedAt?: string;
}

interface FileScan {
  running: boolean;
  done: number;
  total: number;
  complete: boolean;
  checkedAt: string | null;
  error: string | null;
}

type ItemType = 'loop' | 'one-shot' | 'pack' | 'unknown';

const AUDIO_BASE = 'https://storage.googleapis.com/turbo-bard.appspot.com';

/* eslint-disable jsx-a11y/media-has-caption -- Catalog entries are sound effects without speech; the label identifies each audition. */
function AudioPreview({
  fileName,
  label,
  format,
  onPlayback,
}: {
  fileName: string;
  label: string;
  format: 'mp3' | 'webm';
  onPlayback: (
    name: string,
    result: 'ready' | 'decode-failed' | 'unavailable',
  ) => void;
}) {
  return (
    <audio
      aria-label={`${label} ${format.toUpperCase()}`}
      controls
      preload="none"
      src={`${AUDIO_BASE}/${encodeURIComponent(fileName)}.${format}`}
      onCanPlay={() => onPlayback(`${fileName}.${format}`, 'ready')}
      onError={(event) =>
        onPlayback(
          `${fileName}.${format}`,
          event.currentTarget.error?.code === 3
            ? 'decode-failed'
            : 'unavailable',
        )
      }
    >
      Audio playback is not supported by this browser.
    </audio>
  );
}
/* eslint-enable jsx-a11y/media-has-caption */

function FileStatus({
  fileName,
  checks,
}: {
  fileName: string;
  checks: Record<string, FileCheck>;
}) {
  return (
    <div className="file-status">
      {(['mp3', 'webm'] as const).map((format) => {
        const name = `${fileName}.${format}`;
        const check = checks[name];
        const status = check?.checkedAt
          ? check.status === 'available'
            ? 'Available'
            : check.status === 'missing'
              ? 'Missing'
              : 'Inaccessible'
          : 'Unchecked';
        const playbackStatus =
          check?.playback === 'decode-failed'
            ? 'Decode failed'
            : check?.playback === 'unavailable'
              ? 'Playback unavailable'
              : check?.playback === 'ready'
                ? 'Ready to play'
                : 'Not played';
        return (
          <p key={name}>
            {name} · {status} · {playbackStatus}
            {check?.size && check.status === 'available'
              ? ` · ${check.size} bytes`
              : ''}
            {check?.contentType ? ` · ${check.contentType}` : ''}
            {check?.checkedAt
              ? ` · Checked ${new Date(check.checkedAt).toLocaleString()}`
              : ''}
            {check?.playbackCheckedAt
              ? ` · Playback checked ${new Date(check.playbackCheckedAt).toLocaleString()}`
              : ''}
          </p>
        );
      })}
    </div>
  );
}

function AudioControls({
  fileName,
  label,
  checks,
  onPlayback,
}: {
  fileName: string;
  label: string;
  checks: Record<string, FileCheck>;
  onPlayback: (
    name: string,
    result: 'ready' | 'decode-failed' | 'unavailable',
  ) => void;
}) {
  return (
    <>
      {(['mp3', 'webm'] as const).map((format) => (
        <AudioPreview
          key={format}
          fileName={fileName}
          label={label}
          format={format}
          onPlayback={onPlayback}
        />
      ))}
      <FileStatus fileName={fileName} checks={checks} />
    </>
  );
}

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

function sourceUrlsOf(item: CatalogItem): unknown[] {
  const source = item.fields.source;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return [];
  const urls = (source as Record<string, unknown>).urls;
  return Array.isArray(urls) ? urls : urls === undefined ? [] : [urls];
}

function safeExternalUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.href
      : null;
  } catch {
    return null;
  }
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

function warningsForItem(
  item: CatalogItem,
  collections: Record<CatalogCollection, CollectionState>,
): string[] {
  const warnings = [...item.warnings];
  if (
    item.collection !== 'packs' ||
    !collections.tracks.complete ||
    collections.tracks.error
  ) {
    return warnings;
  }

  const soundIds = new Set(collections.tracks.items.map((sound) => sound.id));
  if (!Array.isArray(item.fields.tracks)) return warnings;
  for (const [index, member] of item.fields.tracks.entries()) {
    if (!member || typeof member !== 'object' || Array.isArray(member))
      continue;
    const id = (member as Record<string, unknown>).id;
    if (typeof id === 'string' && !soundIds.has(id)) {
      warnings.push(
        `Pack member ${index + 1} references missing Sound "${id}".`,
      );
    }
  }
  return warnings;
}

function packReferencesSound(pack: CatalogItem, soundId: string): boolean {
  return (
    Array.isArray(pack.fields.tracks) &&
    pack.fields.tracks.some(
      (member) =>
        member &&
        typeof member === 'object' &&
        !Array.isArray(member) &&
        (member as Record<string, unknown>).id === soundId,
    )
  );
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
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const [fileChecks, setFileChecks] = useState<Record<string, FileCheck>>({});
  const [fileScan, setFileScan] = useState<FileScan>({
    running: false,
    done: 0,
    total: 0,
    complete: false,
    checkedAt: null,
    error: null,
  });

  function recordPlayback(
    name: string,
    result: 'ready' | 'decode-failed' | 'unavailable',
  ) {
    setFileChecks((previous) => ({
      ...previous,
      [name]: {
        ...(previous[name] ?? { name, status: 'inaccessible', checkedAt: '' }),
        playback: result,
        playbackCheckedAt: new Date().toISOString(),
      },
    }));
  }

  async function scanReferencedFiles() {
    if (fileScan.running) return;
    setFileScan({
      running: true,
      done: 0,
      total: 0,
      complete: false,
      checkedAt: null,
      error: null,
    });
    let sounds: CatalogItem[] = [];
    let nextPageToken: string | null = null;
    let complete = false;
    let error: string | null = null;
    try {
      const firstPage = await loadCollectionPage('tracks');
      sounds = firstPage.items;
      nextPageToken = firstPage.nextPageToken;
      complete = firstPage.complete;
      setCollections((previous) => ({
        ...previous,
        tracks: {
          ...previous.tracks,
          items: sounds,
          nextPageToken,
          complete,
          scannedAt: firstPage.scannedAt,
          error: null,
        },
      }));
      while (nextPageToken) {
        const page = await loadCollectionPage('tracks', nextPageToken);
        sounds = [...sounds, ...page.items];
        nextPageToken = page.nextPageToken;
        complete = page.complete;
        setCollections((previous) => ({
          ...previous,
          tracks: {
            ...previous.tracks,
            items: sounds,
            nextPageToken,
            complete,
            scannedAt: page.scannedAt,
            error: null,
          },
        }));
      }
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'catalog_request_failed';
      if (!sounds.length) sounds = collections.tracks.items;
    }
    const names = [
      ...new Set(
        sounds.flatMap((item) => {
          const fields = item.fields;
          const stems = [
            fields.fileName,
            ...(Array.isArray(fields.samples) ? fields.samples : []),
          ].filter(
            (value): value is string =>
              typeof value === 'string' && Boolean(value.trim()),
          );
          return stems.flatMap((stem) => [`${stem}.mp3`, `${stem}.webm`]);
        }),
      ),
    ];
    setFileScan((previous) => ({ ...previous, total: names.length }));
    let cursor = 0;
    await Promise.all(
      Array.from({ length: Math.min(4, names.length) }, async () => {
        while (cursor < names.length) {
          const name = names[cursor++];
          let check: FileCheck;
          try {
            const url = new URL('/api/file', window.location.origin);
            url.searchParams.set('name', name);
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            check = (await response.json()) as FileCheck;
            if (
              check.name !== name ||
              !['available', 'missing', 'inaccessible'].includes(check.status)
            )
              throw new Error('Invalid file response');
          } catch {
            check = {
              name,
              status: 'inaccessible',
              checkedAt: new Date().toISOString(),
            };
          }
          setFileChecks((previous) => ({
            ...previous,
            [name]: {
              ...check,
              playback: previous[name]?.playback,
              playbackCheckedAt: previous[name]?.playbackCheckedAt,
            },
          }));
          setFileScan((previous) => ({ ...previous, done: previous.done + 1 }));
        }
      }),
    );
    setFileScan((previous) => ({
      ...previous,
      running: false,
      complete: complete && !error,
      checkedAt: new Date().toISOString(),
      error,
    }));
  }

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
    const hasProblems = warningsForItem(item, collections).length > 0;
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
  const selectedItem =
    allItems.find((item) => `${item.collection}/${item.id}` === selectedKey) ??
    null;
  const selectedJson = selectedItem
    ? JSON.stringify(
        {
          document: {
            id: selectedItem.id,
            collection: selectedItem.collection,
          },
          fields: selectedItem.fields,
        },
        null,
        2,
      )
    : '';
  const selectedAttributionUrls = selectedItem
    ? sourceUrlsOf(selectedItem)
    : [];
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

      <section className="file-check-panel" aria-label="Referenced-file health">
        <div>
          <h2>Referenced-file health</h2>
          <p>
            Check MP3 and WebM object existence and metadata on demand. Listen
            to each file to assess audio correctness; a storage check cannot do
            that.
          </p>
          <p role="status">
            {fileScan.checkedAt || fileScan.running
              ? `${fileScan.done} of ${fileScan.total} file checks complete${fileScan.running ? '…' : '.'} ${fileScan.complete ? 'Catalog scan complete.' : 'Catalog scan incomplete.'}${fileScan.error ? ` ${fileScan.error}` : ''}${fileScan.checkedAt ? ` Checked ${new Date(fileScan.checkedAt).toLocaleString()}.` : ''}`
              : 'Files are unchecked. No scan has run.'}
          </p>
        </div>
        <button
          type="button"
          disabled={fileScan.running || loading}
          onClick={() => void scanReferencedFiles()}
        >
          {fileScan.running ? 'Checking files…' : 'Check referenced files'}
        </button>
      </section>

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
              const warnings = warningsForItem(item, collections);
              return (
                <tr key={`${item.collection}/${item.id}`}>
                  <td>
                    <button
                      type="button"
                      className="inspect-link"
                      onClick={() => {
                        setSelectedKey(`${item.collection}/${item.id}`);
                        setCopyStatus('');
                      }}
                    >
                      {titleOf(item)}
                    </button>
                    {warnings.length > 0 && (
                      <ul
                        className="record-warnings"
                        aria-label={`Problems with ${item.id}`}
                      >
                        {warnings.map((warning, index) => (
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
                    {warnings.length > 0 ? (
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

      {selectedItem && (
        <div className="detail-backdrop">
          <button
            type="button"
            className="detail-dismiss"
            aria-label="Close details"
            onClick={() => setSelectedKey(null)}
          />
          <section
            className="detail-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-title"
          >
            <header className="detail-header">
              <div>
                <p className="eyebrow">{typeLabel(itemType(selectedItem))}</p>
                <h2 id="detail-title">{titleOf(selectedItem)}</h2>
              </div>
              <button
                type="button"
                className="close-detail"
                onClick={() => setSelectedKey(null)}
                aria-label="Close details"
              >
                ×
              </button>
            </header>
            <dl className="metadata-grid">
              <div>
                <dt>Document ID</dt>
                <dd className="id-cell">{selectedItem.id}</dd>
              </div>
              <div>
                <dt>Author</dt>
                <dd>{authorOf(selectedItem) || '—'}</dd>
              </div>
              <div>
                <dt>Attribution URLs</dt>
                <dd>
                  {selectedAttributionUrls.length > 0
                    ? selectedAttributionUrls.map((value, index) => {
                        const label =
                          typeof value === 'string'
                            ? value
                            : (JSON.stringify(value) ?? String(value));
                        const href = safeExternalUrl(value);
                        return href ? (
                          <span key={`${label}-${index}`}>
                            {index > 0 ? ', ' : ''}
                            <a href={href} target="_blank" rel="noreferrer">
                              {label}
                            </a>
                          </span>
                        ) : (
                          <span key={`${label}-${index}`}>
                            {index > 0 ? ', ' : ''}
                            {label}
                          </span>
                        );
                      })
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>Tags</dt>
                <dd>
                  {tagsOf(selectedItem).length
                    ? tagsOf(selectedItem).join(', ')
                    : '—'}
                </dd>
              </div>
              {typeof selectedItem.fields.minSecondsBetween === 'number' && (
                <div>
                  <dt>Minimum interval</dt>
                  <dd>{selectedItem.fields.minSecondsBetween} seconds</dd>
                </div>
              )}
              {typeof selectedItem.fields.maxSecondsBetween === 'number' && (
                <div>
                  <dt>Maximum interval</dt>
                  <dd>{selectedItem.fields.maxSecondsBetween} seconds</dd>
                </div>
              )}
              {typeof selectedItem.fields.fileName === 'string' && (
                <div>
                  <dt>Filename</dt>
                  <dd>{selectedItem.fields.fileName}</dd>
                </div>
              )}
              {Array.isArray(selectedItem.fields.samples) && (
                <div>
                  <dt>Variations</dt>
                  <dd>
                    {
                      selectedItem.fields.samples.filter(
                        (sample) => typeof sample === 'string',
                      ).length
                    }
                  </dd>
                </div>
              )}
            </dl>

            {warningsForItem(selectedItem, collections).length > 0 && (
              <section
                className="detail-section"
                aria-label="Validation warnings"
              >
                <h3>Validation warnings</h3>
                <ul className="record-warnings">
                  {warningsForItem(selectedItem, collections).map(
                    (warning, index) => (
                      <li key={`${warning}-${index}`}>{warning}</li>
                    ),
                  )}
                </ul>
              </section>
            )}

            {selectedItem.collection === 'tracks' && (
              <section className="detail-section" aria-label="Audio files">
                <h3>Individual playback</h3>
                {typeof selectedItem.fields.fileName === 'string' &&
                selectedItem.fields.fileName.trim() ? (
                  <div className="audio-row">
                    <span>{selectedItem.fields.fileName}</span>
                    <AudioControls
                      fileName={selectedItem.fields.fileName}
                      label={selectedItem.fields.fileName}
                      checks={fileChecks}
                      onPlayback={recordPlayback}
                    />
                  </div>
                ) : null}
                {Array.isArray(selectedItem.fields.samples) &&
                  selectedItem.fields.samples.map((sample, index) =>
                    typeof sample === 'string' && sample.trim() ? (
                      <div className="audio-row" key={`${sample}-${index}`}>
                        <span>
                          Variation {index + 1}: {sample}
                        </span>
                        <AudioControls
                          fileName={sample}
                          label={`Variation ${index + 1}: ${sample}`}
                          checks={fileChecks}
                          onPlayback={recordPlayback}
                        />
                      </div>
                    ) : null,
                  )}
                {typeof selectedItem.fields.fileName !== 'string' &&
                  !Array.isArray(selectedItem.fields.samples) && (
                    <p className="muted">
                      No playable filename or variation is available.
                    </p>
                  )}
              </section>
            )}

            {selectedItem.collection === 'tracks' && (
              <section className="detail-section" aria-label="Pack references">
                <h3>Used by Packs</h3>
                {collections.packs.error ? (
                  <p className="muted">
                    Pack references could not be checked because the Pack
                    catalog failed to load.
                  </p>
                ) : !collections.packs.complete ? (
                  <p className="muted">
                    Pack references may be incomplete until all Packs have
                    loaded.
                  </p>
                ) : null}
                {collections.packs.items
                  .filter((pack) => packReferencesSound(pack, selectedItem.id))
                  .map((pack) => (
                    <button
                      type="button"
                      className="related-entry"
                      key={pack.id}
                      onClick={() => setSelectedKey(`packs/${pack.id}`)}
                    >
                      {titleOf(pack)} <span className="id-cell">{pack.id}</span>
                    </button>
                  ))}
                {collections.packs.complete &&
                  !collections.packs.items.some((pack) =>
                    packReferencesSound(pack, selectedItem.id),
                  ) && <p className="muted">No Pack references found.</p>}
              </section>
            )}

            {selectedItem.collection === 'packs' && (
              <section className="detail-section" aria-label="Pack members">
                <h3>Sounds in this Pack</h3>
                {Array.isArray(selectedItem.fields.tracks) ? (
                  selectedItem.fields.tracks.map((member, index) => {
                    const memberData =
                      member &&
                      typeof member === 'object' &&
                      !Array.isArray(member)
                        ? (member as Record<string, unknown>)
                        : {};
                    const id =
                      typeof memberData.id === 'string' ? memberData.id : '';
                    const sound = collections.tracks.items.find(
                      (entry) => entry.id === id,
                    );
                    const soundName = sound
                      ? titleOf(sound)
                      : id || 'Invalid Sound reference';
                    const fileNames = sound
                      ? typeof sound.fields.fileName === 'string'
                        ? [sound.fields.fileName]
                        : Array.isArray(sound.fields.samples)
                          ? sound.fields.samples.filter(
                              (sample): sample is string =>
                                typeof sample === 'string',
                            )
                          : []
                      : [];
                    return (
                      <div className="pack-member" key={`${id}-${index}`}>
                        <div>
                          <strong>
                            {sound ? (
                              <button
                                type="button"
                                className="inspect-link"
                                onClick={() =>
                                  setSelectedKey(`tracks/${sound.id}`)
                                }
                              >
                                {soundName}
                              </button>
                            ) : (
                              soundName
                            )}
                          </strong>
                          <span className="id-cell">{id || 'No ID'}</span>
                        </div>
                        <span>
                          Volume:{' '}
                          {typeof memberData.volume === 'number'
                            ? memberData.volume
                            : '—'}
                          {memberData.oneShotConfig &&
                          typeof memberData.oneShotConfig === 'object' &&
                          typeof (
                            memberData.oneShotConfig as Record<string, unknown>
                          ).minSecondsBetween === 'number'
                            ? ` · Min interval: ${(memberData.oneShotConfig as Record<string, unknown>).minSecondsBetween} seconds`
                            : ''}
                          {memberData.oneShotConfig &&
                          typeof memberData.oneShotConfig === 'object' &&
                          typeof (
                            memberData.oneShotConfig as Record<string, unknown>
                          ).maxSecondsBetween === 'number'
                            ? ` · Max interval: ${(memberData.oneShotConfig as Record<string, unknown>).maxSecondsBetween} seconds`
                            : ''}
                        </span>
                        {fileNames.map((fileName, audioIndex) => (
                          <div
                            className="audio-row"
                            key={`${fileName}-${audioIndex}`}
                          >
                            <span>
                              {fileNames.length > 1
                                ? `Variation ${audioIndex + 1}: `
                                : ''}
                              {fileName}
                            </span>
                            <AudioControls
                              fileName={fileName}
                              label={`${soundName}: ${fileName}`}
                              checks={fileChecks}
                              onPlayback={recordPlayback}
                            />
                          </div>
                        ))}
                      </div>
                    );
                  })
                ) : (
                  <p className="muted">
                    Pack members are malformed or unavailable.
                  </p>
                )}
                {!collections.tracks.complete && (
                  <p className="muted">
                    Sound lookup may be incomplete until all Sounds have loaded.
                  </p>
                )}
              </section>
            )}

            <section
              className="detail-section json-section"
              aria-label="Read-only catalog JSON"
            >
              <div className="section-heading">
                <h3>Catalog JSON</h3>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(selectedJson)
                      .then(() => setCopyStatus('JSON copied.'))
                      .catch(() => setCopyStatus('Could not copy JSON.'));
                  }}
                >
                  Copy JSON
                </button>
              </div>
              <pre>{selectedJson}</pre>
              <span role="status" className="muted">
                {copyStatus}
              </span>
            </section>
          </section>
        </div>
      )}
    </main>
  );
}
