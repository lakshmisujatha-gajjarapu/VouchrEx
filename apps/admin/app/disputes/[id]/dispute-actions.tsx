'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Dispute } from '@/lib/types';
import { clientFetch } from '@/lib/client-fetch';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';

interface DisputeActionsProps {
  dispute: Dispute;
}

function strikeDelta(strikeNumber: number): number {
  if (strikeNumber === 1) return 15;
  if (strikeNumber === 2) return 25;
  return 40;
}

function strikeHoldLabel(strikeNumber: number): string {
  if (strikeNumber === 1) return 'held 7 days';
  if (strikeNumber === 2) return 'held 14 days';
  return 'held indefinitely';
}

export function DisputeActions({ dispute }: DisputeActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [evidenceUrls, setEvidenceUrls] = useState<string[] | null>(null);
  const [loadingEvidence, setLoadingEvidence] = useState(false);

  useEffect(() => {
    if (dispute.evidenceUrls.length === 0) return;
    setLoadingEvidence(true);
    void clientFetch(`/api/disputes/${dispute.id}/evidence-url`)
      .then((r) => r.json())
      .then((data: { signedUrls: string[] }) => { setEvidenceUrls(data.signedUrls); })
      .catch(() => { setEvidenceUrls([]); })
      .finally(() => { setLoadingEvidence(false); });
  }, [dispute.id, dispute.evidenceUrls.length]);

  const resolve = (resolution: 'RELEASE_TO_SELLER' | 'REFUND_BUYER') => {
    setError('');
    startTransition(async () => {
      try {
        const res = await clientFetch(`/api/disputes/${dispute.id}/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolution }),
        });
        if (!res.ok) {
          const d = (await res.json()) as { error?: string };
          setError(d.error ?? 'Failed to resolve dispute.');
          return;
        }
        router.push('/disputes');
      } catch {
        setError('Network error. Please try again.');
      }
    });
  };

  const nextSellerStrike = (dispute.order.seller.sellerStrikes ?? 0) + 1;
  const nextBuyerStrike = (dispute.order.buyer.buyerStrikes ?? 0) + 1;

  return (
    <div className="space-y-4">
      {/* Evidence */}
      {dispute.evidenceUrls.length > 0 && (
        <section className="rounded-2xl p-6 space-y-4" style={{ backgroundColor: 'var(--color-card)', boxShadow: '0 0 40px rgba(26,27,33,0.06)' }}>
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>Evidence</h2>
          {loadingEvidence ? (
            <div className="space-y-2">
              {dispute.evidenceUrls.map((_, i) => (
                <div key={i} className="h-48 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-surface-high)' }} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {(evidenceUrls ?? []).map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer">
                  <img
                    src={url}
                    alt={`Evidence ${String(i + 1)}`}
                    className="w-full rounded-lg object-contain"
                    style={{ maxHeight: 320 }}
                  />
                </a>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Strike impact + resolve actions */}
      {dispute.status !== 'RESOLVED' && (
        <section className="rounded-2xl p-6 space-y-4" style={{ backgroundColor: 'var(--color-card)', boxShadow: '0 0 40px rgba(26,27,33,0.06)' }}>
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>Resolve</h2>
          <div className="rounded-xl px-4 py-3 text-xs space-y-1.5" style={{ backgroundColor: 'var(--color-surface-raised)', color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
            <p>
              <strong style={{ color: 'var(--color-destructive)' }}>Refund Buyer</strong> → seller strike {nextSellerStrike}: -{strikeDelta(nextSellerStrike)} score, payout {strikeHoldLabel(nextSellerStrike)}. Buyer is refunded via Razorpay (5–7 working days).
            </p>
            <p>
              <strong style={{ color: 'var(--color-success)' }}>Release to Seller</strong> → buyer strike {nextBuyerStrike}: -{strikeDelta(nextBuyerStrike)} score. Seller receives {formatCurrency(dispute.order.sellerPayout)}.
            </p>
          </div>
          {error && (
            <p className="rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: 'var(--color-destructive-soft)', color: 'var(--color-destructive)', fontFamily: 'var(--font-body)' }}>
              {error}
            </p>
          )}
          <div className="flex gap-3">
            <Button variant="destructive" onClick={() => { resolve('REFUND_BUYER'); }} disabled={isPending}>
              {isPending ? 'Processing…' : 'Refund Buyer'}
            </Button>
            <Button variant="success" onClick={() => { resolve('RELEASE_TO_SELLER'); }} disabled={isPending}>
              {isPending ? 'Processing…' : 'Release to Seller'}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
