import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { RevealCodeButton } from '@/components/reveal-code-button';
import { StatusPill } from '@/components/status-pill';
import { TextField } from '@/components/text-field';
import { useAuth } from '@/hooks/use-auth';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { api, type Checkout, type RevealResult } from '@/lib/api';
import { formatCountdown, formatCurrency, formatDate, formatStatus } from '@/lib/format';
import { useTheme } from '@/theme/ThemeContext';

function cardToneForStatus(status: string): 'neutral' | 'brand' | 'success' | 'danger' {
  if (status === 'DISPUTED' || status === 'CANCELLED' || status === 'PAYMENT_FAILED') return 'danger';
  if (status === 'CONFIRMED' || status === 'AUTO_CONFIRMED') return 'success';
  if (status === 'ESCROW_ACTIVE' || status === 'CODE_REVEALED') return 'brand';
  return 'neutral';
}

function escrowBadgeLabel(status: string): string {
  if (status === 'PAYMENT_PENDING') return 'AWAITING PAYMENT';
  if (status === 'ESCROW_ACTIVE') return 'ACTIVE ESCROW';
  if (status === 'CODE_REVEALED') return 'CODE REVEALED';
  if (status === 'CONFIRMED' || status === 'AUTO_CONFIRMED') return 'ORDER SETTLED';
  if (status === 'DISPUTED') return 'DISPUTED';
  if (status === 'PAYMENT_FAILED') return 'PAYMENT FAILED';
  if (status === 'CANCELLED') return 'CANCELLED';
  return 'IN PROGRESS';
}

function escrowBadgeColors(status: string, theme: ReturnType<typeof useTheme>): { bg: string; border: string; text: string } {
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

function buildFlowSteps(status: string): readonly { label: string; tone: 'neutral' | 'brand' | 'success' | 'danger' | 'warning' }[] {
  if (status === 'PAYMENT_PENDING') return [{ label: 'Payment', tone: 'warning' }, { label: 'Secured', tone: 'neutral' }, { label: 'Reveal', tone: 'neutral' }, { label: 'Confirm', tone: 'neutral' }];
  if (status === 'ESCROW_ACTIVE') return [{ label: 'Payment', tone: 'success' }, { label: 'Secured', tone: 'brand' }, { label: 'Reveal', tone: 'neutral' }, { label: 'Confirm', tone: 'neutral' }];
  if (status === 'CODE_REVEALED') return [{ label: 'Payment', tone: 'success' }, { label: 'Secured', tone: 'success' }, { label: 'Reveal', tone: 'brand' }, { label: 'Confirm', tone: 'warning' }];
  if (status === 'DISPUTED') return [{ label: 'Payment', tone: 'success' }, { label: 'Secured', tone: 'success' }, { label: 'Reveal', tone: 'success' }, { label: 'Dispute', tone: 'danger' }];
  if (status === 'CONFIRMED' || status === 'AUTO_CONFIRMED') return [{ label: 'Payment', tone: 'success' }, { label: 'Secured', tone: 'success' }, { label: 'Reveal', tone: 'success' }, { label: 'Confirm', tone: 'success' }];
  return [{ label: 'Payment', tone: 'neutral' }, { label: 'Secured', tone: 'neutral' }, { label: 'Reveal', tone: 'neutral' }, { label: 'Confirm', tone: 'neutral' }];
}

function firstRouteParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function buildCheckoutFromRoute(params: {
  readonly checkoutPaymentLinkUrl?: string | string[];
  readonly checkoutPaymentLinkId?: string | string[];
}): Checkout | null {
  const paymentLinkUrl = firstRouteParam(params.checkoutPaymentLinkUrl);
  const paymentLinkId = firstRouteParam(params.checkoutPaymentLinkId);
  if (!paymentLinkUrl || !paymentLinkId) return null;
  return { provider: 'RAZORPAY', paymentLinkUrl, paymentLinkId };
}

export default function OrderDetailScreen() {
  const params = useLocalSearchParams<{
    readonly id?: string | string[];
    readonly checkoutPaymentLinkUrl?: string | string[];
    readonly checkoutPaymentLinkId?: string | string[];
  }>();
  const orderId = useMemo(() => firstRouteParam(params.id), [params.id]);
  const { sessionToken, user } = useAuth();
  const theme = useTheme();
  const router = useRouter();
  const [checkout, setCheckout] = useState<Checkout | null>(() => buildCheckoutFromRoute(params));
  const [reveal, setReveal] = useState<RevealResult | null>(null);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reason, setReason] = useState('voucher-invalid');
  const [description, setDescription] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const orderResource = useAsyncResource(
    useCallback(() => {
      if (!sessionToken) throw new Error('Session missing.');
      if (!orderId) throw new Error('Order ID is missing.');
      return api.getOrder(sessionToken, orderId);
    }, [orderId, sessionToken]),
    { enabled: Boolean(orderId && sessionToken) },
  );

  async function reloadOrder() { return orderResource.reload(); }

  // Auto-sync once when screen loads with a PAYMENT_PENDING order.
  // Handles the case where the user paid in a previous session and comes back.
  useEffect(() => {
    const order = orderResource.data;
    if (!order || order.status !== 'PAYMENT_PENDING' || !sessionToken || !orderId) return;
    const isBuyer = order.buyerId === user?.id;
    if (!isBuyer) return;
    void api.syncPayment(sessionToken, orderId)
      .then((result) => { if (result.synced) void reloadOrder(); })
      .catch(() => { /* silent — reconciliation will catch it */ });
  // Run once when order data first loads.
  }, [orderResource.data?.id, orderResource.data?.status]);

  async function handlePrepareCheckout() {
    if (!sessionToken || !orderId) return;
    setBusyAction('payment'); setFeedback(null);
    try {
      let co = checkout;
      if (!co) {
        const result = await api.prepareCheckout(sessionToken, orderId);
        co = result.checkout;
        setCheckout(co);
      }
      await openBrowserAsync(co.paymentLinkUrl);
      // Browser dismissed — start polling immediately to detect payment completion.
      void pollUntilEscrowActive();
    } catch (error_) {
      setFeedback(error_ instanceof Error ? error_.message : 'Could not prepare checkout.');
      setBusyAction(null);
    }
  }

  // Polls DB + proactively pulls Razorpay status so we don't wait for a slow webhook.
  // maxAttempts × intervalMs = 45 s, which covers Razorpay's typical webhook lag.
  async function pollUntilEscrowActive() {
    const maxAttempts = 15;
    const intervalMs = 3_000;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
      if (!sessionToken || !orderId) break;
      try {
        // Sync call: backend pulls Razorpay and activates escrow if paid.
        await api.syncPayment(sessionToken, orderId);
        const refreshed = await api.getOrder(sessionToken, orderId);
        if (refreshed.status === 'ESCROW_ACTIVE') {
          await reloadOrder();
          setFeedback('Payment secured. You can now reveal the voucher.');
          setBusyAction(null);
          return;
        }
        if (refreshed.status !== 'PAYMENT_PENDING') {
          // Moved to a terminal state (cancelled etc.) — stop polling.
          await reloadOrder();
          setBusyAction(null);
          return;
        }
      } catch { /* ignore transient errors */ }
    }
    // Polling window exhausted. Let the user know but don't leave them stuck —
    // they can pull-to-refresh or navigate back.
    await reloadOrder();
    setFeedback('Payment verification is taking longer than usual. Pull down to refresh.');
    setBusyAction(null);
  }

  // Re-trigger polling when the app returns to the foreground after the user
  // visited the Razorpay payment page (handles cases where the deep link
  // callback was not delivered or the browser closed without redirecting).
  useEffect(() => {
    let isPolling = false;

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && busyAction === 'payment' && !isPolling) {
        isPolling = true;
        void pollUntilEscrowActive().finally(() => { isPolling = false; });
      }
    });

    const linkSub = Linking.addEventListener('url', (event) => {
      if (event.url.includes('payment-callback') && !isPolling) {
        isPolling = true;
        void pollUntilEscrowActive().finally(() => { isPolling = false; });
      }
    });

    return () => {
      appStateSub.remove();
      linkSub.remove();
    };
  }, [sessionToken, orderId, busyAction]);


  async function handleReveal() {
    if (!sessionToken || !orderId) return;
    setBusyAction('reveal'); setFeedback(null);
    try {
      const result = await api.revealCode(sessionToken, orderId);
      setReveal(result);
      await reloadOrder();
      setFeedback('Voucher revealed. The verification timer is now live.');
    } catch (error_) {
      setFeedback(error_ instanceof Error ? error_.message : 'Could not reveal voucher.');
    } finally { setBusyAction(null); }
  }

  async function handleConfirm() {
    if (!sessionToken || !orderId) return;
    setBusyAction('confirm'); setFeedback(null);
    try {
      await api.confirmOrder(sessionToken, orderId);
      await reloadOrder();
      setFeedback('Payment sent to the seller.');
    } catch (error_) {
      setFeedback(error_ instanceof Error ? error_.message : 'Could not confirm order.');
    } finally { setBusyAction(null); }
  }

  async function handleDispute() {
    if (!sessionToken || !orderId) return;
    setBusyAction('dispute');
    try {
      await api.createDispute(sessionToken, orderId, { reason, description, evidenceUrls: [] });
      setDisputeOpen(false);
      await reloadOrder();
      setFeedback('Dispute raised. Your payment is held until this is resolved.');
    } catch (error_) {
      setFeedback(error_ instanceof Error ? error_.message : 'Could not raise dispute.');
    } finally { setBusyAction(null); }
  }

  // ── Loading / error states ──
  if (orderResource.loading && !orderResource.data) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} edges={['top', 'left', 'right']}>
          <ActivityIndicator color={theme.colors.brand} size="large" />
        </SafeAreaView>
      </View>
    );
  }

  if (!orderResource.data) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
          <Pressable onPress={() => { router.back(); }} style={{ padding: 20 }}>
            <Ionicons name="close" size={24} color={theme.colors.ink} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 15, color: theme.colors.danger, textAlign: 'center' }}>
              {orderResource.error ?? 'Order not found.'}
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const order = orderResource.data;
  const isBuyer = order.buyerId === user?.id;
  const badgeColors = escrowBadgeColors(order.status, theme);
  const accentColor = cardToneForStatus(order.status) === 'danger'
    ? theme.colors.danger
    : cardToneForStatus(order.status) === 'success'
      ? theme.colors.success
      : theme.colors.brand;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>

        {/* ── Top App Bar ── */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 14,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Pressable
              onPress={() => { router.back(); }}
              style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={24} color={theme.colors.ink} />
            </Pressable>
            <Text style={{
              fontFamily: theme.fontFamily.headline,
              fontSize: 26,
              fontWeight: '700',
              letterSpacing: -0.5,
              color: theme.colors.ink,
            }}>
              Order Detail
            </Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={{ paddingHorizontal: 20, gap: 0 }}>

            {/* ── Central status badge ── */}
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: badgeColors.bg,
                paddingHorizontal: 16,
                paddingVertical: 6,
                borderRadius: 9999,
                borderWidth: 1,
                borderColor: badgeColors.border,
              }}>
                <Ionicons name="shield-checkmark" size={16} color={badgeColors.text} />
                <Text style={{
                  fontFamily: theme.fontFamily.labelSemi,
                  fontSize: 11,
                  fontWeight: '700',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  color: badgeColors.text,
                }}>
                  {escrowBadgeLabel(order.status)}
                </Text>
              </View>
            </View>

            {/* ── Editorial headline ── */}
            <View style={{ alignItems: 'center', marginBottom: 32 }}>
              <Text style={{
                fontFamily: theme.fontFamily.label,
                fontSize: 13,
                color: theme.colors.inkMuted,
                marginBottom: 8,
              }}>
                Order #{order.id.slice(0, 8).toUpperCase()}
              </Text>
              <Text style={{
                fontFamily: theme.fontFamily.headlineExtra,
                fontSize: 36,
                fontWeight: '800',
                letterSpacing: -1,
                color: theme.colors.ink,
                textAlign: 'center',
              }}>
                {order.status === 'CONFIRMED' || order.status === 'AUTO_CONFIRMED'
                  ? 'Order Complete'
                  : order.status === 'DISPUTED'
                    ? 'Dispute Raised'
                    : 'Secure Voucher Release'}
              </Text>
            </View>

            {/* ── Ticket Card ── */}
            <View style={{
              backgroundColor: theme.colors.surface,
              borderRadius: 24,
              overflow: 'hidden',
              shadowColor: theme.colors.shadowStrong,
              shadowOffset: { width: 0, height: 20 },
              shadowOpacity: 1,
              shadowRadius: 50,
              elevation: 4,
              marginBottom: 24,
            }}>
              {/* Left accent stripe */}
              <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, backgroundColor: accentColor }} />

              {/* Top section */}
              <View style={{ padding: 24, paddingLeft: 28, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start', flex: 1 }}>
                  {/* Brand avatar */}
                  <View style={{
                    width: 56, height: 56, borderRadius: 16,
                    backgroundColor: theme.colors.surfaceHigh,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontFamily: theme.fontFamily.headlineExtra, fontSize: 22, color: theme.colors.brand }}>
                      {order.listing.brand.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: theme.fontFamily.headline, fontSize: 18, fontWeight: '700', color: theme.colors.ink }}>
                      {order.listing.brand.name}
                    </Text>
                    <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 13, color: theme.colors.inkMuted, marginTop: 2 }}>
                      Sold by @{order.listing.seller.name}
                    </Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontFamily: theme.fontFamily.mono, fontSize: 22, fontWeight: '700', color: theme.colors.ink }}>
                    {formatCurrency(order.amount)}
                  </Text>
                  <View style={{
                    marginTop: 6,
                    backgroundColor: theme.colors.brandSoft,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 6,
                  }}>
                    <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 9, fontWeight: '700', color: theme.colors.brand, textTransform: 'uppercase', letterSpacing: 1 }}>
                      VERIFIED
                    </Text>
                  </View>
                </View>
              </View>

              {/* Perforation line */}
              <View style={{ position: 'relative', height: 1, marginHorizontal: 16 }}>
                <View style={{ position: 'absolute', left: 0, right: 0, top: 0, borderTopWidth: 1.5, borderColor: theme.colors.surfaceHigh, borderStyle: 'dashed' }} />
                <View style={{ position: 'absolute', left: -28, top: -10, width: 20, height: 20, borderRadius: 10, backgroundColor: theme.colors.background }} />
                <View style={{ position: 'absolute', right: -28, top: -10, width: 20, height: 20, borderRadius: 10, backgroundColor: theme.colors.background }} />
              </View>

              {/* Bottom section */}
              <View style={{ padding: 24, paddingLeft: 28, gap: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 13, color: theme.colors.inkMuted }}>Voucher Validity</Text>
                  <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 13, fontWeight: '600', color: theme.colors.ink }}>
                    {formatDate(order.listing.expiryDate)}
                  </Text>
                </View>
                {order.verificationDeadline ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 13, color: theme.colors.inkMuted }}>Verify by</Text>
                    <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 13, fontWeight: '600', color: theme.colors.countdown }}>
                      {formatCountdown(order.verificationDeadline)}
                    </Text>
                  </View>
                ) : null}

                {/* Reveal section */}
                {!reveal && (order.status === 'ESCROW_ACTIVE' || order.status === 'CODE_REVEALED') ? (
                  <View style={{
                    backgroundColor: theme.colors.surfaceHigh,
                    borderRadius: 16,
                    padding: 20,
                    alignItems: 'center',
                    gap: 12,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="eye-off-outline" size={18} color={theme.colors.inkMuted} />
                      <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 13, fontWeight: '500', color: theme.colors.inkMuted }}>
                        Voucher code is locked
                      </Text>
                    </View>
                    {isBuyer ? (
                      <>
                        <View style={{ alignSelf: 'stretch' }}>
                          <RevealCodeButton
                            disabled={busyAction === 'reveal'}
                            loading={busyAction === 'reveal'}
                            onPress={() => { void handleReveal(); }}
                          />
                        </View>
                        <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 11, color: theme.colors.inkMuted, textAlign: 'center', lineHeight: 16 }}>
                          By revealing the code, you acknowledge that the voucher is now your responsibility.
                        </Text>
                      </>
                    ) : null}
                  </View>
                ) : null}

                {/* Revealed code */}
                {reveal ? (
                  <View style={{ gap: 12 }}>
                    <View style={{
                      borderRadius: 14,
                      overflow: 'hidden',
                      borderWidth: 1,
                      borderColor: theme.colors.pillBrandBorder,
                    }}>
                      <Image
                        contentFit="contain"
                        source={{ uri: reveal.watermarkedCodeImageUrl }}
                        style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: theme.colors.surfaceRaised }}
                      />
                    </View>
                    <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 12, color: theme.colors.inkMuted, textAlign: 'center' }}>
                      Watermarked reveal · Confirm or dispute within {String(reveal.verificationWindowHours)}h
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* ── Flow steps ── */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
              {buildFlowSteps(order.status).map((step) => (
                <StatusPill key={step.label} label={step.label} tone={step.tone} />
              ))}
              {order.dispute ? <StatusPill label="Dispute open" tone="danger" /> : null}
            </View>



            {/* ── Seller panel ── */}
            {!isBuyer ? (
              <View style={{
                backgroundColor: theme.colors.surfaceRaised,
                borderRadius: 16,
                padding: 20,
                gap: 12,
                marginBottom: 24,
              }}>
                <Text style={{ fontFamily: theme.fontFamily.headline, fontSize: 16, fontWeight: '700', color: theme.colors.ink }}>
                  Seller Overview
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 13, color: theme.colors.inkMuted }}>Current state</Text>
                  <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 13, fontWeight: '600', color: theme.colors.ink }}>
                    {order.payment?.escrowStatus ? formatStatus(order.payment.escrowStatus) : 'Pending'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 13, color: theme.colors.inkMuted }}>Next payout</Text>
                  <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 13, fontWeight: '600', color: theme.colors.ink }}>
                    {formatCurrency(order.sellerPayout)}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* ── Feedback banner ── */}
            {feedback ? (
              <View style={{
                borderRadius: 14,
                padding: 16,
                marginBottom: 24,
                backgroundColor: feedback.includes('Could not') ? theme.colors.dangerSoft : theme.colors.successSoft,
              }}>
                <Text style={{
                  fontFamily: theme.fontFamily.labelSemi,
                  fontSize: 14,
                  fontWeight: '600',
                  color: feedback.includes('Could not') ? theme.colors.danger : theme.colors.success,
                }}>
                  {feedback}
                </Text>
              </View>
            ) : null}

            {/* ── Security notice ── */}
            <View style={{
              backgroundColor: theme.colors.surfaceTray,
              borderRadius: 16,
              padding: 20,
              flexDirection: 'row',
              gap: 14,
              marginBottom: 24,
            }}>
              <Ionicons name="shield-checkmark" size={22} color={theme.colors.brand} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: theme.fontFamily.headline, fontSize: 14, fontWeight: '700', color: theme.colors.ink, marginBottom: 4 }}>
                  Protected by CouponBazaar Escrow
                </Text>
                <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 13, color: theme.colors.inkSecondary, lineHeight: 18 }}>
                  Your funds are held securely until you confirm receipt. The seller only receives payment after your approval.
                </Text>
              </View>
            </View>

            {/* ── Dispute info ── */}
            {order.dispute ? (
              <View style={{
                backgroundColor: theme.colors.dangerSoft,
                borderRadius: 16,
                padding: 20,
                gap: 8,
                marginBottom: 24,
              }}>
                <Text style={{ fontFamily: theme.fontFamily.headline, fontSize: 14, fontWeight: '700', color: theme.colors.danger }}>
                  Dispute: {formatStatus(order.dispute.status)}
                </Text>
                <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 13, color: theme.colors.danger }}>
                  {order.dispute.reason}
                </Text>
                <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 13, color: theme.colors.inkSecondary, lineHeight: 18 }}>
                  {order.dispute.description}
                </Text>
              </View>
            ) : null}

          </View>
        </ScrollView>

        {/* ── Sticky footer ── */}
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: theme.colors.surface,
          borderTopWidth: 1,
          borderTopColor: theme.colors.surfaceHigh,
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 32,
          gap: 8,
        }}>
          {/* Buyer payment flow */}
          {isBuyer && order.status === 'PAYMENT_PENDING' ? (
            <PrimaryButton
              label="Pay now"
              loading={busyAction === 'payment'}
              onPress={() => { void handlePrepareCheckout(); }}
              tone="action"
            />
          ) : null}

          {/* Confirm Receipt — only shown after code is revealed */}
          {isBuyer && order.status === 'CODE_REVEALED' ? (
            <>
              <PrimaryButton
                label="Voucher Works — Confirm"
                loading={busyAction === 'confirm'}
                onPress={() => { void handleConfirm(); }}
                tone="brand"
              />
              <Pressable
                onPress={() => { setDisputeOpen(true); }}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, alignItems: 'center', paddingVertical: 8 })}>
                <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 13, color: theme.colors.inkMuted }}>
                  Something wrong?{' '}
                  <Text style={{ color: theme.colors.danger, fontFamily: theme.fontFamily.labelSemi, fontWeight: '600' }}>
                    Raise a dispute
                  </Text>
                </Text>
              </Pressable>
            </>
          ) : null}
        </View>

        {/* ── Dispute bottom sheet ── */}
        <Modal
          animationType="slide"
          onRequestClose={() => { setDisputeOpen(false); }}
          transparent
          visible={disputeOpen}>
          <Pressable
            onPress={() => { setDisputeOpen(false); }}
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
          />
          <View style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 24,
            paddingTop: 12,
            paddingBottom: 40,
            gap: 20,
          }}>
            {/* Handle */}
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.colors.surfaceHighest, alignSelf: 'center' }} />

            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ gap: 2 }}>
                <Text style={{ fontFamily: theme.fontFamily.headline, fontSize: 20, fontWeight: '700', color: theme.colors.ink }}>
                  Raise a dispute
                </Text>
                <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 13, color: theme.colors.inkMuted }}>
                  Your payment stays held until resolved.
                </Text>
              </View>
              <Pressable
                onPress={() => { setDisputeOpen(false); }}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}>
                <Ionicons name="close" size={22} color={theme.colors.inkMuted} />
              </Pressable>
            </View>

            {/* Reason chips */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: theme.fontFamily.label, fontSize: 12, color: theme.colors.inkMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                What went wrong?
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {([
                  { label: 'Code doesn\'t work', value: 'voucher-invalid' },
                  { label: 'Already used', value: 'voucher-already-used' },
                  { label: 'Wrong voucher', value: 'wrong-voucher' },
                  { label: 'Expired', value: 'voucher-expired' },
                  { label: 'Other', value: 'other' },
                ] as const).map((opt) => {
                  const active = reason === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => { setReason(opt.value); }}
                      style={{
                        paddingHorizontal: 14, paddingVertical: 8,
                        borderRadius: 9999,
                        backgroundColor: active ? `${theme.colors.danger}18` : theme.colors.surfaceHigh,
                        borderWidth: active ? 1.5 : 1,
                        borderColor: active ? theme.colors.danger : theme.colors.border,
                      }}>
                      <Text style={{
                        fontFamily: theme.fontFamily.labelSemi,
                        fontSize: 13, fontWeight: '600',
                        color: active ? theme.colors.danger : theme.colors.inkSecondary,
                      }}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Description */}
            <TextField
              helperText="Be specific — this helps resolve it faster."
              label="Describe what happened"
              multiline
              onChangeText={setDescription}
              value={description}
            />

            <PrimaryButton
              disabled={description.trim().length < 10}
              label="Submit dispute"
              loading={busyAction === 'dispute'}
              onPress={() => { void handleDispute(); }}
              tone="danger"
            />
          </View>
        </Modal>

      </SafeAreaView>
    </View>
  );
}
