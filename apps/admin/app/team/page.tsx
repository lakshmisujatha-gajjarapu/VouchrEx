import { getTeam, getMe } from '@/lib/api';
import TeamView from './team-view';
import TableToolbar from '@/components/table-toolbar';
import { redirect } from 'next/navigation';
import { ROUTES } from '@/lib/routes';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Team | VouchrEx Admin' };

const SEARCH_KEYS = [
  { value: 'name',  label: 'Name',  placeholder: 'Name contains…' },
  { value: 'email', label: 'Email', placeholder: 'Email contains…' },
] as const;

interface PageProps {
  searchParams: Promise<{ q?: string; qBy?: string; page?: string; pageSize?: string }>;
}

export default async function TeamPage({ searchParams }: PageProps) {
  const me = await getMe();

  // Only SUPER_ADMIN can access this page
  if (me.role !== 'SUPER_ADMIN') {
    redirect(ROUTES.DASHBOARD);
  }

  const sp = await searchParams;
  const q = sp.q ?? '';
  const qBy = sp.qBy ?? '';
  const pageNum = Number.parseInt(sp.page ?? '1', 10) || 1;
  const pageSize = Number.parseInt(sp.pageSize ?? '25', 10) || 25;

  const { data: team, total, page, pageSize: ps } = await getTeam({ q, qBy, page: pageNum, pageSize });

  return (
    <div className="p-8 animate-slide-up">
      <header className="mb-8">
        <h1 style={{ fontFamily: 'var(--font-headline)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--color-foreground)', marginBottom: '0.25rem' }}>
          Team
        </h1>
        <p style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)', fontSize: '0.9375rem' }}>
          {total} admin {total === 1 ? 'member' : 'members'}
        </p>
      </header>

      <TableToolbar
        basePath="/team"
        total={total}
        page={page}
        pageSize={ps}
        q={q}
        qBy={qBy}
        searchKeys={SEARCH_KEYS}
      />

      <TeamView team={team} currentAdminId={me.id} />
    </div>
  );
}
