'use client';

import { usePathname } from 'next/navigation';
import { ROUTES } from '@/lib/routes';

export function PageWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const fullWidthPages = [ROUTES.LOGIN, ROUTES.HOME];
  const isFullWidth = fullWidthPages.some((page) => page === pathname);

  return <main className={isFullWidth ? '' : 'ml-60'}>{children}</main>;
}
