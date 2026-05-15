'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AppConfigRow } from '@/lib/types';
import { clientFetch } from '@/lib/client-fetch';
import { formatDate } from '@/lib/utils';

interface SettingsViewProps {
  rows: AppConfigRow[];
}

const RATE_KEYS = new Set(['buyer_fee_rate', 'seller_commission_rate']);

function isRateKey(row: AppConfigRow): boolean {
  return row.valueType === 'number' && RATE_KEYS.has(row.key);
}

function toDisplayValue(row: AppConfigRow): string {
  if (isRateKey(row)) {
    const n = Number(row.value);
    if (!Number.isFinite(n)) return row.value;
    return String(Math.round(n * 1000) / 10);
  }
  return row.value;
}

function fromDisplayValue(row: AppConfigRow, display: string): string {
  if (isRateKey(row)) {
    const n = Number(display);
    if (!Number.isFinite(n)) return display;
    return String(n / 100);
  }
  return display;
}

function unitSuffix(row: AppConfigRow): string {
  if (isRateKey(row)) return '%';
  if (row.key.endsWith('_inr')) return '₹';
  return '';
}

function humanizeKey(key: string): string {
  return key
    .split('_')
    .map((p) => (p.length > 0 ? p[0].toUpperCase() + p.slice(1) : p))
    .join(' ');
}

/**
 * Heuristic sanity check before submitting a change. Returns a human warning
 * string if the new value looks suspicious vs. the old one, or null if it
 * looks routine. This is belt-and-braces UX, not a hard validation — the
 * server enforces hard upper bounds independently.
 */
function describeRisk(row: AppConfigRow, currentValue: string, nextValue: string): string | null {
  if (currentValue === nextValue) return null;
  const oldNum = Number(currentValue);
  const newNum = Number(nextValue);
  if (!Number.isFinite(oldNum) || !Number.isFinite(newNum)) return null;

  if (RATE_KEYS.has(row.key)) {
    // Rates live in 0..1. A >0.5 absolute jump (e.g. 10% → 65%) almost
    // certainly indicates a unit/typo mistake.
    if (Math.abs(newNum - oldNum) > 0.5) {
      return `This changes the rate by ${(Math.abs(newNum - oldNum) * 100).toFixed(0)} percentage points. Double-check you meant ${(newNum * 100).toFixed(1)}% and not ${(newNum * 10).toFixed(1)}%.`;
    }
    if (newNum > 0.5) {
      return `Setting a rate above 50% is unusual. Are you sure?`;
    }
  } else if (oldNum > 0 && newNum > 0) {
    // Absolute amounts: a >5× change is suspicious in either direction.
    const ratio = newNum > oldNum ? newNum / oldNum : oldNum / newNum;
    if (ratio >= 5) {
      const direction = newNum > oldNum ? 'increases' : 'decreases';
      return `This ${direction} the value by ${ratio.toFixed(1)}× (from ${String(oldNum)} to ${String(newNum)}). Confirm this is intentional.`;
    }
  }
  return null;
}

type NotifyDraft = { enabled: boolean; title: string; message: string };

export default function SettingsView({ rows }: SettingsViewProps) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const r of rows) seed[r.key] = toDisplayValue(r);
    return seed;
  });
  const [notifyDrafts, setNotifyDrafts] = useState<Record<string, NotifyDraft>>(() => {
    const seed: Record<string, NotifyDraft> = {};
    for (const r of rows) seed[r.key] = { enabled: false, title: '', message: '' };
    return seed;
  });
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [errorByKey, setErrorByKey] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();

  const rowsByKey = useMemo(() => {
    const m = new Map<string, AppConfigRow>();
    for (const r of rows) m.set(r.key, r);
    return m;
  }, [rows]);

  const handleSave = (key: string) => {
    const row = rowsByKey.get(key);
    if (!row) return;
    const display = drafts[key] ?? '';
    const payload = fromDisplayValue(row, display);
    const notify = notifyDrafts[key] ?? { enabled: false, title: '', message: '' };

    if (notify.enabled) {
      if (!notify.title.trim() || !notify.message.trim()) {
        setErrorByKey((prev) => ({ ...prev, [key]: 'Notification title and message are required when "Notify users" is on.' }));
        return;
      }
    }

    // Save-time sanity check — warn before applying suspiciously large changes.
    const risk = describeRisk(row, row.value, payload);
    if (risk) {
      // window.confirm is intentional: simple, blocking, hard to dismiss
      // without acknowledging. A custom modal would be over-engineering for
      // a rare admin-only path.
      const confirmed = window.confirm(`${risk}\n\nProceed with the change?`);
      if (!confirmed) return;
    }

    setSavingKey(key);
    setErrorByKey((prev) => ({ ...prev, [key]: '' }));

    void (async () => {
      try {
        const body: Record<string, unknown> = { value: payload };
        if (notify.enabled) {
          body.notify = { title: notify.title.trim(), message: notify.message.trim() };
        }
        const res = await clientFetch(`/api/config/${encodeURIComponent(key)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => res.statusText);
          throw new Error(txt || `HTTP ${String(res.status)}`);
        }
        // Reset notify draft after a successful save
        setNotifyDrafts((prev) => ({ ...prev, [key]: { enabled: false, title: '', message: '' } }));
        startTransition(() => {
          router.refresh();
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setErrorByKey((prev) => ({ ...prev, [key]: message }));
      } finally {
        setSavingKey(null);
      }
    })();
  };

  if (rows.length === 0) {
    return (
      <div
        className="p-8 rounded-2xl text-center"
        style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}
      >
        No configuration values are defined yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const draft = drafts[row.key] ?? '';
        const original = toDisplayValue(row);
        const dirty = draft !== original;
        const saving = savingKey === row.key;
        const error = errorByKey[row.key];
        const suffix = unitSuffix(row);
        const notify = notifyDrafts[row.key] ?? { enabled: false, title: '', message: '' };

        return (
          <div
            key={row.key}
            className="p-6 rounded-2xl"
            style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-surface-high)' }}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex-1 min-w-0">
                <h3
                  className="text-base font-semibold"
                  style={{ color: 'var(--color-foreground)', fontFamily: 'var(--font-headline)' }}
                >
                  {humanizeKey(row.key)}
                </h3>
                <p
                  className="text-xs mt-1"
                  style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}
                >
                  <code style={{ fontFamily: 'var(--font-mono, monospace)' }}>{row.key}</code>
                  {row.description ? <> — {row.description}</> : null}
                </p>
                <p
                  className="text-[11px] mt-1"
                  style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}
                >
                  Last updated: {formatDate(row.updatedAt)}
                  {row.updatedBy ? ` (by ${row.updatedBy})` : ''}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <Input
                    value={draft}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDrafts((prev) => ({ ...prev, [row.key]: v }));
                    }}
                    inputMode={row.valueType === 'number' ? 'decimal' : 'text'}
                    className="w-32"
                    disabled={saving}
                  />
                  {suffix ? (
                    <span style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                      {suffix}
                    </span>
                  ) : null}
                </div>
                <Button onClick={() => { handleSave(row.key); }} disabled={!dirty || saving}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>

            <div className="mt-4 pt-4" style={{ borderTop: '1px dashed var(--color-surface-high)' }}>
              <label
                className="flex items-center gap-2 text-xs cursor-pointer select-none"
                style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}
              >
                <input
                  type="checkbox"
                  checked={notify.enabled}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setNotifyDrafts((prev) => ({
                      ...prev,
                      [row.key]: { ...(prev[row.key] ?? { title: '', message: '' }), enabled }
                    }));
                  }}
                  disabled={saving}
                />
                Notify users on save (push + inbox)
              </label>

              {notify.enabled ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <Input
                    placeholder="Notification title (e.g. New limit!)"
                    value={notify.title}
                    onChange={(e) => {
                      const v = e.target.value;
                      setNotifyDrafts((prev) => ({
                        ...prev,
                        [row.key]: { ...(prev[row.key] ?? { enabled: true, message: '' }), title: v, enabled: true }
                      }));
                    }}
                    disabled={saving}
                  />
                  <Input
                    placeholder="Message (e.g. You can now list up to ₹10,000)"
                    value={notify.message}
                    onChange={(e) => {
                      const v = e.target.value;
                      setNotifyDrafts((prev) => ({
                        ...prev,
                        [row.key]: { ...(prev[row.key] ?? { enabled: true, title: '' }), message: v, enabled: true }
                      }));
                    }}
                    disabled={saving}
                  />
                </div>
              ) : null}
            </div>

            {error ? (
              <p
                className="text-xs mt-3"
                style={{ color: 'var(--color-destructive)', fontFamily: 'var(--font-body)' }}
              >
                {error}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
