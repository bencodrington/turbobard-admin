import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const originalClipboard = Object.getOwnPropertyDescriptor(
  navigator,
  'clipboard',
);

const record = (
  id: string,
  fields: Record<string, unknown>,
  warnings: string[] = [],
) => ({
  id,
  fields,
  rawFields: fields,
  warnings,
});

function mockCatalog({
  tracks = [],
  packs = [],
  incomplete = false,
  failedCollection,
}: {
  tracks?: ReturnType<typeof record>[];
  packs?: ReturnType<typeof record>[];
  incomplete?: boolean;
  failedCollection?: 'tracks' | 'packs';
}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'https://admin.example');
      const collection = url.searchParams.get('collection');
      if (collection === failedCollection) {
        return Response.json({ error: 'permission_denied' }, { status: 502 });
      }
      const items =
        collection === 'tracks'
          ? tracks.map((item) => ({ ...item, collection: 'tracks' }))
          : packs.map((item) => ({ ...item, collection: 'packs' }));
      return Response.json({
        items,
        nextPageToken: incomplete ? 'resume-page' : null,
        complete: !incomplete,
        scannedAt: '2026-11-01T12:00:00.000Z',
      });
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (originalClipboard) {
    Object.defineProperty(navigator, 'clipboard', originalClipboard);
  } else {
    Reflect.deleteProperty(navigator, 'clipboard');
  }
});

describe('catalog browsing', () => {
  it('links duplicate tags to Sound and Pack details without changing their order', async () => {
    mockCatalog({
      tracks: [
        record('rain', {
          name: 'Rain',
          tags: ['Storm', 'Storm', 'forest'],
          fileName: 'rain',
        }),
      ],
      packs: [
        record('weather', {
          name: 'Weather',
          tags: [' storm ', 'forest'],
          tracks: [],
        }),
      ],
    });
    render(<App />);
    const report = await screen.findByRole('region', {
      name: 'Duplicate-tag report',
    });
    expect(within(report).getByText(/appears 2 times in/)).toBeInTheDocument();
    expect(within(report).getByText('" storm "')).toBeInTheDocument();
    expect(
      within(report).queryByText(/"forest" appears/),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(report).getAllByRole('button', {
        name: /Weather \(packs\/weather\)/,
      })[0],
    );
    expect(screen.getByRole('dialog')).toHaveTextContent('Weather');
    expect(screen.getByRole('dialog')).toHaveTextContent(' storm , forest');
    expect(screen.getByRole('dialog')).toHaveTextContent('" storm "');
  });

  it('refreshes the Sound catalog before a health scan', async () => {
    let soundLoads = 0;
    const checked: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input), 'https://admin.example');
        if (url.pathname === '/api/file') {
          const name = url.searchParams.get('name')!;
          checked.push(name);
          return Response.json({
            name,
            status: 'available',
            checkedAt: '2026-11-02T12:30:00Z',
          });
        }
        const isSound = url.searchParams.get('collection') === 'tracks';
        if (isSound) soundLoads++;
        const fileName = soundLoads === 1 ? 'old' : 'new';
        return Response.json({
          items: isSound
            ? [
                {
                  ...record(fileName, { name: fileName, tags: [], fileName }),
                  collection: 'tracks',
                },
              ]
            : [],
          nextPageToken: null,
          complete: true,
          scannedAt: '2026-11-02T12:00:00Z',
        });
      }),
    );
    render(<App />);
    expect(
      await screen.findByRole('button', { name: 'old' }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Check referenced files' }),
    );
    await waitFor(() =>
      expect(
        screen.getByText(/2 of 2 file checks complete/i),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'new' })).toBeInTheDocument();
    expect(checked).toEqual(['new.mp3', 'new.webm']);
  });
  it('reports an incomplete health scan when catalog pagination fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input), 'https://admin.example');
        if (url.pathname === '/api/file')
          return Response.json({
            name: url.searchParams.get('name'),
            status: 'available',
            checkedAt: '2026-11-02T12:30:00Z',
          });
        if (url.searchParams.has('pageToken'))
          return Response.json({ error: 'upstream_timeout' }, { status: 504 });
        return Response.json({
          items:
            url.searchParams.get('collection') === 'tracks'
              ? [
                  {
                    ...record('rain', {
                      name: 'Rain',
                      tags: [],
                      fileName: 'rain',
                    }),
                    collection: 'tracks',
                  },
                  {
                    ...record(
                      'broken',
                      { name: 'Broken', tags: 'bad', samples: [null] },
                      ['Samples must be text.'],
                    ),
                    collection: 'tracks',
                  },
                ]
              : [],
          nextPageToken:
            url.searchParams.get('collection') === 'tracks' ? 'more' : null,
          complete: url.searchParams.get('collection') !== 'tracks',
          scannedAt: '2026-11-02T12:00:00Z',
        });
      }),
    );
    render(<App />);
    expect(
      await screen.findByRole('button', { name: 'Rain' }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Check referenced files' }),
    );
    await waitFor(() =>
      expect(
        screen.getByText(
          /2 of 2 file checks complete.*catalog scan incomplete/i,
        ),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Broken' })).toBeInTheDocument();
    expect(screen.getByText('Samples must be text.')).toBeInTheDocument();
  });
  it('checks referenced files on demand and distinguishes storage and decode failures', async () => {
    const files: Record<string, string> = {
      'rain.mp3': 'available',
      'rain.webm': 'missing',
      'horn.mp3': 'inaccessible',
      'horn.webm': 'available',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input), 'https://admin.example');
        if (url.pathname === '/api/file') {
          const name = url.searchParams.get('name')!;
          return Response.json({
            name,
            status: files[name],
            checkedAt: '2026-11-02T12:30:00.000Z',
            size: '123',
          });
        }
        const tracks = [
          record('rain', { name: 'Rain', tags: [], fileName: 'rain' }),
          record('horn', { name: 'Horn', tags: [], samples: ['horn'] }),
        ];
        return Response.json({
          items:
            url.searchParams.get('collection') === 'tracks'
              ? tracks.map((item) => ({ ...item, collection: 'tracks' }))
              : [],
          nextPageToken: null,
          complete: true,
          scannedAt: '2026-11-02T12:00:00.000Z',
        });
      }),
    );

    const { container } = render(<App />);
    expect(
      await screen.findByRole('button', { name: 'Rain' }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: /check referenced files/i }),
    );
    await waitFor(() =>
      expect(
        screen.getByText(/4 of 4 file checks complete/i),
      ).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Rain' }));
    expect(screen.getByText(/rain\.webm.*missing/i)).toBeInTheDocument();
    const audio = container.querySelector('audio[aria-label="rain MP3"]')!;
    Object.defineProperty(audio, 'error', {
      configurable: true,
      value: { code: 2 },
    });
    fireEvent.error(audio);
    expect(
      within(screen.getByRole('dialog')).getByText(/playback unavailable/i),
    ).toBeInTheDocument();
    Object.defineProperty(audio, 'error', {
      configurable: true,
      value: { code: 3 },
    });
    fireEvent.error(audio);
    expect(
      within(screen.getByRole('dialog')).getByText(/decode failed/i),
    ).toBeInTheDocument();
    fireEvent.canPlay(audio);
    expect(screen.getByText(/ready to play/i)).toBeInTheDocument();
    expect(screen.getByText(/rain\.mp3.*checked/i)).toBeInTheDocument();
  });
  it('searches records and filters by type, exact tag, and author', async () => {
    mockCatalog({
      tracks: [
        record('rain-loop', {
          name: 'Rain on stone',
          tags: ['weather', 'cave'],
          source: { author: 'Mira Vale' },
          fileName: 'rain-stone',
        }),
        record('horn-shot', {
          name: 'War horn',
          tags: ['battle'],
          source: { author: 'Northwind Audio' },
          samples: ['horn-a', 'horn-b'],
        }),
      ],
      packs: [
        record('storm-pack', {
          name: 'Storm kit',
          tags: ['weather'],
          tracks: [],
        }),
      ],
    });

    render(<App />);
    expect(await screen.findByText('Rain on stone')).toBeInTheDocument();
    expect(screen.getByText('War horn')).toBeInTheDocument();
    expect(screen.getByText('Storm kit')).toBeInTheDocument();

    fireEvent.change(
      screen.getByRole('searchbox', { name: /search catalog/i }),
      {
        target: { value: 'rain-stone' },
      },
    );
    expect(screen.getByText('Rain on stone')).toBeInTheDocument();
    expect(screen.queryByText('War horn')).not.toBeInTheDocument();

    fireEvent.change(
      screen.getByRole('searchbox', { name: /search catalog/i }),
      {
        target: { value: '' },
      },
    );
    fireEvent.change(screen.getByLabelText('Type'), {
      target: { value: 'loop' },
    });
    fireEvent.change(screen.getByLabelText('Exact tag'), {
      target: { value: 'weather' },
    });
    fireEvent.change(screen.getByLabelText('Author'), {
      target: { value: 'Mira Vale' },
    });

    expect(screen.getByText('Rain on stone')).toBeInTheDocument();
    expect(screen.queryByText('War horn')).not.toBeInTheDocument();
    expect(screen.queryByText('Storm kit')).not.toBeInTheDocument();
  });

  it('keeps malformed entries visible and reports partial or failed loads', async () => {
    mockCatalog({
      tracks: [
        record('broken-track', { tags: 'wrong-shape' }, [
          'Tags must be a list.',
        ]),
      ],
      incomplete: true,
      failedCollection: 'packs',
    });

    render(<App />);
    expect(await screen.findByText('broken-track')).toBeInTheDocument();
    expect(screen.getByText('Tags must be a list.')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /could not load packs/i,
    );
    expect(
      screen.getByText(/showing an incomplete catalog/i),
    ).toBeInTheDocument();

    expect(screen.getAllByText('Problems')).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: 'Load more Sounds' }),
    ).toBeInTheDocument();
  });

  it('flags Pack members missing from a complete Sound catalog and filters problems', async () => {
    mockCatalog({
      packs: [
        record('orphan-pack', {
          name: 'Orphan pack',
          tags: ['weather'],
          tracks: [{ id: 'missing-sound' }],
        }),
      ],
    });

    render(<App />);
    expect(await screen.findByText('Orphan pack')).toBeInTheDocument();
    expect(
      screen.getByText(/references missing Sound "missing-sound"/),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Problems'), {
      target: { value: 'problems' },
    });
    expect(screen.getByText('Orphan pack')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Problems'), {
      target: { value: 'clear' },
    });
    expect(screen.queryByText('Orphan pack')).not.toBeInTheDocument();
  });

  it('inspects Sounds and Packs with copyable JSON, references, and individual playback', async () => {
    mockCatalog({
      tracks: [
        record('horn-shot', {
          name: 'War horn',
          tags: ['battle'],
          source: {
            author: 'Northwind Audio',
            urls: ['https://northwind.example/audio'],
          },
          samples: ['horn-a', 'horn-b'],
          minSecondsBetween: 4,
          maxSecondsBetween: 8,
          extraField: { preserved: true },
          id: 'unknown-id-field',
          collection: 'unknown-collection-field',
        }),
      ],
      packs: [
        record('battle-pack', {
          name: 'Battle kit',
          tags: ['battle'],
          tracks: [
            {
              id: 'horn-shot',
              volume: 0.7,
              oneShotConfig: { minSecondsBetween: 2, maxSecondsBetween: 5 },
            },
          ],
        }),
      ],
    });

    const { container } = render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'War horn' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Northwind Audio');
    expect(
      screen.getByRole('link', { name: 'https://northwind.example/audio' }),
    ).toHaveAttribute('href', 'https://northwind.example/audio');
    expect(screen.getByText('4 seconds')).toBeInTheDocument();
    expect(screen.getByText('8 seconds')).toBeInTheDocument();
    expect(screen.getByText(/"extraField": \{/)).toBeInTheDocument();
    expect(container.querySelectorAll('audio')).toHaveLength(4);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Copy JSON' }));
    expect(await screen.findByText('JSON copied.')).toBeInTheDocument();
    const copied = JSON.parse(writeText.mock.calls[0][0] as string) as {
      document: { id: string; collection: string };
      fields: Record<string, unknown>;
    };
    expect(copied.document).toEqual({ id: 'horn-shot', collection: 'tracks' });
    expect(copied.fields.id).toBe('unknown-id-field');
    expect(copied.fields.collection).toBe('unknown-collection-field');
    expect(copied.fields.extraField).toEqual({ preserved: true });
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: /Battle kit/,
      }),
    );
    expect(screen.getByRole('dialog')).toHaveTextContent('Sounds in this Pack');
    expect(screen.getByText(/Volume: 0.7/)).toBeInTheDocument();
    expect(container.querySelectorAll('audio')).toHaveLength(4);
  });
});
