import { cookies } from 'next/headers';
import { AUTH_CONFIG } from './constants';

/**
 * Server-only helper. Reads the admin session token from the httpOnly cookie.
 * Returns null when not signed in. Pass the result as a prop to the
 * RealtimeBridge client component so it can authenticate the socket.
 */
export async function getAdminTokenForClient(): Promise<string | null> {
  const store = await cookies();
  return store.get(AUTH_CONFIG.COOKIE_NAME)?.value ?? null;
}
