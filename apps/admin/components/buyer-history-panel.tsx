'use client';

interface Props {
  readonly purchases: number;
  readonly disputesRaised: number;
  readonly buyerStrikes: number;
}

function Stat({ label, value, alert }: { readonly label: string; readonly value: number; readonly alert?: boolean }) {
  return (
    <div>
      <p style={{ color: 'var(--color-muted-foreground)' }}>{label}</p>
      <p style={{ color: alert ? 'var(--color-destructive)' : 'var(--color-foreground)' }}>{value}</p>
    </div>
  );
}

export function BuyerHistoryPanel(props: Props) {
  const { purchases, disputesRaised, buyerStrikes } = props;
  return (
    <div
      className="grid grid-cols-3 gap-2 rounded-xl p-3 text-xs"
      style={{ fontFamily: 'var(--font-body)', backgroundColor: 'var(--color-surface-raised)' }}
    >
      <Stat label="Purchases" value={purchases} />
      <Stat label="Disputes raised" value={disputesRaised} alert={disputesRaised >= 2} />
      <Stat label="Disputes lost" value={buyerStrikes} alert={buyerStrikes >= 1} />
    </div>
  );
}
