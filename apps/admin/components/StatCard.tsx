import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
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
    <Card className={cn('transition-shadow', href && 'hover:shadow-md cursor-pointer', highlight && 'border-primary/40')}>
      <CardContent className="p-6">
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        <p className={cn('text-3xl font-bold mt-1 tabular-nums', highlight && 'text-primary')}>
          {value}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
