import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { serverFetch } from '@/lib/server-fetch';
import { API_CONFIG, ADMIN_HEADER, AUTH_CONFIG } from '@/lib/constants';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_CONFIG.COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { orderId } = await params;
  const body = await request.text().catch(() => '');
  const res = await serverFetch(`${API_CONFIG.BASE_URL}/admin/orders/${orderId}/complete-payout`, {
    method: 'POST',
    headers: { [ADMIN_HEADER]: token, 'Content-Type': 'application/json' },
    body: body || undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    return NextResponse.json({ error: text }, { status: res.status });
  }

  return NextResponse.json(await res.json());
}
