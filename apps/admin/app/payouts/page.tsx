import { getPendingPayouts } from '@/lib/api';
import PayoutsView from './payouts-view';
import TableToolbar from '@/components/table-toolbar';
import { formatCurrency } from '@/lib/utils';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Payouts | VouchrEx Admin' };

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

export default async function PayoutsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const q = sp.q ?? '';
  const qBy = sp.qBy ?? '';
  const pageNum = Number.parseInt(sp.page ?? '1', 10) || 1;
  const pageSize = Number.parseInt(sp.pageSize ?? '25', 10) || 25;

  const { data: payouts, total, page, pageSize: ps } = await getPendingPayouts({ q, qBy, page: pageNum, pageSize });

  const pageTotal = payouts.reduce((sum, p) => sum + p.sellerPayout, 0);

  return (
    <div className="animate-slide-up px-4 py-5 sm:px-6 md:p-8">
      <header className="mb-5 md:mb-8">
        <h1 className="text-[1.75rem] md:text-[2rem]" style={{ fontFamily: 'var(--font-headline)', fontWeight: 800, color: 'var(--color-foreground)', marginBottom: '0.25rem' }}>
          Pending Payouts
        </h1>
        <p style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)', fontSize: '0.9375rem' }}>
          {total} pending · {formatCurrency(pageTotal)} on this page
        </p>
      </header>

      <TableToolbar
        basePath="/payouts"
        total={total}
        page={page}
        pageSize={ps}
        q={q}
        qBy={qBy}
        searchKeys={SEARCH_KEYS}
      />

      <PayoutsView payouts={payouts} />
    </div>
  );
}
