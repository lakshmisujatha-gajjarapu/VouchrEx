'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminUser } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatPhone, formatDate } from '@/lib/utils';

interface UsersViewProps {
  users: AdminUser[];
}

type ActionType = 'suspend' | 'reactivate' | 'approve-kyc' | 'reject-kyc';

function statusStyle(status: string): { bg: string; color: string } {
  if (status === 'ACTIVE')    return { bg: 'var(--color-success-soft)',     color: 'var(--color-success)' };
  if (status === 'SUSPENDED') return { bg: 'var(--color-destructive-soft)', color: 'var(--color-destructive)' };
  return                             { bg: 'var(--color-surface-high)',      color: 'var(--color-muted-foreground)' };
}

function kycStyle(kycStatus: string): { bg: string; color: string } {
  if (kycStatus === 'VERIFIED') return { bg: 'var(--color-success-soft)',     color: 'var(--color-success)' };
  if (kycStatus === 'REJECTED') return { bg: 'var(--color-destructive-soft)', color: 'var(--color-destructive)' };
  return                               { bg: 'var(--color-surface-high)',      color: 'var(--color-muted-foreground)' };
}

function disputeRateStyle(rate: number): string {
  if (rate >= 0.3)  return 'var(--color-destructive)';
  if (rate >= 0.15) return 'var(--color-warning, #b45309)';
  return 'var(--color-muted-foreground)';
}

export default function UsersView({ users }: UsersViewProps) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<{ user: AdminUser; action: ActionType } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const handleAction = () => {
    if (!confirm) return;
    setError('');

    startTransition(async () => {
      try {
        const endpoint = `/api/users/${confirm.user.id}/${confirm.action}`;
        const res = await fetch(endpoint, { method: 'POST' });

        if (!res.ok) {
          const d = (await res.json()) as { error?: string };
          setError(d.error ?? 'Action failed.');
          return;
        }

        setConfirm(null);
        router.refresh();
      } catch {
        setError('Network error.');
      }
    });
  };

  if (users.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-lg font-semibold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-foreground)' }}>
          No users found
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
                {['Name', 'Phone', 'Tier', 'Sales', 'Disputes', 'Status', 'KYC', 'Joined', ''].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest whitespace-nowrap"
                    style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const s = statusStyle(u.status);
                const kyc = u.payoutAccount?.kycStatus;
                const ks = kyc ? kycStyle(kyc) : null;
                const rate = u.totalSales > 0 ? u.disputeCount / u.totalSales : 0;
                const rateColor = u.totalSales > 0 ? disputeRateStyle(rate) : 'var(--color-muted-foreground)';

                return (
                  <tr key={u.id} className="transition-opacity hover:opacity-90"
                    style={{ borderTop: '1px solid var(--color-surface-high)' }}>
                    <td className="px-5 py-3.5 font-medium" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>
                      {u.name ?? '—'}
                    </td>
                    <td className="px-5 py-3.5" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>
                      {formatPhone(u.phone)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-semibold uppercase tracking-wide"
                        style={{ fontFamily: 'var(--font-body)', color: 'var(--color-muted-foreground)' }}>
                        {u.tier}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-foreground)' }}>
                      {u.totalSales}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums">
                      <span style={{ fontFamily: 'var(--font-mono)', color: rateColor, fontWeight: rate >= 0.15 ? 700 : 400 }}>
                        {u.disputeCount}
                        {u.totalSales > 0 && (
                          <span style={{ fontSize: '0.7rem', marginLeft: 4 }}>
                            ({Math.round(rate * 100)}%)
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="status-badge" style={{ backgroundColor: s.bg, color: s.color }}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {ks && kyc ? (
                        <span className="status-badge" style={{ backgroundColor: ks.bg, color: ks.color }}>
                          {kyc}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)', fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                      {formatDate(u.createdAt)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1.5 items-center">
                        {/* Account suspend / reactivate */}
                        {u.status === 'ACTIVE' ? (
                          <button
                            onClick={() => { setConfirm({ user: u, action: 'suspend' }); }}
                            className="rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors"
                            style={{ backgroundColor: 'var(--color-destructive-soft)', color: 'var(--color-destructive)', fontFamily: 'var(--font-body)' }}
                          >
                            Suspend
                          </button>
                        ) : u.status === 'SUSPENDED' ? (
                          <button
                            onClick={() => { setConfirm({ user: u, action: 'reactivate' }); }}
                            className="rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors"
                            style={{ backgroundColor: 'var(--color-success-soft)', color: 'var(--color-success)', fontFamily: 'var(--font-body)' }}
                          >
                            Reactivate
                          </button>
                        ) : null}

                        {/* KYC approve / reject — only when payout account registered */}
                        {kyc === 'PENDING' && (
                          <>
                            <button
                              onClick={() => { setConfirm({ user: u, action: 'approve-kyc' }); }}
                              className="rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors"
                              style={{ backgroundColor: 'var(--color-success-soft)', color: 'var(--color-success)', fontFamily: 'var(--font-body)' }}
                            >
                              KYC ✓
                            </button>
                            <button
                              onClick={() => { setConfirm({ user: u, action: 'reject-kyc' }); }}
                              className="rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors"
                              style={{ backgroundColor: 'var(--color-destructive-soft)', color: 'var(--color-destructive)', fontFamily: 'var(--font-body)' }}
                            >
                              KYC ✗
                            </button>
                          </>
                        )}
                        {kyc === 'REJECTED' && (
                          <button
                            onClick={() => { setConfirm({ user: u, action: 'approve-kyc' }); }}
                            className="rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors"
                            style={{ backgroundColor: 'var(--color-success-soft)', color: 'var(--color-success)', fontFamily: 'var(--font-body)' }}
                          >
                            Re-approve KYC
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {confirm && (
        <Dialog open onOpenChange={() => { setConfirm(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle style={{ fontFamily: 'var(--font-headline)', fontWeight: 800 }}>
                {confirm.action === 'suspend'      ? 'Suspend User'
                : confirm.action === 'reactivate'  ? 'Reactivate User'
                : confirm.action === 'approve-kyc' ? 'Approve KYC'
                :                                    'Reject KYC'}
              </DialogTitle>
              <DialogDescription style={{ fontFamily: 'var(--font-body)' }}>
                {confirm.action === 'suspend'
                  ? `Suspend ${formatPhone(confirm.user.phone)}? All their sessions will be invalidated.`
                : confirm.action === 'reactivate'
                  ? `Reactivate ${formatPhone(confirm.user.phone)}?`
                : confirm.action === 'approve-kyc'
                  ? `Approve KYC for ${formatPhone(confirm.user.phone)}? They will receive automatic payouts after confirmed sales.`
                  : `Reject KYC for ${formatPhone(confirm.user.phone)}? Their payouts will remain blocked until re-approved.`}
              </DialogDescription>
            </DialogHeader>
            {error && (
              <p className="rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: 'var(--color-destructive-soft)', color: 'var(--color-destructive)', fontFamily: 'var(--font-body)' }}>
                {error}
              </p>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setConfirm(null); }} disabled={isPending}>
                Cancel
              </Button>
              <Button
                variant={
                  confirm.action === 'suspend' || confirm.action === 'reject-kyc'
                    ? 'destructive'
                    : 'success'
                }
                onClick={handleAction}
                disabled={isPending}
              >
                {isPending ? 'Processing…'
                  : confirm.action === 'suspend'      ? 'Suspend'
                  : confirm.action === 'reactivate'   ? 'Reactivate'
                  : confirm.action === 'approve-kyc'  ? 'Approve KYC'
                  :                                     'Reject KYC'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
