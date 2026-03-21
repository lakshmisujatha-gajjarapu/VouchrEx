import Link from 'next/link';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  href?: string;
  highlight?: boolean;
}

export function StatCard({ label, value, sub, href, highlight }: StatCardProps) {
  const content = (
    <div
      className={cn('relative overflow-hidden rounded-2xl p-6 transition-all accent-stripe', href && 'hover:scale-[1.01]')}
      style={{
        backgroundColor: 'var(--color-card)',
        boxShadow: '0 0 40px rgba(26,27,33,0.06)',
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-widest mb-1"
        style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
        {label}
      </p>
      <p className={cn('text-3xl font-bold tabular-nums mt-1')}
        style={{
          fontFamily: 'var(--font-mono)',
          color: highlight ? 'var(--color-primary)' : 'var(--color-foreground)',
        }}>
        {value}
      </p>
      {sub && (
        <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
          {sub}
        </p>
      )}
      {highlight && (
        <div className="absolute top-4 right-4 w-2 h-2 rounded-full animate-pulse"
          style={{ backgroundColor: 'var(--color-primary)' }} />
      )}
    </div>
  );

  if (href) return <Link href={href} className="block">{content}</Link>;
  return content;
}
