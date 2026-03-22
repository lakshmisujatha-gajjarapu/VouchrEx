import { getUsers } from '@/lib/api';
import UsersView from './UsersView';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Users | CouponBazaar Admin' };

const TABS = [
  { label: 'All',       value: undefined },
  { label: 'Active',    value: 'ACTIVE' },
  { label: 'Suspended', value: 'SUSPENDED' },
] as const;

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function UsersPage({ searchParams }: PageProps) {
  const { status } = await searchParams;
  const users = await getUsers(status);

  return (
    <div className="p-8 animate-slide-up">
      <header className="mb-8">
        <h1 style={{ fontFamily: 'var(--font-headline)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--color-foreground)', marginBottom: '0.25rem' }}>
          Users
        </h1>
        <p style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)', fontSize: '0.9375rem' }}>
          {users.length} users
        </p>
      </header>

      <div className="flex gap-2 mb-6">
        {TABS.map((tab) => {
          const active = status === tab.value;
          return (
            <a
              key={tab.label}
              href={tab.value ? `?status=${tab.value}` : '/users'}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              style={active
                ? { backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary)', fontFamily: 'var(--font-body)' }
                : { backgroundColor: 'var(--color-surface-high)', color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }
              }
            >
              {tab.label}
            </a>
          );
        })}
      </div>

      <UsersView users={users} />
    </div>
  );
}
