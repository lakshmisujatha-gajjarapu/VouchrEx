'use client';

import { usePathname } from 'next/navigation';
import { ROUTES } from '@/lib/routes';

export function PageWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const fullWidthPages = [ROUTES.LOGIN, ROUTES.HOME];
  const isFullWidth = fullWidthPages.some((page) => page === pathname);

  return <main className={isFullWidth ? '' : 'pb-20 md:ml-60 md:pb-0'}>{children}</main>;
}
