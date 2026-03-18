'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ROUTES } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { AUTH_CONFIG } from '@/lib/constants';
import { useTheme } from 'next-themes';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  MessageSquareWarning,
  ClipboardList,
  Users,
  Wallet,
  LogOut,
} from 'lucide-react';

const navItems = [
  { name: 'Dashboard', href: ROUTES.DASHBOARD, icon: LayoutDashboard },
  { name: 'Disputes', href: ROUTES.DISPUTES, icon: MessageSquareWarning },
  { name: 'Orders', href: ROUTES.ORDERS, icon: ClipboardList },
  { name: 'Users', href: ROUTES.USERS, icon: Users },
  { name: 'Payouts', href: ROUTES.PAYOUTS, icon: Wallet },
];

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  if (pathname === ROUTES.LOGIN || pathname === ROUTES.HOME) {
    return null;
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push(ROUTES.LOGIN);
  };

  return (
    <>
      <aside className="fixed left-0 top-0 w-60 h-screen bg-background border-r border-border flex flex-col z-50">
        <div className="px-6 py-6 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-sm">
              CB
            </div>
            <div>
              <h2 className="text-xl font-bold text-primary">CouponBazaar</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Admin Console</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 h-12 px-4 rounded-lg mb-1 border-l-4 transition-all duration-150',
                  isActive
                    ? 'bg-primary/10 text-primary border-primary shadow-sm'
                    : 'border-transparent text-foreground/80 hover:bg-muted/80 hover:text-foreground'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-border">
          <div className="mb-3">
            <label
              htmlFor="cb-theme-selector"
              className="px-1 pb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Theme
            </label>
            <select
              id="cb-theme-selector"
              suppressHydrationWarning
              value={theme ?? 'system'}
              onChange={(e) => setTheme(e.target.value)}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground transition-colors hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="system">Auto</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
          <button
            onClick={() => setLogoutDialogOpen(true)}
            className="flex items-center gap-3 w-full h-12 px-4 rounded-lg text-foreground/80 hover:bg-muted/80 hover:text-foreground transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </aside>

      <Dialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
            <DialogDescription>
              Are you sure you want to logout? You&apos;ll need to enter the admin token again to access the console.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3">
            <Button variant="outline" onClick={() => setLogoutDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              Logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

