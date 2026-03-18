import { MessageSquareWarning } from 'lucide-react';
import { getDisputes } from '@/lib/api';
import DisputesView from './DisputesView';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Disputes | CouponBazaar Admin' };

export default async function DisputesPage() {
  const disputes = await getDisputes();

  return (
    <div className="p-8 animate-slide-up">
      <header className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <MessageSquareWarning className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Disputes</h1>
          <p className="text-muted-foreground text-sm">
            {disputes.length} open / under review
          </p>
        </div>
      </header>

      <DisputesView disputes={disputes} />
    </div>
  );
}
