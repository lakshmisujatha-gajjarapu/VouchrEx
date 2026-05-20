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
  if (strikeNumber === 1) return 10;
  if (strikeNumber === 2) return 20;
  return 30;
}

function strikeHoldLabel(strikeNumber: number): string {
  if (strikeNumber === 1) return 'held 3 days';
  if (strikeNumber === 2) return 'held 7 days';
  return 'held 14 days';
}

export function DisputeActions({ dispute }: DisputeActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [evidenceUrls, setEvidenceUrls] = useState<string[] | null>(null);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [noFaultConfirm, setNoFaultConfirm] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');

  useEffect(() => {
    if (dispute.evidenceUrls.length === 0) return;
    setLoadingEvidence(true);
    void clientFetch(`/api/disputes/${dispute.id}/evidence-url`)
      .then((r) => r.json())
      .then((data: { signedUrls: string[] }) => { setEvidenceUrls(data.signedUrls); })
      .catch(() => { setEvidenceUrls([]); })
      .finally(() => { setLoadingEvidence(false); });
  }, [dispute.id, dispute.evidenceUrls.length]);

  const resolve = (resolution: 'RELEASE_TO_SELLER' | 'REFUND_BUYER' | 'NO_FAULT', notes?: string) => {
    setError('');
    startTransition(async () => {
      try {
        const res = await clientFetch(`/api/disputes/${dispute.id}/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolution, adminNotes: notes }),
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
      {/* Evidence + Seller response — two column layout */}
      {(dispute.evidenceUrls.length > 0 || dispute.sellerResponse !== undefined) && (
        <section className="rounded-2xl p-6 space-y-4" style={{ backgroundColor: 'var(--color-card)', boxShadow: '0 0 40px rgba(26,27,33,0.06)' }}>
          <div className="grid grid-cols-2 gap-6">
            {/* Buyer evidence */}
            <div className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>Buyer Evidence</h2>
              {dispute.evidenceUrls.length === 0 ? (
                <p className="text-sm italic" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>No screenshots attached.</p>
              ) : loadingEvidence ? (
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
            </div>

            {/* Seller response */}
            <div className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>Seller Response</h2>
              {dispute.sellerResponse ? (
                <div className="space-y-2">
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--color-foreground)', fontFamily: 'var(--font-body)' }}>
                    {dispute.sellerResponse}
                  </p>
                  {dispute.sellerRespondedAt && (
                    <p className="text-xs" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                      Submitted {new Date(dispute.sellerRespondedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm italic" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>Seller has not responded.</p>
              )}
            </div>
          </div>
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
            <p>
              <strong style={{ color: 'var(--color-warning, #b45309)' }}>No Fault</strong> → buyer refunded, seller takes no penalty. Use only for brand or platform failures.
            </p>
          </div>
          {error && (
            <p className="rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: 'var(--color-destructive-soft)', color: 'var(--color-destructive)', fontFamily: 'var(--font-body)' }}>
              {error}
            </p>
          )}

          {/* No Fault confirmation dialog */}
          {noFaultConfirm && (
            <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-raised)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--color-foreground)', fontFamily: 'var(--font-body)' }}>
                Buyer will be fully refunded. Seller takes no penalty. Only use this for brand or platform failures.
              </p>
              <textarea
                className="w-full text-sm rounded-lg border px-3 py-2 resize-none"
                placeholder="Admin notes (optional — recorded in audit log)"
                rows={3}
                maxLength={2000}
                value={adminNotes}
                onChange={(e) => { setAdminNotes(e.target.value); }}
                style={{ fontFamily: 'var(--font-body)', backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => { resolve('NO_FAULT', adminNotes || undefined); }}
                  disabled={isPending}
                  style={{ backgroundColor: '#b45309', color: 'white' }}
                >
                  {isPending ? 'Processing…' : 'Confirm No Fault'}
                </Button>
                <Button variant="outline" onClick={() => { setNoFaultConfirm(false); setAdminNotes(''); }} disabled={isPending}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {!noFaultConfirm && (
            <div className="flex gap-3 flex-wrap">
              <Button variant="destructive" onClick={() => { resolve('REFUND_BUYER'); }} disabled={isPending}>
                {isPending ? 'Processing…' : 'Refund Buyer'}
              </Button>
              <Button variant="success" onClick={() => { resolve('RELEASE_TO_SELLER'); }} disabled={isPending}>
                {isPending ? 'Processing…' : 'Release to Seller'}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setNoFaultConfirm(true); }}
                disabled={isPending}
                style={{ borderColor: '#b45309', color: '#b45309' }}
              >
                No Fault — Refund Buyer
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
