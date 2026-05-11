import { getDisputes } from '@/lib/api';
import DisputesView from './disputes-view';
import TableToolbar from '@/components/table-toolbar';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Disputes | VouchrEx Admin' };

const TABS = [
  { label: 'Open',         value: 'OPEN' },
  { label: 'Under Review', value: 'UNDER_REVIEW' },
  { label: 'Resolved',     value: 'RESOLVED' },
  { label: 'All Active',   value: undefined },
] as const;

function tabHref(status: string | undefined, currentQ: string): string {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (currentQ) params.set('q', currentQ);
  const qs = params.toString();
  return qs ? `/disputes?${qs}` : '/disputes';
}

const SEARCH_KEYS = [
  { value: 'id',          label: 'Dispute ID',    placeholder: 'Dispute id starts with…' },
  { value: 'orderId',     label: 'Order ID',      placeholder: 'Order id starts with…' },
  { value: 'buyerPhone',  label: 'Buyer phone',   placeholder: '+91…' },
  { value: 'buyerName',   label: 'Buyer name',    placeholder: 'Buyer name contains…' },
  { value: 'sellerPhone', label: 'Seller phone',  placeholder: '+91…' },
  { value: 'sellerName',  label: 'Seller name',   placeholder: 'Seller name contains…' },
] as const;

interface PageProps {
  searchParams: Promise<{ status?: string; q?: string; qBy?: string; page?: string; pageSize?: string }>;
}

export default async function DisputesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const status = sp.status;
  const q = sp.q ?? '';
  const qBy = sp.qBy ?? '';
  const pageNum = Number.parseInt(sp.page ?? '1', 10) || 1;
  const pageSize = Number.parseInt(sp.pageSize ?? '25', 10) || 25;

  const { data: disputes, total, page, pageSize: ps } = await getDisputes({ status, q, qBy, page: pageNum, pageSize });

  const label = status
    ? (TABS.find((t) => t.value === status)?.label ?? status)
    : 'open / under review';

  return (
    <div className="p-8 animate-slide-up">
      <header className="mb-8">
        <h1 style={{ fontFamily: 'var(--font-headline)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--color-foreground)', marginBottom: '0.25rem' }}>
          Disputes
        </h1>
        <p style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)', fontSize: '0.9375rem' }}>
          {total} {label}
        </p>
      </header>

      <div className="flex gap-2 mb-6 flex-wrap">
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
        basePath="/disputes"
        total={total}
        page={page}
        pageSize={ps}
        q={q}
        qBy={qBy}
        searchKeys={SEARCH_KEYS}
      />

      <DisputesView disputes={disputes} />
    </div>
  );
}
