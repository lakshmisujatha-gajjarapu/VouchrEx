import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { serverFetch } from '@/lib/server-fetch';
import { API_CONFIG, ADMIN_HEADER, AUTH_CONFIG } from '@/lib/constants';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ disputeId: string }> }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_CONFIG.COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { disputeId } = await params;
  const body = await request.json() as { resolution: string };

  const res = await serverFetch(`${API_CONFIG.BASE_URL}/orders/disputes/${disputeId}/resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [ADMIN_HEADER]: token,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    return NextResponse.json({ error: text }, { status: res.status });
  }

  const data: unknown = await res.json();
  return NextResponse.json(data);
}
