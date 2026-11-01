import { catalogItemFromDocument, type CatalogCollection } from './catalog';

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  GOOGLE_PROJECT_ID?: string;
  GOOGLE_CLIENT_EMAIL?: string;
  GOOGLE_PRIVATE_KEY?: string;
}

interface FirestoreDocument {
  name?: unknown;
  fields?: Record<string, Record<string, unknown>>;
}

interface FirestoreListResponse {
  documents?: FirestoreDocument[];
  nextPageToken?: string;
}

interface AccessToken {
  value: string;
  expiresAt: number;
}

const tokenEndpoint = 'https://oauth2.googleapis.com/token';
const firestoreScope = 'https://www.googleapis.com/auth/datastore';
const pageSize = 250;
let accessToken: AccessToken | undefined;

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

function encodeJson(value: unknown): string {
  return encodeBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function decodeJson(value: string): unknown {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function pemBytes(pem: string): ArrayBuffer {
  const encoded = pem
    .replace(/\\n/g, '\n')
    .replace(/-----[^-]+-----/g, '')
    .replace(/\s/g, '');
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return bytes.buffer as ArrayBuffer;
}

async function createAssertion(
  email: string,
  privatePem: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${encodeJson({ alg: 'RS256', typ: 'JWT' })}.${encodeJson({
    iss: email,
    scope: firestoreScope,
    aud: tokenEndpoint,
    iat: now,
    exp: now + 3600,
  })}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemBytes(privatePem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${encodeBase64Url(new Uint8Array(signature))}`;
}

async function getAccessToken(env: Env): Promise<string> {
  if (accessToken && accessToken.expiresAt > Date.now() + 60_000)
    return accessToken.value;
  const { GOOGLE_CLIENT_EMAIL: email, GOOGLE_PRIVATE_KEY: privateKey } = env;
  if (!email || !privateKey)
    throw new ApiError(503, 'integration_not_configured');

  const assertion = await createAssertion(email, privateKey);
  let response: Response;
  try {
    response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError(504, 'upstream_timeout');
    }
    throw new ApiError(502, 'authentication_unavailable');
  }
  if (!response.ok) throw new ApiError(502, 'authentication_failed');
  let body: { access_token?: string; expires_in?: number };
  try {
    body = (await response.json()) as typeof body;
  } catch {
    throw new ApiError(502, 'authentication_failed');
  }
  if (!body.access_token) throw new ApiError(502, 'authentication_failed');
  accessToken = {
    value: body.access_token,
    expiresAt: Date.now() + Math.max(60, body.expires_in ?? 3600) * 1000,
  };
  return body.access_token;
}

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function collectionFrom(value: string | null): CatalogCollection {
  if (value === 'tracks' || value === 'packs') return value;
  throw new ApiError(400, 'invalid_collection');
}

function tokenFrom(
  value: string | null,
  collection: CatalogCollection,
): string | undefined {
  if (!value) return undefined;
  if (value.length > 16_384) throw new ApiError(400, 'invalid_page_token');
  try {
    const decoded = decodeJson(value) as unknown;
    if (
      !Array.isArray(decoded) ||
      decoded.length !== 2 ||
      decoded[0] !== collection ||
      typeof decoded[1] !== 'string' ||
      !decoded[1]
    ) {
      throw new Error('Invalid token');
    }
    return decoded[1];
  } catch {
    throw new ApiError(400, 'invalid_page_token');
  }
}

async function listCatalog(request: Request, env: Env): Promise<Response> {
  if (!env.GOOGLE_PROJECT_ID)
    throw new ApiError(503, 'integration_not_configured');
  const url = new URL(request.url);
  const collection = collectionFrom(url.searchParams.get('collection'));
  const pageToken = tokenFrom(url.searchParams.get('pageToken'), collection);
  const token = await getAccessToken(env);
  const endpoint = new URL(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.GOOGLE_PROJECT_ID)}/databases/(default)/documents/${collection}`,
  );
  endpoint.searchParams.set('pageSize', String(pageSize));
  if (pageToken) endpoint.searchParams.set('pageToken', pageToken);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError(504, 'upstream_timeout');
    }
    throw new ApiError(502, 'upstream_unavailable');
  }
  if (!response.ok) {
    if (response.status === 403) throw new ApiError(502, 'permission_denied');
    if (response.status === 429)
      throw new ApiError(502, 'upstream_rate_limited');
    throw new ApiError(502, 'upstream_error');
  }

  let body: FirestoreListResponse;
  try {
    body = (await response.json()) as FirestoreListResponse;
  } catch {
    throw new ApiError(502, 'invalid_upstream_response');
  }
  if (body.documents !== undefined && !Array.isArray(body.documents)) {
    throw new ApiError(502, 'invalid_upstream_response');
  }
  const nextPageToken = body.nextPageToken
    ? encodeJson([collection, body.nextPageToken])
    : null;
  return jsonResponse({
    items: (body.documents ?? []).map((document) =>
      catalogItemFromDocument(document, collection),
    ),
    nextPageToken,
    complete: !nextPageToken,
    scannedAt: new Date().toISOString(),
  });
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== 'GET')
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  if (url.pathname === '/api/health') {
    return jsonResponse({
      service: 'turbobard-admin',
      integrationConfigured: Boolean(
        env.GOOGLE_PROJECT_ID &&
        env.GOOGLE_CLIENT_EMAIL &&
        env.GOOGLE_PRIVATE_KEY,
      ),
    });
  }
  if (url.pathname === '/api/catalog') return listCatalog(request, env);
  return jsonResponse({ error: 'not_found' }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      return await handleApi(request, env);
    } catch (error) {
      if (error instanceof ApiError)
        return jsonResponse({ error: error.code }, error.status);
      return jsonResponse({ error: 'internal_error' }, 500);
    }
  },
};
