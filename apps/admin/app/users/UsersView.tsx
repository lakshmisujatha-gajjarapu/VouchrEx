'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminUser } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
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

export default function UsersView({ users }: UsersViewProps) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<{ user: AdminUser; action: 'suspend' | 'reactivate' } | null>(null);
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
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg font-medium">No users found</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {['Name', 'Phone', 'Tier', 'Trust Score', 'Status', 'Joined', ''].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium">{u.name ?? '—'}</td>
                <td className="px-4 py-3">{formatPhone(u.phone)}</td>
                <td className="px-4 py-3">
                  <span className="text-xs font-medium uppercase tracking-wide">{u.tier}</span>
                </td>
                <td className="px-4 py-3 tabular-nums">{u.trustScore}</td>
                <td className="px-4 py-3">
                  <Badge
                    variant={
                      u.status === 'ACTIVE'
                        ? 'success'
                        : u.status === 'SUSPENDED'
                        ? 'destructive'
                        : 'secondary'
                    }
                  >
                    {u.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {formatDate(u.createdAt)}
                </td>
                <td className="px-4 py-3">
                  {u.status === 'ACTIVE' ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setConfirm({ user: u, action: 'suspend' })}
                    >
                      Suspend
                    </Button>
                  ) : u.status === 'SUSPENDED' ? (
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => setConfirm({ user: u, action: 'reactivate' })}
                    >
                      Reactivate
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirm && (
        <Dialog open onOpenChange={() => setConfirm(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {confirm.action === 'suspend' ? 'Suspend User' : 'Reactivate User'}
              </DialogTitle>
              <DialogDescription>
                {confirm.action === 'suspend'
                  ? `Are you sure you want to suspend ${formatPhone(confirm.user.phone)}? All their sessions will be invalidated.`
                  : `Are you sure you want to reactivate ${formatPhone(confirm.user.phone)}?`}
              </DialogDescription>
            </DialogHeader>
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {error}
              </p>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setConfirm(null)} disabled={isPending}>
                Cancel
              </Button>
              <Button
                variant={confirm.action === 'suspend' ? 'destructive' : 'success'}
                onClick={handleAction}
                disabled={isPending}
              >
                {isPending ? 'Processing…' : confirm.action === 'suspend' ? 'Suspend' : 'Reactivate'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
