import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useDeferredValue, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfigChangeBanner } from '@/components/config-change-banner';
import { DateField } from '@/components/date-field';
import { FieldLabel } from '@/components/field-label';
import { FilterChip } from '@/components/filter-chip';
import { StatusBanner } from '@/components/status-banner';
import { SubmergedInput } from '@/components/submerged-input';
import { ProfileAvatar } from '@/components/profile-avatar';
import { useAuth } from '@/hooks/use-auth';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { useConfig } from '@/hooks/use-config';
import { api, type PayoutAccount } from '@/lib/api';
import { searchBrandfetchBrands } from '@/lib/brandfetch';
import { useTheme } from '@/theme/theme-context';

const VOUCHER_TYPES = ['gift-card', 'promo-code'] as const;
type VoucherType = (typeof VOUCHER_TYPES)[number];

type Suggestion = {
  readonly name: string;
  readonly meta: string;
  readonly source: 'local' | 'brandfetch';
};

function defaultExpiryDateString() {
  const d = new Date(Date.now() + 48 * 60 * 60 * 1000);
  return `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function normalizeBrandName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export default function SellScreen() {
  const { sessionToken } = useAuth();
  const theme = useTheme();
  const router = useRouter();
  const { listingMaxPriceInr } = useConfig();
  const reducedMotion = useReducedMotion();

  // ── Payout account gate ──────────────────────────────────────────
  const [payoutAccount, setPayoutAccount]   = useState<PayoutAccount | null>(null);
  const [payoutLoading, setPayoutLoading]   = useState(true);
  const [upiInput, setUpiInput]             = useState('');
  const [upiSubmitting, setUpiSubmitting]   = useState(false);
  const [upiError, setUpiError]             = useState<string | null>(null);

  useEffect(() => {
    if (!sessionToken) return;
    void api.getPayoutAccount(sessionToken)
      .then(setPayoutAccount)
      .catch(() => { setPayoutAccount({ registered: false }); })
      .finally(() => { setPayoutLoading(false); });
  }, [sessionToken]);

  async function handleRegisterUpi() {
    if (!sessionToken || !upiInput.trim()) return;
    setUpiSubmitting(true); setUpiError(null);
    try {
      const account = await api.registerPayoutAccount(sessionToken, {
        type: 'UPI',
        upiId: upiInput.trim()
      });
      setPayoutAccount(account);
    } catch (e) {
      setUpiError(e instanceof Error ? e.message : 'Could not register UPI. Try again.');
    } finally {
      setUpiSubmitting(false);
    }
  }
  // ─────────────────────────────────────────────────────────────────

  const [brandName, setBrandName]       = useState('');
  const [voucherType, setVoucherType]   = useState<VoucherType>('gift-card');
  const [faceValue, setFaceValue]       = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [expiryDate, setExpiryDate]     = useState(defaultExpiryDateString);
  const [code, setCode]                 = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [feedback, setFeedback]         = useState<string | null>(null);
  const [codeCopied, setCodeCopied]     = useState(false);
  const [pin, setPin]                             = useState('');
  const [pinCopied, setPinCopied]                 = useState(false);
  const [redemptionMode, setRedemptionMode]       = useState<'ONLINE' | 'IN_STORE' | 'BOTH' | null>(null);
  const [minimumOrderValue, setMinimumOrderValue] = useState('');
  const [sellerNotes, setSellerNotes]             = useState('');

  // Reset form each time this screen comes into focus so stale values from a
  // previous session don't persist (tab screens stay mounted in memory).
  useFocusEffect(
    useCallback(() => {
      setBrandName('');
      setVoucherType('gift-card');
      setFaceValue('');
      setSellingPrice('');
      setExpiryDate(defaultExpiryDateString());
      setCode('');
      setFeedback(null);
      setPin('');
      setPinCopied(false);
      setRedemptionMode(null);
      setMinimumOrderValue('');
      setSellerNotes('');
    }, [])
  );

  const deferredBrandName               = useDeferredValue(brandName.trim());

  const suggestionsResource = useAsyncResource(
    useCallback(async () => {
      const localBrands = await api.listBrands({ q: deferredBrandName, limit: 6 });
      const externalBrands = await searchBrandfetchBrands(deferredBrandName).catch(
        () => [] as readonly Awaited<ReturnType<typeof searchBrandfetchBrands>>[number][]
      );
      const seen = new Set(localBrands.map((brand) => normalizeBrandName(brand.name)));
      const suggestions: Suggestion[] = localBrands.map((brand) => ({
        name: brand.name, meta: brand.category, source: 'local',
      }));
      for (const brand of externalBrands) {
        const key = normalizeBrandName(brand.name);
        if (seen.has(key)) continue;
        seen.add(key);
        suggestions.push({ name: brand.name, meta: brand.domain ?? 'Brandfetch suggestion', source: 'brandfetch' });
      }
      return suggestions.slice(0, 8);
    }, [deferredBrandName]),
    { enabled: deferredBrandName.length >= 2 }
  );

  const discount =
    Number(faceValue) > 0 && Number(sellingPrice) > 0
      ? Math.max(0, Math.round(((Number(faceValue) - Number(sellingPrice)) / Number(faceValue)) * 100))
      : 0;

  const handlePriceInput = (next: string, setter: (v: string) => void) => {
    const digitsOnly = next.replace(/\D/g, '');
    if (digitsOnly === '') { setter(''); return; }
    if (Number(digitsOnly) > listingMaxPriceInr) return;
    setter(digitsOnly);
  };

  const parsedFaceValue = Number(faceValue);
  const parsedSellingPrice = Number(sellingPrice);
  const faceValueExceedsCap = parsedFaceValue > listingMaxPriceInr;
  const sellingPriceInvalid =
    parsedSellingPrice > 0 && parsedFaceValue > 0 && parsedSellingPrice >= parsedFaceValue;
  const canSubmit =
    Boolean(brandName.trim() && code.trim() && expiryDate) &&
    parsedFaceValue > 0 &&
    parsedSellingPrice > 0 &&
    parsedSellingPrice < parsedFaceValue &&
    !faceValueExceedsCap &&
    (voucherType === 'gift-card' ? redemptionMode !== null : true);

  async function handleCreateListing() {
    if (!sessionToken) return;
    setSubmitting(true); setFeedback(null);
    try {
      await api.createListing(sessionToken, {
        brandName: brandName.trim(),
        voucherType,
        faceValue: Number(faceValue),
        sellingPrice: Number(sellingPrice),
        expiryDate: new Date(`${expiryDate}T23:59:59.000Z`).toISOString(),
        code,
        ...(pin.trim() ? { pin: pin.trim() } : {}),
        ...(redemptionMode ? { redemptionMode } : {}),
        ...(minimumOrderValue ? { minimumOrderValue: Number(minimumOrderValue) } : {}),
        ...(sellerNotes.trim() ? { sellerNotes: sellerNotes.trim() } : {}),
      });
      router.replace('/(tabs)/listings');
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : 'Could not create listing.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(400)} style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

          {/* ── Header ── */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: theme.spacing[5],
            paddingVertical: theme.spacing[4],
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
                Sell a Voucher
              </Text>
            </View>
            <ProfileAvatar />
          </View>

          <ConfigChangeBanner />

          {/* ── Payout gate: loading ── */}
          {payoutLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={theme.colors.brand} size="large" />
            </View>
          ) : !payoutAccount?.registered ? (
            /* ── Payout gate: UPI registration ── */
            <ScrollView
              contentContainerStyle={{ flexGrow: 1, paddingHorizontal: theme.spacing[5], paddingBottom: 32, justifyContent: 'center' }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <View style={{ alignItems: 'center', marginBottom: 32 }}>
                <View style={{
                  width: 72, height: 72, borderRadius: 36,
                  backgroundColor: theme.colors.brandSoft,
                  alignItems: 'center', justifyContent: 'center',
                  marginBottom: theme.spacing[5],
                }}>
                  <Ionicons name="wallet-outline" size={34} color={theme.colors.brand} />
                </View>
                <Text style={{
                  fontFamily: theme.fontFamily.headlineExtra,
                  fontSize: 26, fontWeight: '800', letterSpacing: -0.5,
                  color: theme.colors.ink, textAlign: 'center', marginBottom: 10,
                }}>
                  Where should we send your money?
                </Text>
                <Text style={{
                  fontFamily: theme.fontFamily.body, fontSize: 15,
                  color: theme.colors.inkSecondary, textAlign: 'center',
                  lineHeight: 22, maxWidth: 300,
                }}>
                  Add your UPI ID once. Every sale credits your account automatically — no hassle.
                </Text>
              </View>

              <View style={{ gap: theme.spacing[3] }}>
                <FieldLabel>Your UPI ID</FieldLabel>
                <SubmergedInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  onChangeText={setUpiInput}
                  placeholder="9876543210@ybl or name@okaxis"
                  rightIcon={<Ionicons name="at-outline" size={20} color={theme.colors.inkMuted} />}
                  value={upiInput}
                />
                <Text style={{
                  fontSize: 12, fontFamily: theme.fontFamily.label,
                  color: theme.colors.inkMuted, fontStyle: 'italic',
                }}>
                  Find your UPI ID in PhonePe, GPay, or Paytm under Profile → UPI ID.
                </Text>

                {upiError ? (
                  <Text style={{
                    fontSize: 13, fontFamily: theme.fontFamily.labelSemi,
                    color: theme.colors.danger, textAlign: 'center',
                  }}>
                    {upiError}
                  </Text>
                ) : null}

                <Pressable
                  disabled={!upiInput.trim() || upiSubmitting}
                  onPress={() => { void handleRegisterUpi(); }}
                  style={({ pressed }) => ({
                    opacity: (!upiInput.trim() || upiSubmitting) ? 0.5 : pressed ? 0.88 : 1,
                    borderRadius: 16, overflow: 'hidden', marginTop: theme.spacing[2],
                    shadowColor: theme.colors.brand,
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: upiInput.trim() ? 0.25 : 0,
                    shadowRadius: 16,
                  })}>
                  <View style={{
                    height: 56, borderRadius: 16,
                    backgroundColor: theme.colors.brand,
                    flexDirection: 'row', alignItems: 'center',
                    justifyContent: 'center', gap: theme.spacing[2],
                  }}>
                    {upiSubmitting
                      ? <ActivityIndicator color={theme.colors.surface} />
                      : (
                          <>
                            <Text style={{
                              color: theme.colors.surface, fontSize: 16, fontWeight: '700',
                              fontFamily: theme.fontFamily.labelSemi,
                            }}>
                              Save UPI & Continue
                            </Text>
                            <Ionicons name="arrow-forward" size={18} color={theme.colors.surface} />
                          </>
                        )}
                  </View>
                </Pressable>
              </View>

              {/* Trust note */}
              <View style={{
                marginTop: 28, flexDirection: 'row', gap: 10,
                backgroundColor: theme.colors.surfaceRaised,
                borderRadius: theme.radius.sm, padding: 14, alignItems: 'flex-start',
              }}>
                <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.brand} style={{ marginTop: 1 }} />
                <Text style={{
                  flex: 1, fontSize: 13, fontFamily: theme.fontFamily.body,
                  color: theme.colors.inkSecondary, lineHeight: 19,
                }}>
                  Your UPI ID is stored securely and only used to credit your earnings. We never debit your account.
                </Text>
              </View>
            </ScrollView>
          ) : (
          /* ── Main listing form (payout account exists) ── */
          <ScrollView
            contentContainerStyle={{ paddingBottom: 32 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={{ paddingHorizontal: theme.spacing[5], gap: theme.spacing[6] }}>

              {/* ── KYC status banner ── */}
              {payoutAccount.kycStatus === 'PENDING' && (
                <StatusBanner
                  tone="warning"
                  icon="time-outline"
                  message="Your UPI is saved. Our team credits sellers manually to this UPI ID after each successful sale."
                />
              )}
              {payoutAccount.kycStatus === 'REJECTED' && (
                <StatusBanner
                  tone="danger"
                  icon="alert-circle-outline"
                  message="Payout verification failed. Please contact support to resolve this before your earnings can be released."
                />
              )}

              {/* ── Hero ── */}
              <View style={{ gap: 6 }}>
                <Text style={{
                  fontFamily: theme.fontFamily.headlineExtra,
                  fontSize: 30,
                  fontWeight: '800',
                  letterSpacing: -0.6,
                  color: theme.colors.ink,
                }}>
                  Turn Credits into Cash
                </Text>
                <Text style={{
                  fontFamily: theme.fontFamily.body,
                  fontSize: 15,
                  color: theme.colors.inkSecondary,
                  maxWidth: '90%',
                }}>
                  List your unused vouchers in seconds. Our secure vault ensures you get paid as soon as someone buys.
                </Text>
              </View>

              {/* ── Brand ── */}
              <View>
                <FieldLabel>Brand</FieldLabel>
                <SubmergedInput
                  value={brandName}
                  onChangeText={setBrandName}
                  placeholder="Search brands (e.g. Amazon, Starbucks)"
                  rightIcon={
                    suggestionsResource.loading
                      ? <ActivityIndicator color={theme.colors.brand} size="small" />
                      : <Ionicons name="search-outline" size={20} color={theme.colors.inkMuted} />
                  }
                />
                {deferredBrandName.length >= 2 && (suggestionsResource.data?.length ?? 0) > 0 ? (
                  <View style={{ marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {suggestionsResource.data?.map((s) => (
                      <FilterChip
                        key={`${s.source}:${s.name}`}
                        label={s.name}
                        onPress={() => { setBrandName(s.name); }}
                        selected={normalizeBrandName(s.name) === normalizeBrandName(brandName)}
                      />
                    ))}
                  </View>
                ) : null}
              </View>

              {/* ── Voucher Type ── */}
              <View>
                <FieldLabel>Type</FieldLabel>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {VOUCHER_TYPES.map((t) => (
                    <FilterChip key={t} label={t} onPress={() => { setVoucherType(t); }} selected={voucherType === t} />
                  ))}
                </View>
              </View>

              {voucherType === 'gift-card' ? (
                <>
                  {/* Gift Card: Code */}
                  <View>
                    <FieldLabel>Card Number</FieldLabel>
                    <SubmergedInput
                      autoCapitalize="none"
                      autoCorrect={false}
                      fontMono
                      onChangeText={setCode}
                      placeholder="ABCD-1234-EFGH-5678"
                      rightIcon={
                        code.trim() ? (
                          <Pressable
                            onPress={() => {
                              void Clipboard.setStringAsync(code.trim()).then(() => {
                                setCodeCopied(true);
                                setTimeout(() => { setCodeCopied(false); }, 2000);
                              });
                            }}
                            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                            <Ionicons name={codeCopied ? 'checkmark-circle' : 'copy-outline'} size={20} color={codeCopied ? theme.colors.action : theme.colors.brand} />
                          </Pressable>
                        ) : (
                          <Ionicons name="lock-closed-outline" size={20} color={theme.colors.inkMuted} />
                        )
                      }
                      value={code}
                    />
                    <Text style={{ fontSize: 12, fontFamily: theme.fontFamily.label, color: theme.colors.inkMuted, marginTop: 6, fontStyle: 'italic' }}>
                      Only visible to the buyer after purchase.
                    </Text>
                  </View>

                  {/* Gift Card: PIN */}
                  <View>
                    <FieldLabel>PIN <Text style={{ fontFamily: theme.fontFamily.label, color: theme.colors.inkMuted, fontWeight: '400' }}>(optional)</Text></FieldLabel>
                    <SubmergedInput
                      autoCapitalize="none"
                      autoCorrect={false}
                      fontMono
                      onChangeText={setPin}
                      placeholder="e.g. 1234"
                      keyboardType="numeric"
                      rightIcon={
                        pin.trim() ? (
                          <Pressable
                            onPress={() => {
                              void Clipboard.setStringAsync(pin.trim()).then(() => {
                                setPinCopied(true);
                                setTimeout(() => { setPinCopied(false); }, 2000);
                              });
                            }}
                            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                            <Ionicons name={pinCopied ? 'checkmark-circle' : 'copy-outline'} size={20} color={pinCopied ? theme.colors.action : theme.colors.brand} />
                          </Pressable>
                        ) : (
                          <Ionicons name="keypad-outline" size={20} color={theme.colors.inkMuted} />
                        )
                      }
                      value={pin}
                    />
                    <Text style={{ fontSize: 12, fontFamily: theme.fontFamily.label, color: theme.colors.inkMuted, marginTop: 6, fontStyle: 'italic' }}>
                      Some cards have a separate scratch PIN — enter it here.
                    </Text>
                  </View>

                  {/* Gift Card: Face Value + Price */}
                  <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ minHeight: 18, justifyContent: 'center', marginBottom: theme.spacing[2] }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', fontFamily: theme.fontFamily.labelSemi, color: theme.colors.inkSecondary, textTransform: 'uppercase', letterSpacing: 0.8 }}>Face Value</Text>
                      </View>
                      <SubmergedInput value={faceValue} onChangeText={(v) => { handlePriceInput(v, setFaceValue); }} placeholder="1000" keyboardType="numeric" prefix="₹" />
                      <Text style={{ fontSize: 11, fontFamily: theme.fontFamily.body, color: faceValueExceedsCap ? theme.colors.danger : theme.colors.inkSecondary, marginTop: theme.spacing[1] }}>
                        {faceValueExceedsCap ? `Voucher value can't exceed ₹${String(listingMaxPriceInr)} right now.` : `Max ₹${String(listingMaxPriceInr)} face value`}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ minHeight: 18, justifyContent: 'center', marginBottom: theme.spacing[2] }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', fontFamily: theme.fontFamily.labelSemi, color: theme.colors.inkSecondary, textTransform: 'uppercase', letterSpacing: 0.8 }}>Your Price</Text>
                      </View>
                      <SubmergedInput
                        value={sellingPrice} onChangeText={(v) => { handlePriceInput(v, setSellingPrice); }} placeholder="850" keyboardType="numeric" prefix="₹"
                        rightIcon={discount > 0 ? (
                          <View style={{ paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, backgroundColor: theme.colors.actionSoft }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', fontFamily: theme.fontFamily.labelSemi, color: theme.colors.action }}>{String(discount)}%</Text>
                          </View>
                        ) : undefined}
                      />
                      {sellingPriceInvalid ? <Text style={{ fontSize: 11, fontFamily: theme.fontFamily.body, color: theme.colors.danger, marginTop: theme.spacing[1] }}>Selling price must be less than face value.</Text> : null}
                    </View>
                  </View>

                  {/* Gift Card: Expiry */}
                  <View>
                    <FieldLabel>Expiry Date</FieldLabel>
                    <DateField label="Expiry date" minimumDate={new Date(Date.now() + 48 * 60 * 60 * 1000)} onChange={setExpiryDate} value={expiryDate} />
                  </View>

                  {/* Gift Card: Redeem via */}
                  <View>
                    <FieldLabel>Redeem via</FieldLabel>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {(['ONLINE', 'IN_STORE', 'BOTH'] as const).map((mode) => (
                        <FilterChip
                          key={mode}
                          label={mode === 'ONLINE' ? 'Online' : mode === 'IN_STORE' ? 'In-store' : 'Both'}
                          onPress={() => { setRedemptionMode(mode); }}
                          selected={redemptionMode === mode}
                        />
                      ))}
                    </View>
                    {redemptionMode === null && (
                      <Text style={{ fontSize: 12, fontFamily: theme.fontFamily.label, color: theme.colors.inkMuted, marginTop: 6 }}>
                        Required — select where this card can be used.
                      </Text>
                    )}
                    {redemptionMode === 'IN_STORE' && (
                      <View style={{ marginTop: 10, flexDirection: 'row', gap: 10, backgroundColor: theme.colors.surfaceRaised, borderRadius: theme.radius.sm, padding: 12, alignItems: 'flex-start' }}>
                        <Ionicons name="warning-outline" size={16} color={theme.colors.inkSecondary} style={{ marginTop: 1 }} />
                        <Text style={{ flex: 1, fontSize: 13, fontFamily: theme.fontFamily.body, color: theme.colors.inkSecondary, lineHeight: 19 }}>
                          In-store vouchers are harder for buyers to verify. Make sure your buyer knows exactly how to redeem it.
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Gift Card: Min Spend */}
                  <View>
                    <FieldLabel>Min. spend <Text style={{ fontFamily: theme.fontFamily.label, color: theme.colors.inkMuted, fontWeight: '400' }}>(optional)</Text></FieldLabel>
                    <SubmergedInput value={minimumOrderValue} onChangeText={(v) => { handlePriceInput(v, setMinimumOrderValue); }} placeholder="499" keyboardType="numeric" prefix="₹" />
                    <Text style={{ fontSize: 12, fontFamily: theme.fontFamily.label, color: theme.colors.inkMuted, marginTop: 6, fontStyle: 'italic' }}>
                      Leave blank if there's no minimum cart requirement.
                    </Text>
                  </View>

                  {/* Gift Card: Terms */}
                  <View>
                    <FieldLabel>Terms & notes <Text style={{ fontFamily: theme.fontFamily.label, color: theme.colors.inkMuted, fontWeight: '400' }}>(optional)</Text></FieldLabel>
                    <TextInput
                      multiline
                      numberOfLines={3}
                      onChangeText={(v) => { setSellerNotes(v.slice(0, 500)); }}
                      placeholder={'e.g. First order only · Cannot combine with sale prices · Valid on electronics category'}
                      placeholderTextColor={theme.colors.inkMuted}
                      value={sellerNotes}
                      style={{
                        borderRadius: 14,
                        backgroundColor: theme.colors.surfaceHigh,
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        fontSize: 15,
                        fontFamily: theme.fontFamily.body,
                        color: theme.colors.ink,
                        minHeight: 88,
                        textAlignVertical: 'top',
                      }}
                    />
                    <Text style={{ fontSize: 12, fontFamily: theme.fontFamily.label, color: theme.colors.inkMuted, marginTop: 6 }}>
                      {String(sellerNotes.length)}/500
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  {/* Promo Code: Code */}
                  <View>
                    <FieldLabel>Promo Code</FieldLabel>
                    <SubmergedInput
                      autoCapitalize="characters"
                      autoCorrect={false}
                      fontMono
                      onChangeText={setCode}
                      placeholder="SAVE20"
                      rightIcon={
                        code.trim() ? (
                          <Pressable
                            onPress={() => {
                              void Clipboard.setStringAsync(code.trim()).then(() => {
                                setCodeCopied(true);
                                setTimeout(() => { setCodeCopied(false); }, 2000);
                              });
                            }}
                            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                            <Ionicons name={codeCopied ? 'checkmark-circle' : 'copy-outline'} size={20} color={codeCopied ? theme.colors.action : theme.colors.brand} />
                          </Pressable>
                        ) : (
                          <Ionicons name="lock-closed-outline" size={20} color={theme.colors.inkMuted} />
                        )
                      }
                      value={code}
                    />
                    <Text style={{ fontSize: 12, fontFamily: theme.fontFamily.label, color: theme.colors.inkMuted, marginTop: 6, fontStyle: 'italic' }}>
                      Only visible to the buyer after purchase.
                    </Text>
                  </View>

                  {/* Promo Code: Face Value + Price */}
                  <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ minHeight: 18, justifyContent: 'center', marginBottom: theme.spacing[2] }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', fontFamily: theme.fontFamily.labelSemi, color: theme.colors.inkSecondary, textTransform: 'uppercase', letterSpacing: 0.8 }}>Discount Value</Text>
                      </View>
                      <SubmergedInput value={faceValue} onChangeText={(v) => { handlePriceInput(v, setFaceValue); }} placeholder="200" keyboardType="numeric" prefix="₹" />
                      <Text style={{ fontSize: 11, fontFamily: theme.fontFamily.body, color: faceValueExceedsCap ? theme.colors.danger : theme.colors.inkSecondary, marginTop: theme.spacing[1] }}>
                        {faceValueExceedsCap ? `Value can't exceed ₹${String(listingMaxPriceInr)} right now.` : `Max ₹${String(listingMaxPriceInr)}`}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ minHeight: 18, justifyContent: 'center', marginBottom: theme.spacing[2] }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', fontFamily: theme.fontFamily.labelSemi, color: theme.colors.inkSecondary, textTransform: 'uppercase', letterSpacing: 0.8 }}>Your Price</Text>
                      </View>
                      <SubmergedInput
                        value={sellingPrice} onChangeText={(v) => { handlePriceInput(v, setSellingPrice); }} placeholder="150" keyboardType="numeric" prefix="₹"
                        rightIcon={discount > 0 ? (
                          <View style={{ paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, backgroundColor: theme.colors.actionSoft }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', fontFamily: theme.fontFamily.labelSemi, color: theme.colors.action }}>{String(discount)}%</Text>
                          </View>
                        ) : undefined}
                      />
                      {sellingPriceInvalid ? <Text style={{ fontSize: 11, fontFamily: theme.fontFamily.body, color: theme.colors.danger, marginTop: theme.spacing[1] }}>Selling price must be less than face value.</Text> : null}
                    </View>
                  </View>

                  {/* Promo Code: Expiry */}
                  <View>
                    <FieldLabel>Expiry Date</FieldLabel>
                    <DateField label="Expiry date" minimumDate={new Date(Date.now() + 48 * 60 * 60 * 1000)} onChange={setExpiryDate} value={expiryDate} />
                  </View>

                  {/* Promo Code: Min Spend */}
                  <View>
                    <FieldLabel>Min. spend <Text style={{ fontFamily: theme.fontFamily.label, color: theme.colors.inkMuted, fontWeight: '400' }}>(optional)</Text></FieldLabel>
                    <SubmergedInput value={minimumOrderValue} onChangeText={(v) => { handlePriceInput(v, setMinimumOrderValue); }} placeholder="499" keyboardType="numeric" prefix="₹" />
                    <Text style={{ fontSize: 12, fontFamily: theme.fontFamily.label, color: theme.colors.inkMuted, marginTop: 6, fontStyle: 'italic' }}>
                      Common on Swiggy, Zomato, Myntra codes — leave blank if none.
                    </Text>
                  </View>

                  {/* Promo Code: Terms */}
                  <View>
                    <FieldLabel>Terms & notes <Text style={{ fontFamily: theme.fontFamily.label, color: theme.colors.inkMuted, fontWeight: '400' }}>(optional)</Text></FieldLabel>
                    <TextInput
                      multiline
                      numberOfLines={3}
                      onChangeText={(v) => { setSellerNotes(v.slice(0, 500)); }}
                      placeholder={'e.g. First order only · Cannot combine with sale prices · Valid on electronics category'}
                      placeholderTextColor={theme.colors.inkMuted}
                      value={sellerNotes}
                      style={{
                        borderRadius: 14,
                        backgroundColor: theme.colors.surfaceHigh,
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        fontSize: 15,
                        fontFamily: theme.fontFamily.body,
                        color: theme.colors.ink,
                        minHeight: 88,
                        textAlignVertical: 'top',
                      }}
                    />
                    <Text style={{ fontSize: 12, fontFamily: theme.fontFamily.label, color: theme.colors.inkMuted, marginTop: 6 }}>
                      {String(sellerNotes.length)}/500
                    </Text>
                  </View>
                </>
              )}

              {/* ── Trust Panel ── bg-surface-container-low per spec */}
              <View style={{
                backgroundColor: theme.colors.surface,
                borderRadius: 14,
                padding: theme.spacing[5],
                borderLeftWidth: 4,
                borderLeftColor: theme.colors.brand,
                gap: theme.spacing[3],
              }}>
                <Text style={{ fontFamily: theme.fontFamily.headline, fontSize: 16, fontWeight: '700', color: theme.colors.ink }}>
                  Vault Security Principles
                </Text>
                <View style={{ gap: theme.spacing[3] }}>
                  <View style={{ flexDirection: 'row', gap: theme.spacing[3], alignItems: 'flex-start' }}>
                    <Ionicons name="shield-checkmark-outline" size={18} color={theme.colors.brand} style={{ marginTop: 1 }} />
                    <Text style={{ flex: 1, fontSize: 14, fontFamily: theme.fontFamily.body, color: theme.colors.inkSecondary }}>
                      Be honest about expiry dates. Listings are verified.
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: theme.spacing[3], alignItems: 'flex-start' }}>
                    <Ionicons name="wallet-outline" size={18} color={theme.colors.brand} style={{ marginTop: 1 }} />
                    <Text style={{ flex: 1, fontSize: 14, fontFamily: theme.fontFamily.body, color: theme.colors.inkSecondary }}>
                      Payouts are credited within 24 hours of buyer redemption.
                    </Text>
                  </View>
                </View>
              </View>

              {/* ── Feedback ── */}
              {feedback ? (
                <Text style={{
                  textAlign: 'center',
                  fontSize: 14,
                  fontFamily: theme.fontFamily.labelSemi,
                  fontWeight: '600',
                  color: theme.colors.danger,
                }}>
                  {feedback}
                </Text>
              ) : null}

              {/* ── Submit CTA ── */}
              <Pressable
                disabled={!canSubmit || submitting}
                onPress={() => { void handleCreateListing(); }}
                style={({ pressed }) => ({
                  opacity: (!canSubmit || submitting) ? 0.5 : pressed ? 0.88 : 1,
                  transform: [{ scale: pressed && canSubmit && !submitting ? 0.982 : 1 }],
                  shadowColor: theme.colors.brand,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: canSubmit ? 0.22 : 0,
                  shadowRadius: 14,
                  elevation: canSubmit ? 4 : 0,
                  borderRadius: 16,
                  overflow: 'hidden',
                })}>
                <View style={{
                  height: 56,
                  borderRadius: 16,
                  backgroundColor: theme.colors.brand,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: theme.spacing[2],
                }}>
                  {submitting
                    ? <ActivityIndicator color={theme.colors.surface} />
                    : (
                        <>
                          <Text style={{
                            color: theme.colors.surface,
                            fontSize: 16,
                            fontWeight: '700',
                            fontFamily: theme.fontFamily.labelSemi,
                            letterSpacing: 0.2,
                          }}>
                            List Voucher
                          </Text>
                          <Ionicons name="arrow-forward" size={18} color={theme.colors.surface} />
                        </>
                      )}
                </View>
              </Pressable>

            </View>
          </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Animated.View>
  );
}
