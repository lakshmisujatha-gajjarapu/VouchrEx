'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/lib/routes';

export default function LoginView() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!token.trim()) { setError('Please enter the admin token.'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) { setError(data.error ?? 'Invalid token. Please try again.'); return; }
      router.push(ROUTES.DASHBOARD);
      router.refresh();
    } catch {
      setError('Network error. Is the API running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--color-background)' }}>

      {/* ── Left hero panel ── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-16 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #2E1F6B 0%, #0D0B1E 100%)' }}>
        {/* Decorative orbs */}
        <div className="absolute top-[-80px] right-[-60px] w-72 h-72 rounded-full opacity-20"
          style={{ backgroundColor: '#A78BFA' }} />
        <div className="absolute bottom-[-60px] left-[-40px] w-56 h-56 rounded-full opacity-10"
          style={{ backgroundColor: '#85F8C4' }} />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' }}>
              <span className="text-white font-bold text-sm" style={{ fontFamily: 'var(--font-headline)' }}>CB</span>
            </div>
            <h1 className="text-white" style={{ fontFamily: 'var(--font-headline)', fontSize: '1.5rem', fontWeight: 800 }}>
              CouponBazaar
            </h1>
          </div>

          <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: '2.5rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: '1rem' }}>
            Admin Console
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontFamily: 'var(--font-body)', fontSize: '1rem', marginBottom: '2.5rem', maxWidth: '380px' }}>
            Manage disputes, orders, users, and payouts for the CouponBazaar platform.
          </p>

          <div className="space-y-3">
            {[
              { title: 'Dispute Resolution', desc: 'Triage and resolve buyer/seller disputes' },
              { title: 'Payout Management',  desc: 'Track and complete seller payouts' },
              { title: 'Platform Metrics',   desc: 'Live GMV, escrow, and operational stats' },
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-3 rounded-xl p-4"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: '#85F8C4' }} />
                <div>
                  <p className="font-semibold text-white text-sm" style={{ fontFamily: 'var(--font-headline)' }}>{f.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'var(--font-body)' }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right login form ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #8856E5, #6E3ACA)' }}>
              <span className="text-white font-bold text-sm" style={{ fontFamily: 'var(--font-headline)' }}>CB</span>
            </div>
            <span className="font-bold text-lg" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-primary)' }}>
              CouponBazaar
            </span>
          </div>

          <div className="mb-8">
            <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--color-foreground)' }}>
              Admin Login
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
              Enter your admin token to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="token" className="block text-xs font-semibold uppercase tracking-widest"
                style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                Admin Token
              </label>
              <input
                id="token"
                type="password"
                placeholder="Paste your ADMIN_API_TOKEN"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoFocus
                autoComplete="current-password"
                className="w-full h-14 rounded-2xl px-4 text-sm transition-all outline-none"
                style={{
                  backgroundColor: 'var(--color-surface-high)',
                  border: 'none',
                  color: 'var(--color-foreground)',
                  fontFamily: 'var(--font-body)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)';
                  e.currentTarget.style.backgroundColor = 'var(--color-card)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-high)';
                }}
              />
            </div>

            {error && (
              <div className="rounded-xl px-4 py-3 text-sm"
                style={{ backgroundColor: 'var(--color-destructive-soft)', color: 'var(--color-destructive)', fontFamily: 'var(--font-body)' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 rounded-2xl font-semibold text-white text-base transition-all disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #8856E5, #6E3ACA)',
                boxShadow: '0 10px 28px rgba(110,58,202,0.28)',
                fontFamily: 'var(--font-body)',
              }}
            >
              {loading ? 'Verifying…' : 'Sign In'}
            </button>
          </form>

          <p className="text-xs text-center mt-6" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
            Token is stored as a secure httpOnly cookie.
          </p>
        </div>
      </div>
    </div>
  );
}
