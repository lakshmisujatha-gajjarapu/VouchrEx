import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { openAuthSessionAsync } from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';

import { PrimaryButton } from '@/components/primary-button';
import { RevealCodeButton } from '@/components/reveal-code-button';
import { StatusPill } from '@/components/status-pill';
import { TextField } from '@/components/text-field';
import { useAuth } from '@/hooks/use-auth';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { useOrderSocket } from '@/hooks/use-order-socket';
import { api, apiBaseUrl, type Checkout, type RevealResult } from '@/lib/api';
import { formatCountdown, formatCurrency, formatDate, formatStatus } from '@/lib/format';
import { cardToneForStatus, escrowBadgeLabel, escrowBadgeColors, buildFlowSteps } from '@/lib/status';
import { useTheme } from '@/theme/theme-context';

function firstRouteParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function buildCheckoutFromRoute(params: {
  readonly checkoutRazorpayOrderId?: string | string[];
  readonly checkoutAmountPaise?: string | string[];
  readonly checkoutCurrency?: string | string[];
  readonly checkoutKeyId?: string | string[];
}): Checkout | null {
  const razorpayOrderId = firstRouteParam(params.checkoutRazorpayOrderId);
  const amountPaiseStr = firstRouteParam(params.checkoutAmountPaise);
  const currency = firstRouteParam(params.checkoutCurrency);
  const keyId = firstRouteParam(params.checkoutKeyId);
  if (!razorpayOrderId || !amountPaiseStr || !currency || !keyId) return null;
  return { provider: 'RAZORPAY', razorpayOrderId, amountPaise: Number(amountPaiseStr), currency, keyId };
}

export default function OrderDetailScreen() {
  const params = useLocalSearchParams<{
    readonly id?: string | string[];
    readonly checkoutRazorpayOrderId?: string | string[];
    readonly checkoutAmountPaise?: string | string[];
    readonly checkoutCurrency?: string | string[];
    readonly checkoutKeyId?: string | string[];
  }>();
  const orderId = useMemo(() => firstRouteParam(params.id), [params.id]);
  const { sessionToken, user } = useAuth();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const [checkout, setCheckout] = useState<Checkout | null>(() => buildCheckoutFromRoute(params));
  const [reveal, setReveal] = useState<RevealResult | null>(null);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reason, setReason] = useState('voucher-invalid');
  const [description, setDescription] = useState('');
  const [evidenceUris, setEvidenceUris] = useState<string[]>([]);
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [evidenceSheetOpen, setEvidenceSheetOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const orderResource = useAsyncResource(
    useCallback(() => {
      if (!sessionToken) throw new Error('Session missing.');
      if (!orderId) throw new Error('Order ID is missing.');
      return api.getOrder(sessionToken, orderId);
    }, [orderId, sessionToken]),
    { enabled: Boolean(orderId && sessionToken) },
  );

  const reloadOrder = useCallback(() => orderResource.reload(), [orderResource]);

  // Real-time: reload order whenever the server pushes a status change.
  useOrderSocket(orderId, useCallback(() => { void orderResource.reload(); }, [orderResource]));

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
    setBusyAction('payment');
    setFeedback(null);
    try {
      let co = checkout;
      if (!co) {
        const result = await api.prepareCheckout(sessionToken, orderId);
        co = result.checkout;
        setCheckout(co);
      }

      const checkoutPageUrl = `${apiBaseUrl}/payments/checkout-page?${new URLSearchParams({
        rzpOrderId: co.razorpayOrderId,
        amountPaise: String(co.amountPaise),
        currency: co.currency,
        keyId: co.keyId,
        appOrderId: orderId,
      }).toString()}`;

      const result = await openAuthSessionAsync(checkoutPageUrl, 'vouchrex://payment-callback');

      if (result.type !== 'success' || !result.url) {
        setFeedback('Payment cancelled.');
        setBusyAction(null);
        return;
      }

      const callbackUrl = new URL(result.url);
      const razorpayOrderId = callbackUrl.searchParams.get('razorpay_order_id');
      const razorpayPaymentId = callbackUrl.searchParams.get('razorpay_payment_id');
      const razorpaySignature = callbackUrl.searchParams.get('razorpay_signature');

      if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        setFeedback('Payment callback is incomplete. Pull down to check if your payment went through.');
        setBusyAction(null);
        return;
      }

      await api.verifyPayment(sessionToken, orderId, {
        method: 'razorpay',
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      });

      await reloadOrder();
      setFeedback('Payment secured. You can now reveal the voucher.');
    } catch (error_) {
      const message = error_ instanceof Error ? error_.message : '';
      setFeedback(message || 'Payment failed. Please try again.');
    } finally {
      setBusyAction(null);
    }
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
    setBusyAction('dispute');
    try {
      await api.createDispute(sessionToken, orderId, { reason, description });
      setDisputeOpen(false);
      await reloadOrder();
      setFeedback('Dispute raised. Attach screenshots within 24 hours to strengthen your case.');
    } catch (error_) {
      setFeedback(error_ instanceof Error ? error_.message : 'Could not raise dispute.');
    } finally { setBusyAction(null); }
  }

  async function compressImage(uri: string): Promise<{ uri: string; mimeType: string }> {
    const rendered = await ImageManipulator.ImageManipulator
      .manipulate(uri)
      .resize({ width: 1600 })
      .renderAsync();
    const saved = await rendered.saveAsync({ compress: 0.75, format: ImageManipulator.SaveFormat.JPEG });
    return { uri: saved.uri, mimeType: 'image/jpeg' };
  }

  async function pickAndUpload(source: 'camera' | 'gallery') {
    if (!sessionToken || !orderId) return;
    setEvidenceSheetOpen(false);

    let pickerResult: ImagePicker.ImagePickerResult;

    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== ImagePicker.PermissionStatus.GRANTED) {
        Alert.alert('Camera Access Denied', 'Enable it in Settings → Vouchrex to take photos.');
        return;
      }
      pickerResult = await ImagePicker.launchCameraAsync({ quality: 1 });
    } else {
      pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsMultipleSelection: false,
      });
    }

    if (pickerResult.canceled || pickerResult.assets.length === 0) return;

    setEvidenceUploading(true);
    try {
      const { uri, mimeType } = await compressImage(pickerResult.assets[0].uri);
      await api.uploadDisputeEvidence(sessionToken, orderId, uri, mimeType);
      setEvidenceUris((prev) => [...prev, uri]);
      await reloadOrder();
    } catch (error_) {
      setFeedback(error_ instanceof Error ? error_.message : 'Upload failed.');
    } finally {
      setEvidenceUploading(false);
    }
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
          <Pressable onPress={() => { router.back(); }} style={{ padding: theme.spacing[5] }}>
            <Ionicons name="close" size={24} color={theme.colors.ink} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing[5] }}>
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
          paddingHorizontal: theme.spacing[5],
          paddingVertical: 14,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[4] }}>
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
            <View style={{ alignItems: 'center', marginBottom: theme.spacing[6] }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: badgeColors.bg,
                paddingHorizontal: theme.spacing[4],
                paddingVertical: 6,
                borderRadius: theme.radius.pill,
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
            <View style={{ alignItems: 'center', marginBottom: theme.spacing[8] }}>
              <Text style={{
                fontFamily: theme.fontFamily.label,
                fontSize: 13,
                color: theme.colors.inkMuted,
                marginBottom: theme.spacing[2],
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
              borderRadius: theme.radius.lg,
              overflow: 'hidden',
              shadowColor: theme.colors.shadowStrong,
              shadowOffset: { width: 0, height: 20 },
              shadowOpacity: 1,
              shadowRadius: 50,
              elevation: 4,
              marginBottom: theme.spacing[6],
            }}>
              {/* Left accent stripe */}
              <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, backgroundColor: accentColor }} />

              {/* Top section */}
              <View style={{ padding: theme.spacing[6], paddingLeft: theme.spacing[7], flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', gap: theme.spacing[4], alignItems: 'flex-start', flex: 1 }}>
                  {/* Brand avatar — bg-surface-container-high per spec */}
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

              {/* Bottom section — bg-surface-container-low/50 per spec */}
              <View style={{ padding: theme.spacing[6], paddingLeft: theme.spacing[7], gap: theme.spacing[4], backgroundColor: theme.colors.glassSurface }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 13, color: theme.colors.inkMuted }}>Voucher Validity</Text>
                  <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 13, fontWeight: '600', color: theme.colors.ink }}>
                    {formatDate(order.listing.expiryDate)}
                  </Text>
                </View>
                {order.verificationDeadline ? (
                  <View style={{ backgroundColor: `${theme.colors.countdown}18`, borderRadius: theme.radius.sm, padding: theme.spacing[3], gap: theme.spacing[1] }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}>
                      <Ionicons name="flash" size={14} color={theme.colors.countdown} />
                      <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 14, fontWeight: '700', color: theme.colors.countdown }}>
                        Verify within {formatCountdown(order.verificationDeadline)}
                      </Text>
                    </View>
                    <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 12, color: theme.colors.inkMuted, lineHeight: 16 }}>
                      Order auto-confirms after this window closes.
                    </Text>
                  </View>
                ) : null}

                {/* Reveal section */}
                {!reveal && (order.status === 'ESCROW_ACTIVE' || order.status === 'CODE_REVEALED') ? (
                  <View style={{
                    backgroundColor: theme.colors.surfaceHigh,
                    borderRadius: 16,
                    padding: theme.spacing[5],
                    alignItems: 'center',
                    gap: theme.spacing[3],
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}>
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
                  <View style={{ gap: theme.spacing[3] }}>
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

                    {/* Copy code button */}
                    <Pressable
                      onPress={() => {
                        void Clipboard.setStringAsync(reveal.voucherCode).then(() => {
                          setCopied(true);
                          setTimeout(() => { setCopied(false); }, 2500);
                        });
                      }}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: theme.spacing[2],
                        paddingVertical: 13,
                        borderRadius: 14,
                        borderWidth: 1.5,
                        borderColor: copied ? theme.colors.pillSuccessBorder : theme.colors.pillBrandBorder,
                        backgroundColor: copied ? theme.colors.successSoft : theme.colors.brandSoft,
                        opacity: pressed ? 0.8 : 1,
                      })}>
                      <Ionicons
                        name={copied ? 'checkmark-circle' : 'copy-outline'}
                        size={18}
                        color={copied ? theme.colors.success : theme.colors.brand}
                      />
                      <Text style={{
                        fontFamily: theme.fontFamily.labelSemi,
                        fontSize: 14,
                        fontWeight: '600',
                        color: copied ? theme.colors.success : theme.colors.brand,
                      }}>
                        {copied ? 'Copied!' : 'Copy Code'}
                      </Text>
                    </Pressable>

                    {reveal.pin ? (
                      <View style={{ marginTop: theme.spacing[3], gap: theme.spacing[2] }}>
                        <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 13, fontWeight: '600', color: theme.colors.inkSecondary, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                          PIN
                        </Text>
                        <Text style={{ fontFamily: theme.fontFamily.mono, fontSize: 28, fontWeight: '700', color: theme.colors.ink, letterSpacing: 2 }}>
                          {reveal.pin}
                        </Text>
                      </View>
                    ) : null}

                    <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 12, color: theme.colors.inkMuted, textAlign: 'center' }}>
                      Watermarked reveal · Confirm or dispute within {String(reveal.verificationWindowHours)}h
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* ── Flow steps ── */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2], marginBottom: theme.spacing[6] }}>
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
                padding: theme.spacing[5],
                gap: theme.spacing[3],
                marginBottom: theme.spacing[6],
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
                padding: theme.spacing[4],
                marginBottom: theme.spacing[6],
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

            {/* ── Security notice ── bg-surface-container-low per spec */}
            <View style={{
              backgroundColor: theme.colors.surfaceRaised,
              borderRadius: 16,
              padding: theme.spacing[5],
              flexDirection: 'row',
              gap: 14,
              marginBottom: theme.spacing[6],
            }}>
              <Ionicons name="shield-checkmark" size={22} color={theme.colors.brand} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: theme.fontFamily.headline, fontSize: 14, fontWeight: '700', color: theme.colors.ink, marginBottom: 4 }}>
                  Protected by VouchrEx Escrow
                </Text>
                <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 13, color: theme.colors.inkSecondary, lineHeight: 18 }}>
                  Your funds are held securely until you confirm receipt. The seller only receives payment after your approval.
                </Text>
              </View>
            </View>

            {/* ── Dispute info ── */}
            {order.dispute ? (
              <View style={{ gap: theme.spacing[4], marginBottom: theme.spacing[6] }}>
                <View style={{
                  backgroundColor: theme.colors.dangerSoft,
                  borderRadius: 16,
                  padding: theme.spacing[5],
                  gap: theme.spacing[2],
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

                {/* Evidence upload section — only shown while window is open */}
                {isBuyer &&
                  order.dispute.evidenceDeadline &&
                  new Date() < new Date(order.dispute.evidenceDeadline) &&
                  ['OPEN', 'UNDER_REVIEW'].includes(order.dispute.status) ? (
                  <View style={{
                    backgroundColor: theme.colors.surface,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    padding: theme.spacing[5],
                    gap: theme.spacing[3],
                  }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 13, fontWeight: '600', color: theme.colors.ink }}>
                        Add Evidence
                      </Text>
                      <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 11, color: theme.colors.inkMuted }}>
                        {Math.max(0, Math.ceil((new Date(order.dispute.evidenceDeadline).getTime() - Date.now()) / 3_600_000))}h remaining
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', gap: theme.spacing[2] }}>
                      {evidenceUris.map((uri, idx) => (
                        <View key={idx} style={{ width: 64, height: 64, borderRadius: theme.radius.md, overflow: 'hidden' }}>
                          <Image source={{ uri }} style={{ width: 64, height: 64 }} contentFit="cover" />
                        </View>
                      ))}

                      {(order.dispute.evidenceUrls.length + evidenceUris.length) < 3 ? (
                        <Pressable
                          onPress={() => { setEvidenceSheetOpen(true); }}
                          disabled={evidenceUploading}
                          style={({ pressed }) => ({
                            width: 64, height: 64,
                            borderRadius: theme.radius.md,
                            borderWidth: 1.5,
                            borderColor: theme.colors.brand,
                            borderStyle: 'dashed',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: pressed || evidenceUploading ? 0.5 : 1,
                          })}>
                          {evidenceUploading
                            ? <ActivityIndicator size="small" color={theme.colors.brand} />
                            : <Ionicons name="add" size={22} color={theme.colors.brand} />}
                        </Pressable>
                      ) : null}
                    </View>

                    {order.dispute.evidenceUrls.length > 0 ? (
                      <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 12, color: theme.colors.inkMuted }}>
                        {order.dispute.evidenceUrls.length} image{order.dispute.evidenceUrls.length > 1 ? 's' : ''} uploaded
                      </Text>
                    ) : null}

                    <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 12, color: theme.colors.inkMuted }}>
                      Screenshots help resolve your dispute faster.
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

          </View>
        </ScrollView>

        {/* ── Sticky footer — glassmorphic ── */}
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: theme.spacing[5],
          paddingTop: theme.spacing[4],
          paddingBottom: Math.max(insets.bottom, theme.spacing[6]),
          gap: theme.spacing[2],
          overflow: 'hidden',
        }}>
          <BlurView
            intensity={60}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
            tint={colorScheme === 'dark' ? 'dark' : 'light'}
          />
          <View style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
            backgroundColor: theme.colors.glassSurface,
            borderTopWidth: 1,
            borderTopColor: theme.colors.borderHair,
          }} />
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
              <PrimaryButton
                label="Report Issue"
                loading={busyAction === 'dispute'}
                onPress={() => { setDisputeOpen(true); }}
                tone="danger"
              />
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
            style={{ flex: 1, backgroundColor: theme.colors.shadowStrong }}
          />
          <View style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: theme.spacing[6],
            paddingTop: theme.spacing[3],
            paddingBottom: 40,
            gap: theme.spacing[5],
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
            <View style={{ gap: theme.spacing[2] }}>
              <Text style={{ fontFamily: theme.fontFamily.label, fontSize: 12, color: theme.colors.inkMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                What went wrong?
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] }}>
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
                        borderRadius: theme.radius.pill,
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
              label="Describe what happened (optional)"
              multiline
              onChangeText={setDescription}
              value={description}
            />


            <PrimaryButton
              disabled={false}
              label="Submit dispute"
              loading={busyAction === 'dispute'}
              onPress={() => { void handleDispute(); }}
              tone="danger"
            />
          </View>
        </Modal>

        {/* ── Evidence source picker — cross-platform (Camera / Gallery) ── */}
        <Modal
          animationType="slide"
          onRequestClose={() => { setEvidenceSheetOpen(false); }}
          transparent
          visible={evidenceSheetOpen}>
          <Pressable
            onPress={() => { setEvidenceSheetOpen(false); }}
            style={{ flex: 1, backgroundColor: theme.colors.shadowStrong }}
          />
          <View style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: theme.spacing[6],
            paddingTop: theme.spacing[3],
            paddingBottom: Math.max(insets.bottom, theme.spacing[6]),
            gap: theme.spacing[3],
          }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.colors.surfaceHighest, alignSelf: 'center' }} />
            <Text style={{ fontFamily: theme.fontFamily.headline, fontSize: 17, fontWeight: '700', color: theme.colors.ink, textAlign: 'center' }}>
              Add Evidence
            </Text>
            <Pressable
              onPress={() => { void pickAndUpload('camera'); }}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3],
                backgroundColor: theme.colors.surfaceHigh,
                borderRadius: theme.radius.lg,
                padding: theme.spacing[4],
                opacity: pressed ? 0.7 : 1,
              })}>
              <Ionicons name="camera-outline" size={22} color={theme.colors.ink} />
              <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 15, color: theme.colors.ink }}>Take Photo</Text>
            </Pressable>
            <Pressable
              onPress={() => { void pickAndUpload('gallery'); }}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3],
                backgroundColor: theme.colors.surfaceHigh,
                borderRadius: theme.radius.lg,
                padding: theme.spacing[4],
                opacity: pressed ? 0.7 : 1,
              })}>
              <Ionicons name="images-outline" size={22} color={theme.colors.ink} />
              <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 15, color: theme.colors.ink }}>Choose from Gallery</Text>
            </Pressable>
            <Pressable
              onPress={() => { setEvidenceSheetOpen(false); }}
              style={({ pressed }) => ({ alignItems: 'center', paddingVertical: theme.spacing[3], opacity: pressed ? 0.6 : 1 })}>
              <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 15, color: theme.colors.inkMuted }}>Cancel</Text>
            </Pressable>
          </View>
        </Modal>

      </SafeAreaView>
    </View>
  );
}
