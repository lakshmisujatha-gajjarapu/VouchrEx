'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface SearchKey {
  value: string;
  label: string;
  placeholder?: string;
}

interface TableToolbarProps {
  readonly basePath: string;
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly q: string;
  readonly qBy: string;
  readonly searchKeys: readonly SearchKey[];
}

const SEARCH_DEBOUNCE_MS = 300;

export default function TableToolbar({
  basePath, total, page, pageSize, q, qBy, searchKeys,
}: TableToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [text, setText] = useState(q);
  const [key, setKey] = useState(qBy || searchKeys[0]?.value || '');
  const [isPending, startTransition] = useTransition();

  useEffect(() => { setText(q); }, [q]);
  useEffect(() => { setKey(qBy || searchKeys[0]?.value || ''); }, [qBy, searchKeys]);

  const push = (mutate: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams.toString());
    mutate(next);
    const qs = next.toString();
    startTransition(() => { router.replace(qs ? `${basePath}?${qs}` : basePath); });
  };

  // Debounce text → URL. Only push when a key is selected and text differs from URL.
  useEffect(() => {
    if (text === q) return;
    if (text.trim() && !key) return;
    const t = setTimeout(() => {
      push((p) => {
        if (text.trim()) {
          p.set('q', text.trim());
          p.set('qBy', key);
        } else {
          p.delete('q');
          p.delete('qBy');
        }
        p.delete('page');
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => { clearTimeout(t); };
  }, [text, key, q, searchParams, basePath, router]);

  const onKeyChange = (nextKey: string) => {
    setKey(nextKey);
    // If there's already typed text, re-push immediately under the new key.
    if (text.trim()) {
      push((p) => {
        p.set('q', text.trim());
        p.set('qBy', nextKey);
        p.delete('page');
      });
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const goto = (n: number) => {
    push((p) => {
      if (n <= 1) p.delete('page');
      else p.set('page', String(n));
    });
  };

  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);
  const activeKey = searchKeys.find((k) => k.value === key) ?? searchKeys[0];
  const placeholder = activeKey.placeholder ?? `Search by ${activeKey.label.toLowerCase()}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div className="flex items-stretch gap-2 flex-1 min-w-[280px] max-w-xl">
        <select
          value={key}
          onChange={(e) => { onKeyChange(e.target.value); }}
          aria-label="Search column"
          style={{
            height: '2.5rem', borderRadius: '0.75rem',
            padding: '0 2rem 0 0.875rem', fontSize: '0.875rem',
            border: 'none', outline: 'none',
            backgroundColor: 'var(--color-surface-raised)', color: 'var(--color-foreground)',
            fontFamily: 'var(--font-body)', fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {searchKeys.map((k) => (
            <option key={k.value} value={k.value}>{k.label}</option>
          ))}
        </select>
        <div className="relative flex-1">
          <Search
            size={16}
            style={{
              position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)',
              color: 'var(--color-muted-foreground)', pointerEvents: 'none',
            }}
          />
          <input
            type="search"
            value={text}
            onChange={(e) => { setText(e.target.value); }}
            placeholder={placeholder}
            style={{
              width: '100%', height: '2.5rem', borderRadius: '0.75rem',
              padding: '0 0.875rem 0 2.25rem', fontSize: '0.875rem',
              border: 'none', outline: 'none',
              backgroundColor: 'var(--color-surface-high)', color: 'var(--color-foreground)',
              fontFamily: 'var(--font-body)',
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-3" style={{ fontFamily: 'var(--font-body)' }}>
        <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
          {total === 0 ? 'No results' : `${String(firstRow)}–${String(lastRow)} of ${String(total)}`}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { goto(page - 1); }}
            disabled={!canPrev || isPending}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </Button>
          <span className="text-xs px-2 tabular-nums" style={{ color: 'var(--color-muted-foreground)' }}>
            {String(page)} / {String(totalPages)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { goto(page + 1); }}
            disabled={!canNext || isPending}
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
