interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return Response.json(
        { error: 'not_implemented', message: 'Catalog API is not connected.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return env.ASSETS.fetch(request);
  },
};
