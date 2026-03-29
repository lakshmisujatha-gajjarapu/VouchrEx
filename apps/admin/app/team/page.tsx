import { getTeam, getMe } from '@/lib/api';
import TeamView from './TeamView';
import { redirect } from 'next/navigation';
import { ROUTES } from '@/lib/routes';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Team | CouponBazaar Admin' };

export default async function TeamPage() {
  const me = await getMe();

  // Only SUPER_ADMIN can access this page
  if (me.role !== 'SUPER_ADMIN') {
    redirect(ROUTES.DASHBOARD);
  }

  const team = await getTeam();

  return (
    <div className="p-8 animate-slide-up">
      <header className="mb-8">
        <h1 style={{ fontFamily: 'var(--font-headline)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--color-foreground)', marginBottom: '0.25rem' }}>
          Team
        </h1>
        <p style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)', fontSize: '0.9375rem' }}>
          {team.length} admin {team.length === 1 ? 'member' : 'members'}
        </p>
      </header>

      <TeamView team={team} currentAdminId={me.id} />
    </div>
  );
}
