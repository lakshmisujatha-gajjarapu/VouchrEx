'use client';

import { useEffect } from 'react';

interface ErrorProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[admin] page error:', error);
  }, [error]);

  const message = error.message;
  const isFetchFailure =
    message.includes('fetch failed') ||
    message.includes('ECONNREFUSED') ||
    message.includes('ENOTFOUND');

  return (
    <div className="p-8 animate-slide-up">
      <div
        style={{
          maxWidth: 560,
          margin: '4rem auto',
          padding: '2rem',
          borderRadius: '1rem',
          backgroundColor: 'var(--color-surface-high)',
          border: '1px solid var(--color-border)',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-headline)',
            fontSize: '1.5rem',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: 'var(--color-foreground)',
            marginBottom: '0.5rem',
          }}
        >
          {isFetchFailure ? 'API unreachable' : 'Something went wrong'}
        </h1>
        <p
          style={{
            color: 'var(--color-muted-foreground)',
            fontFamily: 'var(--font-body)',
            fontSize: '0.9375rem',
            marginBottom: '1.5rem',
          }}
        >
          {isFetchFailure
            ? 'Could not reach the VouchrEx API. Make sure it is running on the configured port, then retry.'
            : message}
        </p>

        <pre
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            color: 'var(--color-muted-foreground)',
            backgroundColor: 'var(--color-background)',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            overflowX: 'auto',
            marginBottom: '1.5rem',
            whiteSpace: 'pre-wrap',
          }}
        >
          {message}
          {error.digest ? `\n\ndigest: ${error.digest}` : ''}
        </pre>

        <button
          type="button"
          onClick={reset}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-primary-foreground)',
            fontFamily: 'var(--font-body)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    </div>
  );
}
