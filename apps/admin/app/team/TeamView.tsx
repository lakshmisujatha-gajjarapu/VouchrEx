'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminTeamMember } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDate } from '@/lib/utils';

interface TeamViewProps {
  team: AdminTeamMember[];
  currentAdminId: string | null;
}

const inputStyle = {
  width: '100%', height: '2.75rem', borderRadius: '0.75rem', padding: '0 0.875rem',
  fontSize: '0.875rem', border: 'none', outline: 'none',
  backgroundColor: 'var(--color-surface-high)', color: 'var(--color-foreground)',
  fontFamily: 'var(--font-body)',
} as const;

export default function TeamView({ team, currentAdminId }: TeamViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'ADMIN' | 'SUPER_ADMIN'>('ADMIN');

  // Set password dialog
  const [pwMember, setPwMember] = useState<AdminTeamMember | null>(null);
  const [newPw, setNewPw] = useState('');

  // Deactivate/activate confirm
  const [toggleMember, setToggleMember] = useState<AdminTeamMember | null>(null);

  const reset = () => { setNewName(''); setNewEmail(''); setNewPassword(''); setNewRole('ADMIN'); setError(''); };

  const handleCreate = () => {
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      setError('All fields are required.');
      return;
    }
    setError('');
    startTransition(async () => {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), email: newEmail.trim(), password: newPassword, role: newRole }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setError(data.error ?? 'Failed to create user.'); return; }
      setCreateOpen(false);
      reset();
      router.refresh();
    });
  };

  const handleSetPassword = () => {
    if (!newPw.trim()) { setError('Password is required.'); return; }
    if (!pwMember) return;
    setError('');
    startTransition(async () => {
      const res = await fetch(`/api/team/${pwMember.id}/set-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPw }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setError(data.error ?? 'Failed.'); return; }
      setPwMember(null);
      setNewPw('');
      router.refresh();
    });
  };

  const handleToggle = () => {
    if (!toggleMember) return;
    setError('');
    const endpoint = toggleMember.active
      ? `/api/team/${toggleMember.id}/deactivate`
      : `/api/team/${toggleMember.id}/activate`;
    startTransition(async () => {
      const res = await fetch(endpoint, { method: 'POST' });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setError(data.error ?? 'Failed.'); return; }
      setToggleMember(null);
      router.refresh();
    });
  };

  return (
    <>
      <div className="flex justify-end mb-6">
        <Button variant="default" onClick={() => { reset(); setCreateOpen(true); }}>
          + New User
        </Button>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--color-card)', boxShadow: '0 0 40px rgba(26,27,33,0.06)' }}>
        {team.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-lg font-semibold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-foreground)' }}>
              No users yet
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-raised)' }}>
                  {['Name', 'Email', 'Role', 'Status', 'Created', ''].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest whitespace-nowrap"
                      style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {team.map((m) => (
                  <tr key={m.id} style={{ borderTop: '1px solid var(--color-surface-high)' }}>
                    <td className="px-5 py-3.5 font-medium" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>
                      {m.name} {m.id === currentAdminId && <span className="text-xs ml-1" style={{ color: 'var(--color-muted-foreground)' }}>(you)</span>}
                    </td>
                    <td className="px-5 py-3.5" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>{m.email}</td>
                    <td className="px-5 py-3.5">
                      <span className="status-badge" style={m.role === 'SUPER_ADMIN'
                        ? { backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary)' }
                        : { backgroundColor: 'var(--color-surface-high)', color: 'var(--color-muted-foreground)' }}>
                        {m.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="status-badge" style={m.active
                        ? { backgroundColor: 'var(--color-success-soft)', color: 'var(--color-success)' }
                        : { backgroundColor: 'var(--color-surface-high)', color: 'var(--color-muted-foreground)' }}>
                        {m.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                      {formatDate(m.createdAt)}
                    </td>
                    <td className="px-5 py-3.5">
                      {m.id !== currentAdminId && (
                        <div className="flex gap-1.5">
                          <button onClick={() => { setPwMember(m); setNewPw(''); setError(''); }}
                            className="rounded-xl px-3 py-1.5 text-xs font-semibold"
                            style={{ backgroundColor: 'var(--color-surface-high)', color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                            Set Password
                          </button>
                          <button onClick={() => { setToggleMember(m); setError(''); }}
                            className="rounded-xl px-3 py-1.5 text-xs font-semibold"
                            style={m.active
                              ? { backgroundColor: 'var(--color-destructive-soft)', color: 'var(--color-destructive)', fontFamily: 'var(--font-body)' }
                              : { backgroundColor: 'var(--color-success-soft)', color: 'var(--color-success)', fontFamily: 'var(--font-body)' }}>
                            {m.active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create user dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) { setCreateOpen(false); setError(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'var(--font-headline)', fontWeight: 800 }}>New Admin User</DialogTitle>
            <DialogDescription style={{ fontFamily: 'var(--font-body)' }}>
              Create a login for a team member.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>Name</label>
              <input type="text" placeholder="Alice Kumar" value={newName} onChange={(e) => { setNewName(e.target.value); }} style={inputStyle} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>Email</label>
              <input type="email" placeholder="alice@company.com" value={newEmail} onChange={(e) => { setNewEmail(e.target.value); }} style={inputStyle} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>Password</label>
              <input type="password" placeholder="••••••••" value={newPassword} onChange={(e) => { setNewPassword(e.target.value); }} style={inputStyle} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>Role</label>
              <select value={newRole} onChange={(e) => { setNewRole(e.target.value as 'ADMIN' | 'SUPER_ADMIN'); }} style={inputStyle}>
                <option value="ADMIN">Admin</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </div>
            {error && <p className="rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: 'var(--color-destructive-soft)', color: 'var(--color-destructive)', fontFamily: 'var(--font-body)' }}>{error}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCreateOpen(false); reset(); }} disabled={isPending}>Cancel</Button>
            <Button variant="success" onClick={handleCreate} disabled={isPending}>{isPending ? 'Creating…' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set password dialog */}
      <Dialog open={Boolean(pwMember)} onOpenChange={(o) => { if (!o) { setPwMember(null); setError(''); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'var(--font-headline)', fontWeight: 800 }}>Set Password</DialogTitle>
            <DialogDescription style={{ fontFamily: 'var(--font-body)' }}>
              {pwMember?.name} — set a new password. Their active sessions will be revoked.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>New Password</label>
            <input type="password" placeholder="••••••••" value={newPw} onChange={(e) => { setNewPw(e.target.value); }} style={inputStyle} autoFocus />
          </div>
          {error && <p className="rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: 'var(--color-destructive-soft)', color: 'var(--color-destructive)', fontFamily: 'var(--font-body)' }}>{error}</p>}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setPwMember(null); setError(''); }} disabled={isPending}>Cancel</Button>
            <Button variant="success" onClick={handleSetPassword} disabled={isPending}>{isPending ? 'Saving…' : 'Set Password'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate/Activate confirm dialog */}
      <Dialog open={Boolean(toggleMember)} onOpenChange={(o) => { if (!o) { setToggleMember(null); setError(''); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'var(--font-headline)', fontWeight: 800 }}>
              {toggleMember?.active ? 'Deactivate User' : 'Activate User'}
            </DialogTitle>
            <DialogDescription style={{ fontFamily: 'var(--font-body)' }}>
              {toggleMember?.active
                ? `${toggleMember.name} will be signed out and cannot log in.`
                : `${toggleMember?.name ?? ''} will be able to log in again.`}
            </DialogDescription>
          </DialogHeader>
          {error && <p className="rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: 'var(--color-destructive-soft)', color: 'var(--color-destructive)', fontFamily: 'var(--font-body)' }}>{error}</p>}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setToggleMember(null); }} disabled={isPending}>Cancel</Button>
            <Button variant={toggleMember?.active ? 'destructive' : 'success'} onClick={handleToggle} disabled={isPending}>
              {isPending ? 'Processing…' : toggleMember?.active ? 'Deactivate' : 'Activate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
