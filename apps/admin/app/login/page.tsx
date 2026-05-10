import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { AUTH_CONFIG } from '@/lib/constants';
import { ROUTES } from '@/lib/routes';
import LoginView from './login-view';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Login | VouchrEx',
};

export default async function LoginPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_CONFIG.COOKIE_NAME);

  if (token) {
    redirect(ROUTES.DASHBOARD);
  }

  return <LoginView />;
}
