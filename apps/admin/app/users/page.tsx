import { Users } from 'lucide-react';
import { getUsers } from '@/lib/api';
import UsersView from './UsersView';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Users | CouponBazaar Admin' };

const TABS = [
  { label: 'All', value: undefined },
  { label: 'Active', value: 'ACTIVE' },
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
      <header className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Users className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-muted-foreground text-sm">{users.length} users</p>
        </div>
      </header>

      <div className="flex gap-2 mb-6">
        {TABS.map((tab) => {
          const active = status === tab.value;
          return (
            <a
              key={tab.label}
              href={tab.value ? `?status=${tab.value}` : '/users'}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border border-border text-foreground hover:bg-muted'
              }`}
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
