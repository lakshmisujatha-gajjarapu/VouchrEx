'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ROUTES } from '@/lib/routes';

export default function LoginView() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token.trim()) {
      setError('Please enter the admin token.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      });

      const data = (await res.json()) as { success?: boolean; error?: string };

      if (!res.ok || !data.success) {
        setError(data.error ?? 'Invalid token. Please try again.');
        return;
      }

      router.push(ROUTES.DASHBOARD);
      router.refresh();
    } catch {
      setError('Network error. Is the API running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left hero */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary flex-col justify-center px-16">
        <div className="text-white">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-xl mb-6">
            CB
          </div>
          <h1 className="text-4xl font-bold mb-4">CouponBazaar</h1>
          <p className="text-primary-foreground/80 text-lg mb-8">
            Admin Console — Manage disputes, orders, users, and payouts.
          </p>
          <div className="space-y-4">
            {[
              { title: 'Dispute Resolution', desc: 'Triage and resolve buyer/seller disputes' },
              { title: 'Payout Management', desc: 'Track and complete seller payouts' },
              { title: 'Platform Metrics', desc: 'Live GMV, escrow, and operational stats' },
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-3 bg-white/10 rounded-lg p-4">
                <div className="w-2 h-2 rounded-full bg-white mt-1.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-white">{f.title}</p>
                  <p className="text-sm text-white/70">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-white font-bold mb-4 lg:hidden">
              CB
            </div>
            <h2 className="text-2xl font-bold">Admin Login</h2>
            <p className="text-muted-foreground mt-1">Enter your admin token to continue.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token">Admin Token</Label>
              <Input
                id="token"
                type="password"
                placeholder="Paste your ADMIN_API_TOKEN"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoFocus
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Verifying…' : 'Sign In'}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-6">
            Token is stored as a secure httpOnly cookie.
          </p>
        </div>
      </div>
    </div>
  );
}
