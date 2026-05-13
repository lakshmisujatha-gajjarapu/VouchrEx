import type { Metadata } from 'next';

import { getAppConfig } from '@/lib/api';
import SettingsView from './settings-view';

export const metadata: Metadata = { title: 'Settings | VouchrEx Admin' };

export default async function SettingsPage() {
  const rows = await getAppConfig();

  return (
    <div className="p-8 animate-slide-up">
      <header className="mb-8">
        <h1 style={{ fontFamily: 'var(--font-headline)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--color-foreground)', marginBottom: '0.25rem' }}>
          Settings
        </h1>
        <p style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)', fontSize: '0.9375rem' }}>
          Marketplace-wide runtime configuration. Changes apply to new orders/listings only; historic records are not retroactively recalculated.
        </p>
      </header>

      <SettingsView rows={rows} />
    </div>
  );
}
