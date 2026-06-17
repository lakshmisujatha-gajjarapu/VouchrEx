import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { serverFetch } from '@/lib/server-fetch';
import { API_CONFIG, ADMIN_HEADER, AUTH_CONFIG } from '@/lib/constants';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_CONFIG.COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { key } = await params;
  const body = (await request.json()) as Record<string, unknown>;

  const res = await serverFetch(`${API_CONFIG.BASE_URL}/admin/config/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', [ADMIN_HEADER]: token },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    return NextResponse.json({ error: text }, { status: res.status });
  }

  return NextResponse.json(await res.json());
}
