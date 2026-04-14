import type React from 'react';

import type { StatusPill } from '@/components/status-pill';
import type { TicketCard } from '@/components/ticket-card';
import type { Listing } from '@/lib/api';
import { formatStatus } from '@/lib/format';
import type { AppTheme } from '@/theme/tokens';

// ─── constants ────────────────────────────────────────────────────────────────

const warningExpiryWindowMs = 1000 * 60 * 60 * 24 * 10; // 10 days
const dangerExpiryWindowMs = 1000 * 60 * 60 * 24 * 2;   //  2 days

// ─── order status helpers ─────────────────────────────────────────────────────

export function cardToneForStatus(status: string): 'neutral' | 'brand' | 'success' | 'danger' {
  if (status === 'DISPUTED' || status === 'CANCELLED' || status === 'PAYMENT_FAILED') return 'danger';
  if (status === 'CONFIRMED' || status === 'AUTO_CONFIRMED') return 'success';
  if (status === 'ESCROW_ACTIVE' || status === 'CODE_REVEALED') return 'brand';
  return 'neutral';
}

export function escrowBadgeLabel(status: string): string {
  if (status === 'PAYMENT_PENDING') return 'AWAITING PAYMENT';
  if (status === 'ESCROW_ACTIVE') return 'ACTIVE ESCROW';
  if (status === 'CODE_REVEALED') return 'CODE REVEALED';
  if (status === 'CONFIRMED' || status === 'AUTO_CONFIRMED') return 'ORDER SETTLED';
  if (status === 'DISPUTED') return 'DISPUTED';
  if (status === 'PAYMENT_FAILED') return 'PAYMENT FAILED';
  if (status === 'CANCELLED') return 'CANCELLED';
  return 'IN PROGRESS';
}

export function escrowBadgeColors(status: string, theme: AppTheme): { bg: string; border: string; text: string } {
  if (status === 'DISPUTED' || status === 'CANCELLED' || status === 'PAYMENT_FAILED') {
    return { bg: theme.colors.dangerSoft, border: theme.colors.pillDangerBorder, text: theme.colors.danger };
  }
  if (status === 'CONFIRMED' || status === 'AUTO_CONFIRMED') {
    return { bg: theme.colors.successSoft, border: theme.colors.pillSuccessBorder, text: theme.colors.success };
  }
  if (status === 'ESCROW_ACTIVE' || status === 'CODE_REVEALED') {
    return { bg: theme.colors.brandSoft, border: theme.colors.pillBrandBorder, text: theme.colors.brand };
  }
  return { bg: theme.colors.warningSoft, border: theme.colors.pillWarnBorder, text: theme.colors.warning };
}

export function buildFlowSteps(status: string): readonly { label: string; tone: 'neutral' | 'brand' | 'success' | 'danger' | 'warning' }[] {
  if (status === 'PAYMENT_PENDING') return [{ label: 'Payment', tone: 'warning' }, { label: 'Secured', tone: 'neutral' }, { label: 'Reveal', tone: 'neutral' }, { label: 'Confirm', tone: 'neutral' }];
  if (status === 'ESCROW_ACTIVE') return [{ label: 'Payment', tone: 'success' }, { label: 'Secured', tone: 'brand' }, { label: 'Reveal', tone: 'neutral' }, { label: 'Confirm', tone: 'neutral' }];
  if (status === 'CODE_REVEALED') return [{ label: 'Payment', tone: 'success' }, { label: 'Secured', tone: 'success' }, { label: 'Reveal', tone: 'brand' }, { label: 'Confirm', tone: 'warning' }];
  if (status === 'DISPUTED') return [{ label: 'Payment', tone: 'success' }, { label: 'Secured', tone: 'success' }, { label: 'Reveal', tone: 'success' }, { label: 'Dispute', tone: 'danger' }];
  if (status === 'CONFIRMED' || status === 'AUTO_CONFIRMED') return [{ label: 'Payment', tone: 'success' }, { label: 'Secured', tone: 'success' }, { label: 'Reveal', tone: 'success' }, { label: 'Confirm', tone: 'success' }];
  return [{ label: 'Payment', tone: 'neutral' }, { label: 'Secured', tone: 'neutral' }, { label: 'Reveal', tone: 'neutral' }, { label: 'Confirm', tone: 'neutral' }];
}

// ─── listing status helpers ───────────────────────────────────────────────────

export type ExpiryUrgency = 'normal' | 'warning' | 'danger' | 'expired';

export function getExpiryUrgency(expiryDate: string): ExpiryUrgency {
  const msLeft = new Date(expiryDate).getTime() - Date.now();
  if (msLeft <= 0) return 'expired';
  if (msLeft <= dangerExpiryWindowMs) return 'danger';
  if (msLeft <= warningExpiryWindowMs) return 'warning';
  return 'normal';
}

/** Eyebrow label: shows the most actionable status for the seller at a glance. */
export function getCardEyebrow(listing: Listing): string {
  if (listing.status === 'RESERVED' && listing.order) {
    return formatStatus(listing.order.status);
  }
  const urgency = getExpiryUrgency(listing.expiryDate);
  if (listing.status === 'ACTIVE') {
    if (urgency === 'danger') return 'Final 48h';
    if (urgency === 'warning') return 'Near expiry';
  }
  return formatStatus(listing.status);
}

export function getCardTone(listing: Listing): React.ComponentProps<typeof TicketCard>['tone'] {
  if (listing.status === 'SOLD') return 'success';
  if (listing.status === 'DISPUTED') return 'danger';
  if (listing.status === 'RESERVED') return 'brand';
  if (['EXPIRED', 'REFUNDED', 'REJECTED'].includes(listing.status)) return 'neutral';
  const urgency = getExpiryUrgency(listing.expiryDate);
  if (urgency === 'danger') return 'danger';
  if (urgency === 'warning') return 'warning';
  return 'neutral';
}

export function getStatusPillTone(listing: Listing): React.ComponentProps<typeof StatusPill>['tone'] {
  if (listing.status === 'SOLD') return 'success';
  if (listing.status === 'DISPUTED') return 'danger';
  if (listing.status === 'RESERVED') return 'brand';
  if (['EXPIRED', 'REJECTED', 'REFUNDED'].includes(listing.status)) return 'neutral';
  const urgency = getExpiryUrgency(listing.expiryDate);
  if (urgency === 'expired' || urgency === 'danger') return 'danger';
  if (urgency === 'warning') return 'warning';
  return 'neutral';
}
