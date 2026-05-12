'use client';

interface Props {
  readonly orderCreatedAt: string;
  readonly codeRevealedAt: string | null;
  readonly disputeRaisedAt: string;
  readonly verificationDeadline: string | null;
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function delta(fromIso: string, toIso: string): string {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  if (ms < 0) return '—';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `+${String(mins)}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `+${String(hours)}h`;
  const days = Math.floor(hours / 24);
  return `+${String(days)}d ${String(hours % 24)}h`;
}

export function DisputeTimeline(props: Props) {
  const { orderCreatedAt, codeRevealedAt, disputeRaisedAt, verificationDeadline } = props;

  const lastMinute = Boolean(
    verificationDeadline &&
    new Date(verificationDeadline).getTime() - new Date(disputeRaisedAt).getTime() < 30 * 60_000
  );

  return (
    <div
      className="rounded-xl p-3 text-xs space-y-1"
      style={{ backgroundColor: 'var(--color-surface-raised)', fontFamily: 'var(--font-mono)' }}
    >
      <div>
        <span style={{ color: 'var(--color-muted-foreground)' }}>Order created:</span>{' '}
        <span style={{ color: 'var(--color-foreground)' }}>{fmt(orderCreatedAt)}</span>
      </div>
      {codeRevealedAt && (
        <div>
          <span style={{ color: 'var(--color-muted-foreground)' }}>Code revealed:</span>{' '}
          <span style={{ color: 'var(--color-foreground)' }}>{fmt(codeRevealedAt)}</span>{' '}
          <span style={{ color: 'var(--color-muted-foreground)' }}>({delta(orderCreatedAt, codeRevealedAt)})</span>
        </div>
      )}
      <div>
        <span style={{ color: 'var(--color-muted-foreground)' }}>Dispute raised:</span>{' '}
        <span style={{ color: 'var(--color-foreground)' }}>{fmt(disputeRaisedAt)}</span>{' '}
        <span style={{ color: 'var(--color-muted-foreground)' }}>
          ({delta(codeRevealedAt ?? orderCreatedAt, disputeRaisedAt)} after {codeRevealedAt ? 'reveal' : 'order'})
        </span>
      </div>
      {verificationDeadline && (
        <div style={lastMinute ? { color: 'var(--color-warning, #b45309)' } : undefined}>
          <span style={lastMinute ? undefined : { color: 'var(--color-muted-foreground)' }}>Auto-confirm at:</span>{' '}
          <span style={lastMinute ? undefined : { color: 'var(--color-foreground)' }}>{fmt(verificationDeadline)}</span>{' '}
          <span style={lastMinute ? undefined : { color: 'var(--color-muted-foreground)' }}>
            ({delta(disputeRaisedAt, verificationDeadline)} remaining when filed)
          </span>
          {lastMinute && <span> ← last-minute (B07)</span>}
        </div>
      )}
    </div>
  );
}
