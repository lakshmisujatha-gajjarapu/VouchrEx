import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { API_CONFIG, ADMIN_HEADER, AUTH_CONFIG } from '@/lib/constants';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ disputeId: string }> }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_CONFIG.COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { disputeId } = await params;
  const res = await fetch(`${API_CONFIG.BASE_URL}/admin/disputes/${disputeId}/evidence-url`, {
    headers: { [ADMIN_HEADER]: token },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    return NextResponse.json({ error: text }, { status: res.status });
  }

  return NextResponse.json(await res.json());
}
