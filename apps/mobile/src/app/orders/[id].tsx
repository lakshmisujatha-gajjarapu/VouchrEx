import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Text, View } from 'react-native';

import { KeylineRow } from '@/components/keyline-row';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenShell } from '@/components/screen-shell';
import { SectionPanel } from '@/components/section-panel';
import { StatusPill } from '@/components/status-pill';
import { TextField } from '@/components/text-field';
import { TicketCard } from '@/components/ticket-card';
import { useAuth } from '@/hooks/use-auth';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { api, type Checkout, type RevealResult } from '@/lib/api';
import { formatCountdown, formatCurrency, formatDateTime, formatStatus } from '@/lib/format';
import { useTheme } from '@/theme/ThemeContext';

function cardToneForStatus(status: string): 'neutral' | 'brand' | 'success' | 'danger' {
  if (status === 'DISPUTED' || status === 'CANCELLED' || status === 'PAYMENT_FAILED') {
    return 'danger';
  }

  if (status === 'CONFIRMED' || status === 'AUTO_CONFIRMED') {
    return 'success';
  }

  if (status === 'ESCROW_ACTIVE' || status === 'CODE_REVEALED') {
    return 'brand';
  }

  return 'neutral';
}

function pillToneForStatus(status?: string | null): 'neutral' | 'brand' | 'success' | 'danger' | 'warning' {
  if (!status) {
    return 'neutral';
  }

  if (status === 'PAYMENT_PENDING') {
    return 'warning';
  }

  if (status === 'ESCROW_ACTIVE') {
    return 'brand';
  }

  if (status === 'CODE_REVEALED' || status === 'CONFIRMED' || status === 'AUTO_CONFIRMED' || status === 'RELEASED') {
    return 'success';
  }

  if (status === 'DISPUTED' || status === 'PAYMENT_FAILED' || status === 'CANCELLED') {
    return 'danger';
  }

  return 'neutral';
}

function nextActionLabel(status: string, isBuyer: boolean) {
  if (status === 'PAYMENT_PENDING') {
    return isBuyer ? 'Pay to secure your order' : 'Waiting for buyer payment';
  }

  if (status === 'ESCROW_ACTIVE') {
    return isBuyer ? 'Reveal and verify' : 'Payment secured';
  }

  if (status === 'CODE_REVEALED') {
    return isBuyer ? 'Confirm or dispute' : 'Waiting for buyer confirmation';
  }

  if (status === 'DISPUTED') {
    return 'Dispute in review';
  }

  if (status === 'CONFIRMED' || status === 'AUTO_CONFIRMED') {
    return isBuyer ? 'Order settled' : 'Payout released';
  }

  return 'No action needed';
}

type FlowStep = {
  readonly label: string;
  readonly tone: 'neutral' | 'brand' | 'success' | 'danger' | 'warning';
};

function buildFlowSteps(status: string): readonly FlowStep[] {
  if (status === 'PAYMENT_PENDING') {
    return [
      { label: 'Payment', tone: 'warning' },
      { label: 'Secured', tone: 'neutral' },
      { label: 'Reveal', tone: 'neutral' },
      { label: 'Confirm', tone: 'neutral' },
    ];
  }

  if (status === 'ESCROW_ACTIVE') {
    return [
      { label: 'Payment', tone: 'success' },
      { label: 'Secured', tone: 'brand' },
      { label: 'Reveal', tone: 'neutral' },
      { label: 'Confirm', tone: 'neutral' },
    ];
  }

  if (status === 'CODE_REVEALED') {
    return [
      { label: 'Payment', tone: 'success' },
      { label: 'Secured', tone: 'success' },
      { label: 'Reveal', tone: 'brand' },
      { label: 'Confirm', tone: 'warning' },
    ];
  }

  if (status === 'DISPUTED') {
    return [
      { label: 'Payment', tone: 'success' },
      { label: 'Secured', tone: 'success' },
      { label: 'Reveal', tone: 'success' },
      { label: 'Dispute', tone: 'danger' },
    ];
  }

  if (status === 'CONFIRMED' || status === 'AUTO_CONFIRMED') {
    return [
      { label: 'Payment', tone: 'success' },
      { label: 'Secured', tone: 'success' },
      { label: 'Reveal', tone: 'success' },
      { label: 'Confirm', tone: 'success' },
    ];
  }

  return [
    { label: 'Payment', tone: 'neutral' },
    { label: 'Secured', tone: 'neutral' },
    { label: 'Reveal', tone: 'neutral' },
    { label: 'Confirm', tone: 'neutral' },
  ];
}

function firstRouteParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function parseCheckoutAmount(value?: string | string[]) {
  const rawValue = firstRouteParam(value);
  if (!rawValue) {
    return null;
  }

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildCheckoutFromRoute(params: {
  readonly checkoutProvider?: string | string[];
  readonly checkoutOrderId?: string | string[];
  readonly checkoutAmount?: string | string[];
  readonly checkoutCurrency?: string | string[];
  readonly checkoutReceipt?: string | string[];
  readonly checkoutPaymentLinkUrl?: string | string[];
  readonly checkoutPaymentLinkId?: string | string[];
}): Checkout | null {
  const provider = firstRouteParam(params.checkoutProvider);

  if (!provider || (provider !== 'MOCK' && provider !== 'RAZORPAY')) {
    return null;
  }

  if (provider === 'RAZORPAY') {
    const paymentLinkUrl = firstRouteParam(params.checkoutPaymentLinkUrl);
    const paymentLinkId = firstRouteParam(params.checkoutPaymentLinkId);
    if (!paymentLinkUrl || !paymentLinkId) return null;
    return { provider, paymentLinkUrl, paymentLinkId };
  }

  const orderId = firstRouteParam(params.checkoutOrderId);
  const amount = parseCheckoutAmount(params.checkoutAmount);
  const currency = firstRouteParam(params.checkoutCurrency);
  const receipt = firstRouteParam(params.checkoutReceipt);

  if (!orderId || amount === null || !currency || !receipt) {
    return null;
  }

  return { provider, orderId, amount, currency, receipt };
}

function buildCheckoutFromOrder(order: {
  readonly id: string;
  readonly amount: number;
  readonly platformFee: number;
  readonly status: string;
  readonly payment?: {
    readonly provider: 'MOCK' | 'RAZORPAY';
    readonly currency: string;
  } | null;
}): Checkout | null {
  if (order.status !== 'PAYMENT_PENDING' || !order.payment) {
    return null;
  }

  // RAZORPAY: payment link URL is not stored on the order; user must call prepareCheckout
  if (order.payment.provider === 'RAZORPAY') {
    return null;
  }

  return {
    provider: 'MOCK',
    orderId: `mock_${order.id}`,
    amount: (order.amount + order.platformFee) * 100,
    currency: order.payment.currency,
    receipt: order.id,
  };
}

export default function OrderDetailScreen() {
  const params = useLocalSearchParams<{
    readonly id?: string | string[];
    readonly checkoutProvider?: string | string[];
    readonly checkoutOrderId?: string | string[];
    readonly checkoutAmount?: string | string[];
    readonly checkoutCurrency?: string | string[];
    readonly checkoutReceipt?: string | string[];
    readonly checkoutPaymentLinkUrl?: string | string[];
    readonly checkoutPaymentLinkId?: string | string[];
  }>();
  const orderId = useMemo(() => firstRouteParam(params.id), [params.id]);
  const { sessionToken, user } = useAuth();
  const theme = useTheme();
  const [checkout, setCheckout] = useState<Checkout | null>(() => buildCheckoutFromRoute(params));
  const [reveal, setReveal] = useState<RevealResult | null>(null);
  const [reason, setReason] = useState('voucher-invalid');
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const orderResource = useAsyncResource(
    useCallback(() => {
      if (!sessionToken) {
        throw new Error('Session missing.');
      }

      if (!orderId) {
        throw new Error('Order ID is missing.');
      }

      return api.getOrder(sessionToken, orderId);
    }, [orderId, sessionToken]),
    { enabled: Boolean(orderId && sessionToken) },
  );

  async function reloadOrder() {
    return orderResource.reload();
  }

  async function handlePrepareCheckout() {
    if (!sessionToken || !orderId) {
      return;
    }

    setBusyAction('checkout');
    setFeedback(null);

    try {
      const result = await api.prepareCheckout(sessionToken, orderId);
      setCheckout(result.checkout);
      setFeedback(
        result.checkout.provider === 'MOCK'
          ? 'Mock checkout prepared. You can capture it immediately in development.'
          : 'Razorpay order is ready. Native checkout wiring is the next mobile step.',
      );
    } catch (error_) {
      setFeedback(error_ instanceof Error ? error_.message : 'Could not prepare checkout.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCaptureMockPayment() {
    if (!sessionToken || !orderId) {
      return;
    }

    setBusyAction('payment');
    setFeedback(null);

    try {
      await api.verifyPayment(sessionToken, orderId, { method: 'mock' });
      await reloadOrder();
      setFeedback('Payment secured. You can now reveal the voucher.');
    } catch (error_) {
      setFeedback(error_ instanceof Error ? error_.message : 'Could not capture payment.');
    } finally {
      setBusyAction(null);
    }
  }

  async function pollUntilEscrowActive() {
    for (let i = 0; i < 5; i++) {
      await new Promise<void>((resolve) => setTimeout(resolve, 2000));
      if (!sessionToken || !orderId) break;
      try {
        const refreshed = await api.getOrder(sessionToken, orderId);
        if (refreshed.status === 'ESCROW_ACTIVE') {
          await reloadOrder();
          setFeedback('Payment secured. You can now reveal the voucher.');
          setBusyAction(null);
          return;
        }
      } catch {
        // ignore transient errors during polling
      }
    }
    setFeedback('Payment is being verified. Check back shortly.');
    setBusyAction(null);
  }

  useEffect(() => {
    const subscription = Linking.addEventListener('url', (event) => {
      if (event.url.includes('payment-callback')) {
        void pollUntilEscrowActive();
      }
    });
    return () => { subscription.remove(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken, orderId]);

  async function handleRazorpayLinkPayment(checkout: Checkout) {
    if (!checkout.paymentLinkUrl) {
      setFeedback('Payment link URL is missing. Try again.');
      return;
    }

    setBusyAction('payment');
    setFeedback(null);

    await openBrowserAsync(checkout.paymentLinkUrl);
    await pollUntilEscrowActive();
  }

  async function handleReveal() {
    if (!sessionToken || !orderId) {
      return;
    }

    setBusyAction('reveal');
    setFeedback(null);

    try {
      const result = await api.revealCode(sessionToken, orderId);
      setReveal(result);
      await reloadOrder();
      setFeedback('Voucher revealed. The verification timer is now live.');
    } catch (error_) {
      setFeedback(error_ instanceof Error ? error_.message : 'Could not reveal voucher.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleConfirm() {
    if (!sessionToken || !orderId) {
      return;
    }

    setBusyAction('confirm');
    setFeedback(null);

    try {
      await api.confirmOrder(sessionToken, orderId);
      await reloadOrder();
      setFeedback('Payment sent to the seller.');
    } catch (error_) {
      setFeedback(error_ instanceof Error ? error_.message : 'Could not confirm order.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDispute() {
    if (!sessionToken || !orderId) {
      return;
    }

    setBusyAction('dispute');
    setFeedback(null);

    try {
      await api.createDispute(sessionToken, orderId, {
        reason,
        description,
        evidenceUrls: evidence
          .split('\n')
          .map((item) => item.trim())
          .filter(Boolean),
      });
      await reloadOrder();
      setFeedback('Dispute raised. Your payment is held until this is resolved.');
    } catch (error_) {
      setFeedback(error_ instanceof Error ? error_.message : 'Could not create dispute.');
    } finally {
      setBusyAction(null);
    }
  }

  if (orderResource.loading && !orderResource.data) {
    return (
      <ScreenShell title="Loading order..." scroll={false}>
        <ActivityIndicator color={theme.colors.brand} />
      </ScreenShell>
    );
  }

  if (!orderResource.data) {
    return (
      <ScreenShell title="Order unavailable" scroll={false}>
        <Text
          className="text-body font-bold"
          style={{ color: theme.colors.danger }}>
          {orderResource.error ?? 'Order not found.'}
        </Text>
      </ScreenShell>
    );
  }

  const order = orderResource.data;
  const isBuyer = order.buyerId === user?.id;
  const nextAction = nextActionLabel(order.status, isBuyer);
  const flowSteps = buildFlowSteps(order.status);
  const resolvedCheckout = checkout ?? buildCheckoutFromOrder(order);

  return (
    <ScreenShell
      eyebrow="Order"
      subtitle={isBuyer ? 'Pay, reveal, and verify before the timer ends.' : 'Track payment and payout status.'}
      title={order.listing.brand.name}>
      <TicketCard
        eyebrow={formatStatus(order.status)}
        meta={formatCountdown(order.verificationDeadline)}
        subtitle={`${formatCurrency(order.amount)} • ${isBuyer ? 'Buyer' : 'Seller'} view`}
        title={nextAction}
        tone={cardToneForStatus(order.status)}>
        <View className="mt-2 flex-row flex-wrap gap-2">
          <StatusPill
            label={order.payment?.escrowStatus ? formatStatus(order.payment.escrowStatus) : 'Pending funding'}
            tone={pillToneForStatus(order.payment?.escrowStatus ?? order.status)}
          />
          {order.dispute ? <StatusPill label="Dispute open" tone="danger" /> : null}
        </View>
        <KeylineRow label="Created" value={formatDateTime(order.createdAt)} />
        <KeylineRow
          label="Verification"
          value={order.verificationDeadline ? formatDateTime(order.verificationDeadline) : 'Starts after reveal'}
        />
        <KeylineRow label="Payout" value={formatCurrency(order.sellerPayout)} />
      </TicketCard>

      <SectionPanel
        description="Your payment is held safely until you confirm the voucher works."
        title="How it works">
        <View className="flex-row flex-wrap gap-2">
          {flowSteps.map((step) => (
            <StatusPill key={step.label} label={step.label} tone={step.tone} />
          ))}
        </View>
      </SectionPanel>

      {order.verificationDeadline ? (
        <SectionPanel title="Verification window">
          <KeylineRow label="Deadline" value={formatDateTime(order.verificationDeadline)} />
          <View
            className="self-start rounded-app-sm px-4 py-2"
            style={{
              backgroundColor: theme.colors.countdownSoft,
              borderWidth: 1,
              borderColor: theme.colors.countdown,
            }}>
            <Text
              className="font-display text-title font-bold"
              style={{ color: theme.colors.countdown }}>
              {formatCountdown(order.verificationDeadline)}
            </Text>
          </View>
        </SectionPanel>
      ) : null}

      {reveal ? (
        <SectionPanel eyebrow={`Reveal ${String(reveal.revealCount)}`} title="Voucher">
          <View
            className="mt-2 overflow-hidden rounded-app-lg border bg-surface-raised dark:bg-surface-raised-dark"
            style={{ borderColor: theme.colors.pillBrandBorder }}>
            <Image
              contentFit="contain"
              source={{ uri: reveal.watermarkedCodeImageUrl }}
              style={{
                width: '100%',
                aspectRatio: 16 / 9,
                backgroundColor: theme.colors.surfaceRaised,
              }}
            />
          </View>
          <KeylineRow label="Window" value={`${String(reveal.verificationWindowHours)} hours`} />
          <Text
            className="text-caption leading-[18px]"
            style={{ color: theme.colors.inkMuted }}>
            Watermarked reveal is active. Confirm or dispute before the window ends.
          </Text>
        </SectionPanel>
      ) : null}

      {order.status === 'PAYMENT_PENDING' && resolvedCheckout?.provider === 'MOCK' ? (
        <SectionPanel eyebrow="DEV" title="Mock checkout">
          <KeylineRow label="Receipt" value={resolvedCheckout.receipt ?? ''} />
          <Text className="text-caption leading-[18px]" style={{ color: theme.colors.inkMuted }}>
            Development mode — captures payment instantly without a real transaction.
          </Text>
        </SectionPanel>
      ) : null}

      {feedback ? (
        <View
          className="rounded-app-lg border p-4"
          style={
            feedback.includes('Could not')
              ? {
                  backgroundColor: theme.colors.dangerSoft,
                  borderColor: theme.colors.pillDangerBorder,
                }
              : {
                  backgroundColor: theme.colors.successSoft,
                  borderColor: theme.colors.pillSuccessBorder,
                }
          }>
          <Text
            className="text-body font-bold"
            style={{ color: feedback.includes('Could not') ? theme.colors.danger : theme.colors.success }}>
            {feedback}
          </Text>
        </View>
      ) : null}

      {isBuyer ? (
        <SectionPanel title="Actions">
          <View className="gap-3">
            {order.status === 'PAYMENT_PENDING' ? (
              <>
                {!resolvedCheckout ? (
                  <PrimaryButton
                    label="Prepare checkout"
                    loading={busyAction === 'checkout'}
                    onPress={() => { void handlePrepareCheckout(); }}
                  />
                ) : null}
                {resolvedCheckout?.provider === 'MOCK' ? (
                  <PrimaryButton
                    label="Capture mock payment"
                    loading={busyAction === 'payment'}
                    onPress={() => { void handleCaptureMockPayment(); }}
                    tone="secondary"
                  />
                ) : null}
                {resolvedCheckout?.provider === 'RAZORPAY' ? (
                  <PrimaryButton
                    label="Pay now"
                    loading={busyAction === 'payment'}
                    onPress={() => { void handleRazorpayLinkPayment(resolvedCheckout); }}
                    tone="action"
                  />
                ) : null}
              </>
            ) : null}

            {(order.status === 'ESCROW_ACTIVE' || order.status === 'CODE_REVEALED') ? (
              <PrimaryButton
                label="Reveal voucher"
                loading={busyAction === 'reveal'}
                onPress={() => {
                  void handleReveal();
                }}
                tone="secondary"
              />
            ) : null}

            {(order.status === 'CODE_REVEALED' || order.status === 'DISPUTED') ? (
              <PrimaryButton
                label="Confirm code works"
                loading={busyAction === 'confirm'}
                onPress={() => {
                  void handleConfirm();
                }}
              />
            ) : null}
          </View>
        </SectionPanel>
      ) : (
        <SectionPanel title="Seller">
          <KeylineRow
            label="Current state"
            value={order.payment?.escrowStatus ? formatStatus(order.payment.escrowStatus) : 'Pending'}
          />
          <KeylineRow label="Next payout" value={formatCurrency(order.sellerPayout)} />
        </SectionPanel>
      )}

      {isBuyer && order.status === 'CODE_REVEALED' ? (
        <SectionPanel eyebrow="Issue" title="Raise dispute">
          <View className="mt-2 gap-3">
            <TextField
              autoCapitalize="none"
              helperText="Use a short machine-friendly reason, for example voucher-invalid."
              label="Reason"
              onChangeText={setReason}
              value={reason}
            />
            <TextField
              helperText="Describe what failed during verification."
              label="What happened"
              multiline
              onChangeText={setDescription}
              value={description}
            />
            <TextField
              autoCapitalize="none"
              helperText="Add one evidence URL per line if you have screenshots or proofs."
              label="Evidence URLs"
              multiline
              onChangeText={setEvidence}
              placeholder="One URL per line"
              value={evidence}
            />
            <PrimaryButton
              disabled={description.trim().length < 10}
              label="Submit dispute"
              loading={busyAction === 'dispute'}
              onPress={() => {
                void handleDispute();
              }}
              tone="danger"
            />
          </View>
        </SectionPanel>
      ) : null}

      {order.dispute ? (
        <SectionPanel eyebrow="Dispute" title={formatStatus(order.dispute.status)}>
          <KeylineRow label="Reason" value={order.dispute.reason} />
          <Text
            className="text-body leading-[21px]"
            style={{ color: theme.colors.inkMuted }}>
            {order.dispute.description}
          </Text>
        </SectionPanel>
      ) : null}
    </ScreenShell>
  );
}
