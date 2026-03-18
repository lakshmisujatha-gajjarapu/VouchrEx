import { NextResponse } from 'next/server';
import { AUTH_CONFIG } from '@/lib/constants';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(AUTH_CONFIG.COOKIE_NAME);
  return response;
}
