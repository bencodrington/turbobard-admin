import { beforeEach, describe, expect, it, vi } from 'vitest';
import worker from './worker';

vi.mock('jose', () => ({
  importPKCS8: vi.fn(async () => ({})),
  SignJWT: class {
    setProtectedHeader() {
      return this;
    }
    setIssuer() {
      return this;
    }
    setAudience() {
      return this;
    }
    setIssuedAt() {
      return this;
    }
    setExpirationTime() {
      return this;
    }
    async sign() {
      return 'test-assertion';
    }
  },
}));

const env = {
  ASSETS: { fetch: vi.fn() },
  GOOGLE_PROJECT_ID: 'test-project',
  GOOGLE_CLIENT_EMAIL: 'test@example.com',
  GOOGLE_PRIVATE_KEY: 'test-key',
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('oauth2.googleapis.com'))
        return Response.json({ access_token: 'test-token', expires_in: 3600 });
      if (url.includes('exists.mp3'))
        return Response.json({
          name: 'exists.mp3',
          size: '1234',
          contentType: 'audio/mpeg',
          updated: '2026-11-01T10:00:00Z',
        });
      if (url.includes('missing.mp3'))
        return new Response(null, { status: 404 });
      if (url.includes('private.mp3'))
        return new Response(null, { status: 403 });
      throw new Error(`Unexpected request: ${url}`);
    }),
  );
});

describe('GET /api/file', () => {
  it.each([
    ['exists.mp3', 'available'],
    ['missing.mp3', 'missing'],
    ['private.mp3', 'inaccessible'],
  ])('reports %s as %s with a check time', async (name, status) => {
    const response = await worker.fetch(
      new Request(`https://admin.example/api/file?name=${name}`),
      env,
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ name, status, checkedAt: expect.any(String) });
    if (status === 'available')
      expect(body).toMatchObject({ size: '1234', contentType: 'audio/mpeg' });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('rejects invalid names without fetching storage', async () => {
    const response = await worker.fetch(
      new Request('https://admin.example/api/file?name=bad.txt'),
      env,
    );
    expect(response.status).toBe(400);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});
