/**
 * Drop-in replacement for fetch() in client components.
 * Redirects to /login on 401 so an expired session doesn't leave
 * the user stuck on a broken action with no path forward.
 */
export async function clientFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401) {
    window.location.href = '/login';
    return new Promise<Response>(() => {});
  }
  return res;
}
