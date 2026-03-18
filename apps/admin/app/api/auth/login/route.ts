import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AUTH_CONFIG, API_CONFIG, ADMIN_HEADER } from '@/lib/constants';

export async function POST(request: NextRequest) {
  const { token } = (await request.json()) as { token: string };

  if (!token?.trim()) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 });
  }

  // Validate the token against the API
  try {
    const res = await fetch(`${API_CONFIG.BASE_URL}/admin/metrics`, {
      headers: { [ADMIN_HEADER]: token },
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Invalid admin token' }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: 'Could not reach API' }, { status: 502 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(AUTH_CONFIG.COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: AUTH_CONFIG.COOKIE_MAX_AGE,
    path: '/',
  });

  return response;
}
