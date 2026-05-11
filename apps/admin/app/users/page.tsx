import { getUsers } from '@/lib/api';
import UsersView from './users-view';
import TableToolbar from '@/components/table-toolbar';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Users | VouchrEx Admin' };

const TABS = [
  { label: 'All',       value: undefined },
  { label: 'Active',    value: 'ACTIVE' },
  { label: 'Suspended', value: 'SUSPENDED' },
] as const;

function tabHref(status: string | undefined, currentQ: string): string {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (currentQ) params.set('q', currentQ);
  const qs = params.toString();
  return qs ? `/users?${qs}` : '/users';
}

const SEARCH_KEYS = [
  { value: 'phone', label: 'Phone', placeholder: '+91…' },
  { value: 'name',  label: 'Name',  placeholder: 'Name contains…' },
  { value: 'email', label: 'Email', placeholder: 'Email contains…' },
] as const;

interface PageProps {
  searchParams: Promise<{ status?: string; q?: string; qBy?: string; page?: string; pageSize?: string }>;
}

export default async function UsersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const status = sp.status;
  const q = sp.q ?? '';
  const qBy = sp.qBy ?? '';
  const pageNum = Number.parseInt(sp.page ?? '1', 10) || 1;
  const pageSize = Number.parseInt(sp.pageSize ?? '25', 10) || 25;

  const { data: users, total, page, pageSize: ps } = await getUsers({ status, q, qBy, page: pageNum, pageSize });

  return (
    <div className="p-8 animate-slide-up">
      <header className="mb-8">
        <h1 style={{ fontFamily: 'var(--font-headline)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--color-foreground)', marginBottom: '0.25rem' }}>
          Users
        </h1>
        <p style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)', fontSize: '0.9375rem' }}>
          {total} users
        </p>
      </header>

      <div className="flex gap-2 mb-6">
        {TABS.map((tab) => {
          const active = status === tab.value;
          return (
            <a
              key={tab.label}
              href={tabHref(tab.value, q)}
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

      <TableToolbar
        basePath="/users"
        total={total}
        page={page}
        pageSize={ps}
        q={q}
        qBy={qBy}
        searchKeys={SEARCH_KEYS}
      />

      <UsersView users={users} />
    </div>
  );
}
