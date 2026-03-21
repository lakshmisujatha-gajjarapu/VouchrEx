import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { StatusPill } from '@/components/status-pill';
import { TextField } from '@/components/text-field';
import { useAuth } from '@/hooks/use-auth';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { api, type Checkout, type RevealResult } from '@/lib/api';
import { formatCountdown, formatCurrency, formatDate, formatDateTime, formatStatus } from '@/lib/format';
import { useTheme } from '@/theme/ThemeContext';

function cardToneForStatus(status: string): 'neutral' | 'brand' | 'success' | 'danger' {
  if (status === 'DISPUTED' || status === 'CANCELLED' || status === 'PAYMENT_FAILED') return 'danger';
  if (status === 'CONFIRMED' || status === 'AUTO_CONFIRMED') return 'success';
  if (status === 'ESCROW_ACTIVE' || status === 'CODE_REVEALED') return 'brand';
  return 'neutral';
}

function pillToneForStatus(status?: string | null): 'neutral' | 'brand' | 'success' | 'danger' | 'warning' {
  if (!status) return 'neutral';
  if (status === 'PAYMENT_PENDING') return 'warning';
  if (status === 'ESCROW_ACTIVE') return 'brand';
  if (status === 'CODE_REVEALED' || status === 'CONFIRMED' || status === 'AUTO_CONFIRMED' || status === 'RELEASED') return 'success';
  if (status === 'DISPUTED' || status === 'PAYMENT_FAILED' || status === 'CANCELLED') return 'danger';
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

function nextActionLabel(status: string, isBuyer: boolean) {
  if (status === 'PAYMENT_PENDING') return isBuyer ? 'Pay to secure your order' : 'Waiting for buyer payment';
  if (status === 'ESCROW_ACTIVE') return isBuyer ? 'Reveal and verify' : 'Payment secured';
  if (status === 'CODE_REVEALED') return isBuyer ? 'Confirm or dispute' : 'Waiting for buyer confirmation';
  if (status === 'DISPUTED') return 'Dispute in review';
  if (status === 'CONFIRMED' || status === 'AUTO_CONFIRMED') return isBuyer ? 'Order settled' : 'Payout released';
  return 'No action needed';
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

function parseCheckoutAmount(value?: string | string[]) {
  const rawValue = firstRouteParam(value);
  if (!rawValue) return null;
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
  if (!provider || (provider !== 'MOCK' && provider !== 'RAZORPAY')) return null;
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
  if (!orderId || amount === null || !currency || !receipt) return null;
  return { provider, orderId, amount, currency, receipt };
}

function buildCheckoutFromOrder(order: {
  readonly id: string;
  readonly amount: number;
  readonly platformFee: number;
  readonly status: string;
  readonly payment?: { readonly provider: 'MOCK' | 'RAZORPAY'; readonly currency: string; } | null;
}): Checkout | null {
  if (order.status !== 'PAYMENT_PENDING' || !order.payment) return null;
  if (order.payment.provider === 'RAZORPAY') return null;
  return { provider: 'MOCK', orderId: `mock_${order.id}`, amount: (order.amount + order.platformFee) * 100, currency: order.payment.currency, receipt: order.id };
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
  const router = useRouter();
  const [checkout, setCheckout] = useState<Checkout | null>(() => buildCheckoutFromRoute(params));
  const [reveal, setReveal] = useState<RevealResult | null>(null);
  const [reason, setReason] = useState('voucher-invalid');
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState('');
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

  async function handlePrepareCheckout() {
    if (!sessionToken || !orderId) return;
    setBusyAction('checkout'); setFeedback(null);
    try {
      const result = await api.prepareCheckout(sessionToken, orderId);
      setCheckout(result.checkout);
      setFeedback(result.checkout.provider === 'MOCK' ? 'Mock checkout prepared.' : 'Razorpay order ready.');
    } catch (error_) {
      setFeedback(error_ instanceof Error ? error_.message : 'Could not prepare checkout.');
    } finally { setBusyAction(null); }
  }

  async function handleCaptureMockPayment() {
    if (!sessionToken || !orderId) return;
    setBusyAction('payment'); setFeedback(null);
    try {
      await api.verifyPayment(sessionToken, orderId, { method: 'mock' });
      await reloadOrder();
      setFeedback('Payment secured. You can now reveal the voucher.');
    } catch (error_) {
      setFeedback(error_ instanceof Error ? error_.message : 'Could not capture payment.');
    } finally { setBusyAction(null); }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken, orderId, busyAction]);

  async function handleRazorpayLinkPayment(co: Checkout) {
    if (!co.paymentLinkUrl) { setFeedback('Payment link URL is missing.'); return; }
    setBusyAction('payment'); setFeedback(null);
    // openBrowserAsync resolves when the in-app browser is dismissed.
    // AppState 'active' event fires at the same time, which kicks off polling.
    await openBrowserAsync(co.paymentLinkUrl);
  }

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
    setBusyAction('dispute'); setFeedback(null);
    try {
      await api.createDispute(sessionToken, orderId, {
        reason,
        description,
        evidenceUrls: evidence.split('\n').map((item) => item.trim()).filter(Boolean),
      });
      await reloadOrder();
      setFeedback('Dispute raised. Your payment is held until this is resolved.');
    } catch (error_) {
      setFeedback(error_ instanceof Error ? error_.message : 'Could not create dispute.');
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
  const resolvedCheckout = checkout ?? buildCheckoutFromOrder(order);
  const badgeColors = escrowBadgeColors(order.status, theme);
  const accentColor = cardToneForStatus(order.status) === 'danger'
    ? theme.colors.danger
    : cardToneForStatus(order.status) === 'success'
      ? theme.colors.success
      : theme.colors.actionFixed;

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
                      {(order.listing.brand?.name ?? 'V').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: theme.fontFamily.headline, fontSize: 18, fontWeight: '700', color: theme.colors.ink }}>
                      {order.listing.brand?.name ?? 'Voucher'}
                    </Text>
                    <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 13, color: theme.colors.inkMuted, marginTop: 2 }}>
                      Sold by @{order.listing.seller?.name ?? order.seller?.name ?? 'Seller'}
                    </Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontFamily: theme.fontFamily.mono, fontSize: 22, fontWeight: '700', color: theme.colors.ink }}>
                    {formatCurrency(order.amount)}
                  </Text>
                  <View style={{
                    marginTop: 6,
                    backgroundColor: `${theme.colors.actionFixed}40`,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 6,
                  }}>
                    <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 9, fontWeight: '700', color: theme.colors.action, textTransform: 'uppercase', letterSpacing: 1 }}>
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
                        <Pressable
                          disabled={busyAction === 'reveal'}
                          onPress={() => { void handleReveal(); }}
                          style={({ pressed }) => ({
                            width: '100%',
                            opacity: pressed ? 0.88 : 1,
                            transform: [{ scale: pressed ? 0.985 : 1 }],
                            borderRadius: 14,
                            overflow: 'hidden',
                          })}>
                          <LinearGradient
                            colors={[theme.colors.brandBright, theme.colors.brand]}
                            end={{ x: 1, y: 1 }}
                            start={{ x: 0, y: 0 }}
                            style={{
                              height: 52,
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 8,
                            }}>
                            {busyAction === 'reveal'
                              ? <ActivityIndicator color="#FFFFFF" />
                              : (
                                  <>
                                    <Ionicons name="key-outline" size={18} color="#FFFFFF" />
                                    <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700', fontFamily: theme.fontFamily.labelSemi }}>
                                      Reveal Code
                                    </Text>
                                  </>
                                )}
                          </LinearGradient>
                        </Pressable>
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

            {/* ── Dispute / secondary action ── */}
            {isBuyer && (order.status === 'CODE_REVEALED') ? (
              <View style={{ alignItems: 'center', marginBottom: 24 }}>
                <Pressable
                  onPress={() => { void handleDispute(); }}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12 })}>
                  <Ionicons name="flag-outline" size={16} color={theme.colors.danger} />
                  <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 13, fontWeight: '700', color: theme.colors.danger }}>
                    Raise Dispute
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {/* ── Dispute form ── */}
            {isBuyer && order.status === 'CODE_REVEALED' ? (
              <View style={{
                backgroundColor: theme.colors.surfaceRaised,
                borderRadius: 16,
                padding: 20,
                gap: 16,
                marginBottom: 24,
              }}>
                <Text style={{ fontFamily: theme.fontFamily.headline, fontSize: 16, fontWeight: '700', color: theme.colors.ink }}>
                  Raise Dispute
                </Text>
                <TextField
                  autoCapitalize="none"
                  helperText="Use a short machine-friendly reason, e.g. voucher-invalid."
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
                  helperText="Add one evidence URL per line."
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
                  onPress={() => { void handleDispute(); }}
                  tone="danger"
                />
              </View>
            ) : null}

            {/* ── Mock/Razorpay checkout (DEV) ── */}
            {order.status === 'PAYMENT_PENDING' && resolvedCheckout?.provider === 'MOCK' ? (
              <View style={{
                backgroundColor: theme.colors.surfaceRaised,
                borderRadius: 16,
                padding: 20,
                gap: 12,
                marginBottom: 24,
              }}>
                <Text style={{ fontFamily: theme.fontFamily.label, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: theme.colors.inkMuted }}>
                  DEV MODE
                </Text>
                <Text style={{ fontFamily: theme.fontFamily.headline, fontSize: 15, fontWeight: '700', color: theme.colors.ink }}>
                  Mock Checkout
                </Text>
                <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 13, color: theme.colors.inkMuted }}>
                  Receipt: {resolvedCheckout.receipt}
                </Text>
              </View>
            ) : null}

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

          {/* Confirm Receipt — only shown after code is revealed */}
          {isBuyer && order.status === 'CODE_REVEALED' ? (
            <PrimaryButton
              label="Voucher Works — Confirm"
              loading={busyAction === 'confirm'}
              onPress={() => { void handleConfirm(); }}
              tone="action"
            />
          ) : null}
        </View>

      </SafeAreaView>
    </View>
  );
}
