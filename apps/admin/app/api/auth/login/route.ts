import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { serverFetch } from '@/lib/server-fetch';
import { AUTH_CONFIG, API_CONFIG, ADMIN_HEADER } from '@/lib/constants';

export async function POST(request: NextRequest) {
  const { email, password } = (await request.json()) as { email: string; password: string };

  if (!email.trim() || !password.trim()) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  let sessionToken: string;
  try {
    const res = await serverFetch(`${API_CONFIG.BASE_URL}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const body = (await res.json()) as { message?: string | string[] };
      const rawMsg = body.message;
      const msg = Array.isArray(rawMsg) ? (rawMsg[0] ?? 'Invalid credentials.') : (rawMsg ?? 'Invalid credentials.');
      return NextResponse.json({ error: msg }, { status: 401 });
    }

    const data = (await res.json()) as { sessionToken: string };
    sessionToken = data.sessionToken;
  } catch {
    return NextResponse.json({ error: 'Could not reach API.' }, { status: 502 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(AUTH_CONFIG.COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: AUTH_CONFIG.COOKIE_MAX_AGE,
    path: '/',
  });

  return response;
}

/** Bootstrap login: raw ADMIN_API_TOKEN still works for initial setup. */
export async function PUT(request: NextRequest) {
  const { token } = (await request.json()) as { token: string };
  if (!token.trim()) {
    return NextResponse.json({ error: 'Token is required.' }, { status: 400 });
  }

  try {
    const res = await serverFetch(`${API_CONFIG.BASE_URL}/admin/metrics`, {
      headers: { [ADMIN_HEADER]: token },
      cache: 'no-store',
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '(unreadable)');
      return NextResponse.json({
        error: 'Invalid admin token.',
        _debug: { status: res.status, url: API_CONFIG.BASE_URL, body },
      }, { status: 401 });
    }
  } catch (e) {
    return NextResponse.json({ error: 'Could not reach API.', _debug: String(e) }, { status: 502 });
  }

  const response = NextResponse.json({ success: true, bootstrap: true });
  response.cookies.set(AUTH_CONFIG.COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: AUTH_CONFIG.COOKIE_MAX_AGE,
    path: '/',
  });
  return response;
}
