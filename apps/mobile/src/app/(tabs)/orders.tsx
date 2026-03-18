import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { FilterChip } from '@/components/filter-chip';
import { ScreenShell } from '@/components/screen-shell';
import { StatusPill } from '@/components/status-pill';
import { TicketCard } from '@/components/ticket-card';
import { useAuth } from '@/hooks/use-auth';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { api } from '@/lib/api';
import { formatCountdown, formatCurrency, formatStatus } from '@/lib/format';
import { useTheme } from '@/theme/ThemeContext';

type Segment = 'buying' | 'selling';

function nextStepForOrder(status: string, segment: 'buying' | 'selling') {
  if (status === 'PAYMENT_PENDING')  return segment === 'buying' ? 'Pay to secure your order' : 'Waiting for buyer payment';
  if (status === 'ESCROW_ACTIVE')    return segment === 'buying' ? 'Reveal the voucher' : 'Payment secured';
  if (status === 'CODE_REVEALED')    return segment === 'buying' ? 'Verify or dispute' : 'Waiting for buyer confirmation';
  if (status === 'DISPUTED')         return 'Awaiting dispute resolution';
  if (status === 'CONFIRMED' || status === 'AUTO_CONFIRMED') return 'Payment sent to seller';
  return 'No action required';
}

export default function OrdersScreen() {
  const router = useRouter();
  const { sessionToken, user } = useAuth();
  const theme = useTheme();
  const [segment, setSegment] = useState<Segment>('buying');

  const ordersResource = useAsyncResource(
    useCallback(() => {
      if (!sessionToken) throw new Error('Session missing.');
      return api.listOrders(sessionToken);
    }, [sessionToken]),
    { enabled: Boolean(sessionToken) }
  );

  const visibleOrders = useMemo(
    () => ordersResource.data?.filter((o) =>
      segment === 'buying' ? o.buyerId === user?.id : o.sellerId === user?.id
    ) ?? [],
    [ordersResource.data, segment, user?.id]
  );

  const summary = useMemo(() => ({
    actionCount:    visibleOrders.filter((o) => ['PAYMENT_PENDING','ESCROW_ACTIVE','CODE_REVEALED','DISPUTED'].includes(o.status)).length,
    completedCount: visibleOrders.filter((o) => ['CONFIRMED','AUTO_CONFIRMED'].includes(o.status)).length,
  }), [visibleOrders]);

  return (
    <ScreenShell eyebrow="Track" subtitle="See what needs action." title="Orders">
      <View className="flex-row gap-2">
        <FilterChip label="Buying"   onPress={() => { setSegment('buying'); }}   selected={segment === 'buying'} />
        <FilterChip label="Selling"  onPress={() => { setSegment('selling'); }}  selected={segment === 'selling'} />
      </View>
      <View className="flex-row flex-wrap gap-2">
        <StatusPill label={`${String(summary.actionCount)} need action`} tone="warning" />
        <StatusPill label={`${String(summary.completedCount)} settled`}  tone="success" />
      </View>

      {ordersResource.loading && !ordersResource.data
        ? <ActivityIndicator color={theme.colors.brand} />
        : null}
      {ordersResource.error ? (
        <Text className="text-body" style={{ color: theme.colors.danger }}>
          {ordersResource.error}
        </Text>
      ) : null}

      {visibleOrders.map((order) => (
        <TicketCard
          key={order.id}
          eyebrow={formatStatus(order.status)}
          meta={formatCountdown(order.verificationDeadline)}
          onPress={() => { router.push(`/orders/${order.id}`); }}
          subtitle={`${order.listing.brand.name} • ${formatCurrency(order.amount)}`}
          title={nextStepForOrder(order.status, segment === 'buying' ? 'buying' : 'selling')}
          tone={
            order.status === 'DISPUTED' ? 'danger' :
            order.status === 'CONFIRMED' || order.status === 'AUTO_CONFIRMED' ? 'success' :
            ['PAYMENT_PENDING', 'ESCROW_ACTIVE', 'CODE_REVEALED'].includes(order.status) ? 'brand' :
            'neutral'
          }>
          <View className="mt-2 flex-row flex-wrap gap-2">
            <StatusPill
              label={order.payment?.escrowStatus ? formatStatus(order.payment.escrowStatus) : 'Pending funding'}
              tone={order.status === 'DISPUTED' ? 'danger' : 'trust'}
            />
            {segment === 'selling' ? <StatusPill label="Seller" tone="neutral" /> : null}
          </View>
        </TicketCard>
      ))}

      {!ordersResource.loading && visibleOrders.length === 0 ? (
        <TicketCard subtitle="Orders show up after a reservation." title="No orders yet" />
      ) : null}
    </ScreenShell>
  );
}
