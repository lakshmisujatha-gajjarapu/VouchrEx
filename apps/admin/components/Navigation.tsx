'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ROUTES } from '@/lib/routes';
import { cn } from '@/lib/utils';
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
  ShieldCheck,
} from 'lucide-react';

const baseNavItems = [
  { name: 'Dashboard', href: ROUTES.DASHBOARD, icon: LayoutDashboard },
  { name: 'Disputes',  href: ROUTES.DISPUTES,  icon: MessageSquareWarning },
  { name: 'Orders',    href: ROUTES.ORDERS,    icon: ClipboardList },
  { name: 'Users',     href: ROUTES.USERS,     icon: Users },
  { name: 'Payouts',   href: ROUTES.PAYOUTS,   icon: Wallet },
];

interface NavigationProps {
  isSuperAdmin?: boolean;
}

export function Navigation({ isSuperAdmin = false }: NavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  if (pathname === ROUTES.LOGIN || pathname === ROUTES.HOME) return null;

  const navItems = isSuperAdmin
    ? [...baseNavItems, { name: 'Team', href: ROUTES.TEAM, icon: ShieldCheck }]
    : baseNavItems;

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push(ROUTES.LOGIN);
  };

  return (
    <>
      <aside className="fixed left-0 top-0 w-60 h-screen flex flex-col z-50"
        style={{ backgroundColor: 'var(--color-card)', borderRight: '1px solid var(--color-surface-high)' }}>

        {/* Logo */}
        <div className="px-6 py-6" style={{ borderBottom: '1px solid var(--color-surface-high)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #8856E5, #6E3ACA)' }}>
              <span className="text-white font-bold text-sm" style={{ fontFamily: 'var(--font-headline)' }}>CB</span>
            </div>
            <div>
              <p className="font-bold text-base leading-tight" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-primary)' }}>
                VouchrEx
              </p>
              <p className="text-xs" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                Admin Console
              </p>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 h-11 px-4 rounded-xl transition-all duration-150 group',
                  isActive ? '' : 'hover:opacity-80'
                )}
                style={isActive
                  ? { backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary)' }
                  : { color: 'var(--color-muted-foreground)' }}
              >
                {/* Active indicator stripe */}
                <div className="w-1 h-5 rounded-full flex-shrink-0 transition-all"
                  style={{ backgroundColor: isActive ? 'var(--color-primary)' : 'transparent' }} />
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-medium" style={{ fontFamily: 'var(--font-body)' }}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom: theme + logout */}
        <div className="px-3 py-4 space-y-2" style={{ borderTop: '1px solid var(--color-surface-high)' }}>
          <div>
            <label htmlFor="cb-theme"
              className="px-1 pb-1 block text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
              Theme
            </label>
            <select
              id="cb-theme"
              suppressHydrationWarning
              value={theme ?? 'system'}
              onChange={(e) => { setTheme(e.target.value); }}
              className="w-full h-9 rounded-xl px-3 text-sm transition-colors focus:outline-none"
              style={{
                border: 'none',
                backgroundColor: 'var(--color-surface-high)',
                color: 'var(--color-foreground)',
                fontFamily: 'var(--font-body)',
              }}
            >
              <option value="system">Auto</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
          <button
            onClick={() => { setLogoutDialogOpen(true); }}
            className="flex items-center gap-3 w-full h-11 px-4 rounded-xl transition-colors hover:opacity-80"
            style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </aside>

      <Dialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
            <DialogDescription>
              You&apos;ll need to enter the admin token again to access the console.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3">
            <Button variant="outline" onClick={() => { setLogoutDialogOpen(false); }}>Cancel</Button>
            <Button variant="destructive" onClick={() => { void handleLogout(); }}>Logout</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
