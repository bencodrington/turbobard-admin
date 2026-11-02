import {
  cleanup,
  fireEvent,
  render,
  screen,
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
    expect(container.querySelectorAll('audio')).toHaveLength(2);
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
    expect(container.querySelectorAll('audio')).toHaveLength(2);
  });
});
