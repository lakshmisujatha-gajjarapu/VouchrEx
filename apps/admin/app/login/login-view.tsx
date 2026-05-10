'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/lib/routes';

type Mode = 'password' | 'bootstrap';

export default function LoginView() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'password') {
      if (!email.trim() || !password.trim()) { setError('Email and password are required.'); return; }
    } else {
      if (!token.trim()) { setError('Admin token is required.'); return; }
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: mode === 'password' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'password'
            ? { email: email.trim(), password }
            : { token: token.trim() }
        ),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) { setError(data.error ?? 'Sign-in failed. Please try again.'); return; }
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
        <div className="absolute top-[-80px] right-[-60px] w-72 h-72 rounded-full opacity-20" style={{ backgroundColor: '#A78BFA' }} />
        <div className="absolute bottom-[-60px] left-[-40px] w-56 h-56 rounded-full opacity-10" style={{ backgroundColor: '#85F8C4' }} />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' }}>
              <span className="text-white font-bold text-sm" style={{ fontFamily: 'var(--font-headline)' }}>CB</span>
            </div>
            <h1 className="text-white" style={{ fontFamily: 'var(--font-headline)', fontSize: '1.5rem', fontWeight: 800 }}>
              VouchrEx
            </h1>
          </div>

          <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: '2.5rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: '1rem' }}>
            Admin Console
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontFamily: 'var(--font-body)', fontSize: '1rem', marginBottom: '2.5rem', maxWidth: '380px' }}>
            Manage disputes, orders, users, and payouts for the VouchrEx platform.
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
              VouchrEx
            </span>
          </div>

          <div className="mb-8">
            <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--color-foreground)' }}>
              {mode === 'password' ? 'Sign In' : 'Bootstrap Access'}
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
              {mode === 'password'
                ? 'Sign in with your admin account.'
                : 'Use your ADMIN_API_TOKEN for first-time setup.'}
            </p>
          </div>

          <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
            {mode === 'password' ? (
              <>
                <div className="space-y-2">
                  <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); }}
                    autoFocus
                    autoComplete="email"
                    className="w-full h-14 rounded-2xl px-4 text-sm transition-all outline-none"
                    style={{ backgroundColor: 'var(--color-surface-high)', border: 'none', color: 'var(--color-foreground)', fontFamily: 'var(--font-body)' }}
                    onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)'; e.currentTarget.style.backgroundColor = 'var(--color-card)'; }}
                    onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.backgroundColor = 'var(--color-surface-high)'; }}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); }}
                    autoComplete="current-password"
                    className="w-full h-14 rounded-2xl px-4 text-sm transition-all outline-none"
                    style={{ backgroundColor: 'var(--color-surface-high)', border: 'none', color: 'var(--color-foreground)', fontFamily: 'var(--font-body)' }}
                    onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)'; e.currentTarget.style.backgroundColor = 'var(--color-card)'; }}
                    onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.backgroundColor = 'var(--color-surface-high)'; }}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <label htmlFor="token" className="block text-xs font-semibold uppercase tracking-widest"
                  style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                  Admin Token
                </label>
                <input
                  id="token"
                  type="password"
                  placeholder="Paste ADMIN_API_TOKEN"
                  value={token}
                  onChange={(e) => { setToken(e.target.value); }}
                  autoFocus
                  autoComplete="off"
                  className="w-full h-14 rounded-2xl px-4 text-sm transition-all outline-none"
                  style={{ backgroundColor: 'var(--color-surface-high)', border: 'none', color: 'var(--color-foreground)', fontFamily: 'var(--font-body)' }}
                  onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)'; e.currentTarget.style.backgroundColor = 'var(--color-card)'; }}
                  onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.backgroundColor = 'var(--color-surface-high)'; }}
                />
              </div>
            )}

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
              style={{ background: 'linear-gradient(135deg, #8856E5, #6E3ACA)', boxShadow: '0 10px 28px rgba(110,58,202,0.28)', fontFamily: 'var(--font-body)' }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <button
            onClick={() => { setMode(mode === 'password' ? 'bootstrap' : 'password'); setError(''); }}
            className="w-full text-xs text-center mt-5 underline-offset-2 underline"
            style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}
          >
            {mode === 'password' ? 'First-time setup? Use admin token →' : '← Back to email sign-in'}
          </button>
        </div>
      </div>
    </div>
  );
}
