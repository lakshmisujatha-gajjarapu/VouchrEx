import { getListings } from '@/lib/api';
import ListingsView from './listings-view';
import TableToolbar from '@/components/table-toolbar';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Listings | VouchrEx Admin' };

const STATUS_TABS = [
  { label: 'All',       status: undefined, verif: undefined },
  { label: 'Pending',   status: undefined, verif: 'PENDING' },
  { label: 'Active',    status: 'ACTIVE',  verif: undefined },
  { label: 'Sold',      status: 'SOLD',    verif: undefined },
] as const;

function tabHref(status: string | undefined, verif: string | undefined, currentQ: string, currentQBy: string): string {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (verif)  params.set('verificationStatus', verif);
  if (currentQ)   params.set('q', currentQ);
  if (currentQBy) params.set('qBy', currentQBy);
  const qs = params.toString();
  return qs ? `/listings?${qs}` : '/listings';
}

const SEARCH_KEYS = [
  { value: 'brand',       label: 'Brand',        placeholder: 'Brand name…' },
  { value: 'sellerPhone', label: 'Seller phone',  placeholder: '+91…' },
  { value: 'sellerName',  label: 'Seller name',   placeholder: 'Name contains…' },
] as const;

interface PageProps {
  searchParams: Promise<{
    status?: string;
    verificationStatus?: string;
    q?: string;
    qBy?: string;
    page?: string;
    pageSize?: string;
  }>;
}

export default async function ListingsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const status = sp.status;
  const verificationStatus = sp.verificationStatus;
  const q = sp.q ?? '';
  const qBy = sp.qBy ?? '';
  const pageNum = Number.parseInt(sp.page ?? '1', 10) || 1;
  const pageSize = Number.parseInt(sp.pageSize ?? '25', 10) || 25;

  const { data: listings, total, page, pageSize: ps } = await getListings({
    status,
    verificationStatus,
    q,
    qBy,
    page: pageNum,
    pageSize,
  });

  return (
    <div className="p-8 animate-slide-up">
      <header className="mb-8">
        <h1 style={{
          fontFamily: 'var(--font-headline)',
          fontSize: '2rem',
          fontWeight: 800,
          letterSpacing: '-0.04em',
          color: 'var(--color-foreground)',
          marginBottom: '0.25rem',
        }}>
          Listings
        </h1>
        <p style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)', fontSize: '0.9375rem' }}>
          {total} listing{total !== 1 ? 's' : ''}
        </p>
      </header>

      <div className="flex gap-2 mb-6">
        {STATUS_TABS.map((tab) => {
          const active = status === tab.status && verificationStatus === tab.verif;
          return (
            <a
              key={tab.label}
              href={tabHref(tab.status, tab.verif, q, qBy)}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              style={active
                ? { backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary)', fontFamily: 'var(--font-body)' }
                : { backgroundColor: 'var(--color-surface-high)', color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}
            >
              {tab.label}
            </a>
          );
        })}
      </div>

      <TableToolbar
        basePath="/listings"
        total={total}
        page={page}
        pageSize={ps}
        q={q}
        qBy={qBy}
        searchKeys={SEARCH_KEYS}
      />

      <ListingsView listings={listings} />
    </div>
  );
}
