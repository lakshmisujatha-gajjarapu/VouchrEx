import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { KeylineRow } from '@/components/keyline-row';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenShell } from '@/components/screen-shell';
import { SectionPanel } from '@/components/section-panel';
import { StatusPill } from '@/components/status-pill';
import { TicketCard } from '@/components/ticket-card';
import { TrustBadge } from '@/components/trust-badge';
import { useAuth } from '@/hooks/use-auth';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { useTheme } from '@/theme/ThemeContext';

export default function ListingDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ readonly id?: string | string[] }>();
  const listingId = useMemo(() => (Array.isArray(id) ? id[0] : id), [id]);
  const { sessionToken, user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listingResource = useAsyncResource(
    useCallback(() => {
      if (!listingId) {
        throw new Error('Listing ID is missing.');
      }

      return api.getListing(listingId);
    }, [listingId]),
    { enabled: Boolean(listingId) },
  );

  async function handleBuyNow() {
    if (!sessionToken || !listingId) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await api.createOrder(sessionToken, listingId);
      router.push({
        pathname: '/orders/[id]',
        params: {
          id: result.order.id,
          checkoutProvider: result.checkout.provider,
          ...(result.checkout.provider === 'MOCK'
            ? {
                checkoutOrderId: result.checkout.orderId ?? '',
                checkoutAmount: String(result.checkout.amount ?? 0),
                checkoutCurrency: result.checkout.currency ?? '',
                checkoutReceipt: result.checkout.receipt ?? '',
              }
            : {}),
          ...(result.checkout.paymentLinkUrl
            ? { checkoutPaymentLinkUrl: result.checkout.paymentLinkUrl }
            : {}),
          ...(result.checkout.paymentLinkId
            ? { checkoutPaymentLinkId: result.checkout.paymentLinkId }
            : {}),
        },
      });
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'Could not reserve listing.');
    } finally {
      setSubmitting(false);
    }
  }

  if (listingResource.loading && !listingResource.data) {
    return (
      <ScreenShell title="Loading listing..." scroll={false}>
        <ActivityIndicator color={theme.colors.action} />
      </ScreenShell>
    );
  }

  if (!listingResource.data) {
    return (
      <ScreenShell title="Listing unavailable" scroll={false}>
        <Text
          className="text-body font-semibold"
          style={{ color: theme.colors.danger }}>
          {listingResource.error ?? 'Listing not found.'}
        </Text>
      </ScreenShell>
    );
  }

  const listing = listingResource.data;
  const isOwnListing = listing.seller.id === user?.id;

  const footer = (
    <View style={{ gap: 6 }}>
      {error ? (
        <Text className="text-caption font-semibold text-center" style={{ color: theme.colors.danger }}>{error}</Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.inkMuted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 }}>You pay</Text>
          <Text style={{ color: theme.colors.ink, fontSize: 22, fontWeight: '800' }}>{formatCurrency(listing.sellingPrice)}</Text>
          <Text style={{ color: theme.colors.success, fontSize: 12, fontWeight: '700' }}>{String(Math.round(listing.discountPercent))}% off ₹{String(listing.faceValue)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton
            disabled={isOwnListing}
            label={isOwnListing ? 'Your listing' : 'Reserve now'}
            loading={submitting}
            onPress={() => { void handleBuyNow(); }}
            tone="action"
          />
        </View>
      </View>
    </View>
  );

  return (
    <ScreenShell
      eyebrow="Buy"
      footer={footer}
      subtitle="Check the seller, price, and expiry before you reserve."
      title={listing.brand.name}>
      <TicketCard
        eyebrow={listing.brand.category}
        meta={`Expires ${formatDate(listing.expiryDate)}`}
        subtitle={`${formatCurrency(listing.sellingPrice)} • ${listing.voucherType}`}
        title="Reserve with payment protection"
        tone="brand">
        <View className="mt-2 flex-row flex-wrap items-center gap-2">
          <StatusPill label={`${String(Math.round(listing.discountPercent))}% off`} tone="success" />
          <StatusPill label={listing.seller.name} tone="neutral" />
          {listing.seller.trustTier ? <TrustBadge tier={listing.seller.trustTier} /> : null}
        </View>
        <KeylineRow label="Selling price" value={formatCurrency(listing.sellingPrice)} />
        <KeylineRow label="Face value" value={formatCurrency(listing.faceValue)} />
        <KeylineRow label="Seller" value={listing.seller.name} />
        <KeylineRow label="Expiry" value={formatDate(listing.expiryDate)} />
      </TicketCard>

      <SectionPanel
        description="Your payment is held safely. Once you verify the voucher works, money goes to the seller."
        title="How it works">
        <View className="flex-row flex-wrap gap-2">
          <StatusPill label="Payment" tone="warning" />
          <StatusPill label="Payment secured" tone="brand" />
          <StatusPill label="Reveal" tone="success" />
          <StatusPill label="Confirm" tone="neutral" />
        </View>
      </SectionPanel>
    </ScreenShell>
  );
}
