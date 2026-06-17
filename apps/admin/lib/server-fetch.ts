const CF_SECRET = process.env.CF_API_SHARED_SECRET;

export function serverFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (CF_SECRET) headers.set('x-cf-secret', CF_SECRET);
  return fetch(url, { ...init, headers });
}
