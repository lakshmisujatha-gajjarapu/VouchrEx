import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AUTH_CONFIG, API_CONFIG, ADMIN_HEADER } from '@/lib/constants';

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_CONFIG.COOKIE_NAME)?.value;

  // Best-effort: revoke server-side session (no-op for bootstrap token)
  if (token) {
    await fetch(`${API_CONFIG.BASE_URL}/admin/auth/logout`, {
      method: 'POST',
      headers: { [ADMIN_HEADER]: token },
      cache: 'no-store',
    }).catch(() => null);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete(AUTH_CONFIG.COOKIE_NAME);
  return response;
}
