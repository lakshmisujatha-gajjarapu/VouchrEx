'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Dispute, DisputePartyUser } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatShortId, getRelativeTime, formatPhone } from '@/lib/utils';
import { DisputeTimeline } from '@/components/dispute-timeline';
import { BuyerHistoryPanel } from '@/components/buyer-history-panel';

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

function PartyCard({ role, user }: { readonly role: 'Buyer' | 'Seller'; readonly user: DisputePartyUser }) {
  return (
    <div className="rounded-xl p-3 space-y-2" style={{ backgroundColor: 'var(--color-surface-raised)' }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>{role}</p>
        <span className="status-badge" style={{ backgroundColor: 'var(--color-surface-high)', color: 'var(--color-muted-foreground)' }}>{user.tier}</span>
      </div>
      <div>
        <p className="font-semibold" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>
          {user.name ?? 'Unnamed'}
        </p>
        <p className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-muted-foreground)' }}>
          {formatShortId(user.id)}
        </p>
      </div>
      <div className="text-xs space-y-0.5" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>
        <p>{formatPhone(user.phone)}</p>
        {user.email && <p style={{ color: 'var(--color-muted-foreground)' }}>{user.email}</p>}
      </div>
      <div className="grid grid-cols-4 gap-2 pt-1 text-xs" style={{ fontFamily: 'var(--font-body)' }}>
        <div>
          <p style={{ color: 'var(--color-muted-foreground)' }}>Trust</p>
          <p style={{ color: 'var(--color-foreground)' }}>{user.trustScore}</p>
        </div>
        <div>
          <p style={{ color: 'var(--color-muted-foreground)' }}>Disputes</p>
          <p style={{ color: 'var(--color-foreground)' }}>{user.disputeCount}</p>
        </div>
        <div>
          <p style={{ color: 'var(--color-muted-foreground)' }}>Sales</p>
          <p style={{ color: 'var(--color-foreground)' }}>{user.totalSales}</p>
        </div>
        <div>
          <p style={{ color: 'var(--color-muted-foreground)' }}>Strikes</p>
          <p style={{ color: ((role === 'Seller' ? user.sellerStrikes : user.buyerStrikes) ?? 0) >= 1 ? 'var(--color-destructive)' : 'var(--color-foreground)' }}>
            {(role === 'Seller' ? user.sellerStrikes : user.buyerStrikes) ?? 0}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs pt-1" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-muted-foreground)' }}>
        <span>Status: <span style={{ color: 'var(--color-foreground)' }}>{user.status}</span></span>
        <span>Joined {getRelativeTime(user.createdAt)}</span>
      </div>
      {user.payoutAccount && (
        <div className="text-xs pt-1" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-muted-foreground)' }}>
          KYC: <span style={{ color: 'var(--color-foreground)' }}>{user.payoutAccount.kycStatus}</span>
          {user.payoutAccount.upiId && <> · UPI: <span style={{ color: 'var(--color-foreground)' }}>{user.payoutAccount.upiId}</span></>}
        </div>
      )}
    </div>
  );
}

interface DisputesViewProps {
  disputes: Dispute[];
}

function statusStyle(status: string): { bg: string; color: string } {
  if (status === 'OPEN')         return { bg: 'var(--color-destructive-soft)', color: 'var(--color-destructive)' };
  if (status === 'UNDER_REVIEW') return { bg: 'var(--color-warning-soft)',     color: 'var(--color-warning)' };
  if (status === 'RESOLVED')     return { bg: 'var(--color-success-soft)',     color: 'var(--color-success)' };
  return                                { bg: 'var(--color-surface-high)',      color: 'var(--color-muted-foreground)' };
}

export default function DisputesView({ disputes }: DisputesViewProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [evidenceUrls, setEvidenceUrls] = useState<string[] | null>(null);
  const [loadingEvidence, setLoadingEvidence] = useState(false);

  useEffect(() => {
    setEvidenceUrls(null);
    if (!selected || selected.evidenceUrls.length === 0) return;
    setLoadingEvidence(true);
    void fetch(`/api/disputes/${selected.id}/evidence-url`)
      .then((r) => r.json())
      .then((data: { signedUrls: string[] }) => { setEvidenceUrls(data.signedUrls); })
      .catch(() => { setEvidenceUrls([]); })
      .finally(() => { setLoadingEvidence(false); });
  }, [selected?.id]);

  const resolve = (resolution: 'RELEASE_TO_SELLER' | 'REFUND_BUYER') => {
    if (!selected) return;
    setError('');

    startTransition(async () => {
      try {
        const res = await fetch(`/api/disputes/${selected.id}/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolution }),
        });

        if (!res.ok) {
          const d = (await res.json()) as { error?: string };
          setError(d.error ?? 'Failed to resolve dispute.');
          return;
        }

        setSelected(null);
        router.refresh();
      } catch {
        setError('Network error. Please try again.');
      }
    });
  };

  if (disputes.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-lg font-semibold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-foreground)' }}>
          No disputes found
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
          All disputes have been resolved.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--color-card)', boxShadow: '0 0 40px rgba(26,27,33,0.06)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--color-surface-raised)' }}>
                {['ID', 'Brand', 'Buyer', 'Seller', 'Reason', 'Seller Resp.', 'Age', 'Status', ''].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest whitespace-nowrap"
                    style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {disputes.map((d) => {
                const s = statusStyle(d.status);
                return (
                  <tr key={d.id} className="transition-colors hover:opacity-90"
                    style={{ borderTop: '1px solid var(--color-surface-high)' }}>
                    <td className="px-5 py-3.5 text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-muted-foreground)' }}>
                      {formatShortId(d.id)}
                    </td>
                    <td className="px-5 py-3.5 font-medium" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>
                      {d.order.listing.brand.name}
                    </td>
                    <td className="px-5 py-3.5" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>
                      {formatPhone(d.order.buyer.phone)}
                    </td>
                    <td className="px-5 py-3.5" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>
                      {formatPhone(d.order.seller.phone)}
                    </td>
                    <td className="px-5 py-3.5 max-w-[180px] truncate" title={d.reason}
                      style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>
                      {d.reason}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {d.sellerResponse ? (
                        <span className="font-bold" style={{ color: 'var(--color-success)' }}>✓</span>
                      ) : (
                        <span style={{ color: 'var(--color-muted-foreground)' }}>✗</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                      {getRelativeTime(d.createdAt)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="status-badge" style={{ backgroundColor: s.bg, color: s.color }}>
                        {d.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => { setSelected(d); }}
                        className="rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors"
                        style={{ backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary)', fontFamily: 'var(--font-body)' }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <Dialog open onOpenChange={() => { setSelected(null); }}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col gap-0 p-0">
            <DialogHeader className="px-6 pt-6 pb-4 border-b" style={{ borderColor: 'var(--color-surface-high)' }}>
              <DialogTitle style={{ fontFamily: 'var(--font-headline)', fontWeight: 800 }}>
                Dispute {formatShortId(selected.id)}
              </DialogTitle>
              <DialogDescription style={{ fontFamily: 'var(--font-body)' }}>
                Review the dispute details and resolve.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-sm overflow-y-auto px-6 py-4 flex-1 min-h-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <PartyCard role="Buyer" user={selected.order.buyer} />
                <PartyCard role="Seller" user={selected.order.seller} />
              </div>

              <BuyerHistoryPanel
                purchases={selected.order.buyer._count?.purchases ?? 0}
                disputesRaised={selected.order.buyer._count?.disputes ?? 0}
                buyerStrikes={selected.order.buyer.buyerStrikes ?? 0}
              />

              <DisputeTimeline
                orderCreatedAt={selected.order.createdAt}
                codeRevealedAt={selected.order.codeRevealedAt}
                disputeRaisedAt={selected.createdAt}
                verificationDeadline={selected.order.verificationDeadline}
              />

              <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-surface-raised)' }}>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>Brand &amp; Order</p>
                <p className="font-medium" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>{selected.order.listing.brand.name}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>Order {formatShortId(selected.orderId)}</p>
              </div>

              <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-surface-raised)' }}>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>Buyer&apos;s Reason</p>
                <p className="font-medium" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>{selected.reason}</p>
              </div>

              {selected.evidenceUrls.length > 0 && (
                <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-surface-raised)' }}>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>Evidence</p>
                  {loadingEvidence ? (
                    <div className="space-y-2">
                      {selected.evidenceUrls.map((_, i) => (
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
                            style={{ maxHeight: 300 }}
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {selected.sellerResponse && (
                <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-surface-raised)' }}>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>Seller&apos;s Response</p>
                  <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>{selected.sellerResponse}</p>
                </div>
              )}

              {selected.resolution && (
                <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-success-soft)' }}>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-success)', fontFamily: 'var(--font-body)' }}>Resolution</p>
                  <p className="font-semibold" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-success)' }}>
                    {selected.resolution === 'REFUND_BUYER' ? 'Buyer refunded' : 'Released to seller'}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3">
                {(() => { const s = statusStyle(selected.status); return (
                  <span className="status-badge" style={{ backgroundColor: s.bg, color: s.color }}>
                    {selected.status.replace('_', ' ')}
                  </span>
                ); })()}
                <span className="text-xs" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                  Opened {getRelativeTime(selected.createdAt)}
                </span>
              </div>

              {selected.status !== 'RESOLVED' && (() => {
                const nextSellerStrike = (selected.order.seller.sellerStrikes ?? 0) + 1;
                const nextBuyerStrike = (selected.order.buyer.buyerStrikes ?? 0) + 1;
                return (
                  <div className="rounded-xl px-4 py-3 text-xs space-y-1.5" style={{ backgroundColor: 'var(--color-surface-raised)', color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                    <p>
                      <strong style={{ color: 'var(--color-destructive)' }}>Refund Buyer</strong> → seller strike {nextSellerStrike}: -{strikeDelta(nextSellerStrike)} score, payout {strikeHoldLabel(nextSellerStrike)}. Buyer is refunded via Razorpay (5–7 working days).
                    </p>
                    <p>
                      <strong style={{ color: 'var(--color-success)' }}>Release to Seller</strong> → buyer strike {nextBuyerStrike}: -{strikeDelta(nextBuyerStrike)} score. Seller receives ₹{selected.order.sellerPayout}.
                    </p>
                  </div>
                );
              })()}

              {error && (
                <p className="rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: 'var(--color-destructive-soft)', color: 'var(--color-destructive)', fontFamily: 'var(--font-body)' }}>
                  {error}
                </p>
              )}
            </div>

            <DialogFooter className="gap-2 px-6 py-4 border-t" style={{ borderColor: 'var(--color-surface-high)' }}>
              <Button variant="outline" onClick={() => { setSelected(null); }} disabled={isPending}>
                {selected.status === 'RESOLVED' ? 'Close' : 'Cancel'}
              </Button>
              {selected.status !== 'RESOLVED' && (
                <>
                  <Button
                    variant="destructive"
                    onClick={() => { resolve('REFUND_BUYER'); }}
                    disabled={isPending}
                  >
                    Refund Buyer
                  </Button>
                  <Button
                    variant="success"
                    onClick={() => { resolve('RELEASE_TO_SELLER'); }}
                    disabled={isPending}
                  >
                    Release to Seller
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
