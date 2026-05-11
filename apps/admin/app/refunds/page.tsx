import { getPendingRefunds } from '@/lib/api';
import RefundsView from './refunds-view';
import TableToolbar from '@/components/table-toolbar';
import { formatCurrency } from '@/lib/utils';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Refunds | VouchrEx Admin' };

const SEARCH_KEYS = [
  { value: 'id',          label: 'Order ID',     placeholder: 'Order id starts with…' },
  { value: 'buyerPhone',  label: 'Buyer phone',  placeholder: '+91…' },
  { value: 'buyerName',   label: 'Buyer name',   placeholder: 'Buyer name contains…' },
  { value: 'sellerPhone', label: 'Seller phone', placeholder: '+91…' },
  { value: 'sellerName',  label: 'Seller name',  placeholder: 'Seller name contains…' },
] as const;

interface PageProps {
  searchParams: Promise<{ q?: string; qBy?: string; page?: string; pageSize?: string }>;
}

export default async function RefundsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const q = sp.q ?? '';
  const qBy = sp.qBy ?? '';
  const pageNum = Number.parseInt(sp.page ?? '1', 10) || 1;
  const pageSize = Number.parseInt(sp.pageSize ?? '25', 10) || 25;

  const { data: refunds, total, page, pageSize: ps } = await getPendingRefunds({ q, qBy, page: pageNum, pageSize });

  const pageTotal = refunds.reduce((sum, r) => sum + r.payment.amount, 0);
  const failedCount = refunds.filter((r) => r.payment.refundStatus === 'FAILED').length;

  return (
    <div className="p-8 animate-slide-up">
      <header className="mb-8">
        <h1 style={{ fontFamily: 'var(--font-headline)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--color-foreground)', marginBottom: '0.25rem' }}>
          Pending Refunds
        </h1>
        <p style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)', fontSize: '0.9375rem' }}>
          {total} pending · {formatCurrency(pageTotal)} on this page
          {failedCount > 0 && (
            <>
              {' · '}
              <span style={{ color: 'var(--color-destructive)', fontWeight: 600 }}>
                {failedCount} failed (this page)
              </span>
            </>
          )}
        </p>
      </header>

      <TableToolbar
        basePath="/refunds"
        total={total}
        page={page}
        pageSize={ps}
        q={q}
        qBy={qBy}
        searchKeys={SEARCH_KEYS}
      />

      <RefundsView refunds={refunds} />
    </div>
  );
}
