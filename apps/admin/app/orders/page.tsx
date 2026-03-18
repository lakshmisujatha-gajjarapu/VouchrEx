import { ClipboardList } from 'lucide-react';
import { getOrders } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { formatShortId, formatCurrency, formatDate, formatPhone } from '@/lib/utils';
import type { Metadata } from 'next';
import type { Order } from '@/lib/types';

export const metadata: Metadata = { title: 'Orders | CouponBazaar Admin' };

const TABS = [
  { label: 'All', value: undefined },
  { label: 'Escrow Active', value: 'ESCROW_ACTIVE' },
  { label: 'Disputed', value: 'DISPUTED' },
  { label: 'Cancelled', value: 'CANCELLED' },
] as const;

function statusVariant(status: string): 'warning' | 'default' | 'destructive' | 'secondary' | 'success' {
  if (status === 'ESCROW_ACTIVE') return 'warning';
  if (status === 'DISPUTED') return 'destructive';
  if (status === 'CONFIRMED') return 'success';
  if (status === 'CANCELLED') return 'secondary';
  return 'default';
}

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function OrdersPage({ searchParams }: PageProps) {
  const { status } = await searchParams;
  const orders: Order[] = await getOrders(status);

  return (
    <div className="p-8 animate-slide-up">
      <header className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <ClipboardList className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-muted-foreground text-sm">{orders.length} orders</p>
        </div>
      </header>

      {/* Tab bar */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map((tab) => {
          const active = status === tab.value;
          return (
            <a
              key={tab.label}
              href={tab.value ? `?status=${tab.value}` : '/orders'}
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

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {['ID', 'Brand', 'Buyer', 'Amount', 'Status', 'Created'].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-muted-foreground">
                  No orders found.
                </td>
              </tr>
            )}
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs">{formatShortId(o.id)}</td>
                <td className="px-4 py-3 font-medium">{o.listing?.brand?.name ?? '—'}</td>
                <td className="px-4 py-3">{formatPhone(o.buyer?.phone ?? '')}</td>
                <td className="px-4 py-3 tabular-nums">
                  {o.payment ? formatCurrency(o.payment.amount) : '—'}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant(o.status)}>{o.status}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {formatDate(o.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
