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
import { InteractivePressable } from '@/components/interactive-pressable';
import { ProfileAvatar } from '@/components/profile-avatar';
import { PayoutSetup } from '@/components/sell/payout-setup';
import { SubmergedInput } from '@/components/submerged-input';
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

  // ── Payout account state ──────────────────────────────────────────
  const [payoutAccount, setPayoutAccount] = useState<PayoutAccount | null>(null);
  const [payoutLoading, setPayoutLoading] = useState(true);

  useEffect(() => {
    if (!sessionToken) return;
    void api.getPayoutAccount(sessionToken)
      .then(setPayoutAccount)
      .catch(() => { setPayoutAccount({ registered: false }); })
      .finally(() => { setPayoutLoading(false); });
  }, [sessionToken]);
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

  const [currentStep, setCurrentStep] = useState(1);

  // Reset form each time this screen comes into focus
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
      setCurrentStep(1);
    }, [])
  );

  const deferredBrandName = useDeferredValue(brandName.trim());

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

  const canGoToStep2 = brandName.trim().length >= 2;
  const canGoToStep3 = code.trim().length >= 4 && expiryDate;
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

  const StepIndicator = ({ step }: { step: number }) => (
    <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: theme.spacing[5], marginBottom: theme.spacing[4] }}>
      {[1, 2, 3].map((s) => (
        <View
          key={s}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            backgroundColor: s <= step ? theme.colors.brand : theme.colors.surfaceHighest,
          }}
        />
      ))}
    </View>
  );

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
                onPress={() => { 
                  if (currentStep > 1) {
                    setCurrentStep(currentStep - 1);
                  } else {
                    router.back();
                  }
                }}
                style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={currentStep > 1 ? "arrow-back" : "close"} size={24} color={theme.colors.ink} />
              </Pressable>
              <Text style={{
                fontFamily: theme.fontFamily.headline,
                fontSize: 26,
                fontWeight: '700',
                letterSpacing: -0.5,
                color: theme.colors.ink,
              }}>
                {currentStep === 1 ? 'Sell a Voucher' : currentStep === 2 ? 'Security Details' : 'Pricing & Terms'}
              </Text>
            </View>
            <ProfileAvatar />
          </View>

          <ConfigChangeBanner />

          {/* ── Content ── */}
          {payoutLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={theme.colors.brand} size="large" />
            </View>
          ) : !payoutAccount?.registered ? (
            <PayoutSetup
              sessionToken={sessionToken ?? ''}
              onComplete={(account) => { setPayoutAccount(account); }}
            />
          ) : (
            <View style={{ flex: 1 }}>
              <StepIndicator step={currentStep} />
              <ScrollView
                contentContainerStyle={{ paddingBottom: 32 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}>
                
                {currentStep === 1 && (
                  <Animated.View entering={FadeIn.duration(300)} style={{ paddingHorizontal: theme.spacing[5], gap: theme.spacing[6] }}>
                    <View style={{ gap: 6 }}>
                      <Text style={{ fontFamily: theme.fontFamily.headlineExtra, fontSize: 30, fontWeight: '800', letterSpacing: -0.6, color: theme.colors.ink }}>
                        What are you selling?
                      </Text>
                      <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 15, color: theme.colors.inkSecondary, maxWidth: '90%' }}>
                        Select the brand and type of voucher you want to turn into cash.
                      </Text>
                    </View>

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

                    <View>
                      <FieldLabel>Type</FieldLabel>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {VOUCHER_TYPES.map((t) => (
                          <FilterChip key={t} label={t} onPress={() => { setVoucherType(t); }} selected={voucherType === t} />
                        ))}
                      </View>
                    </View>

                    <InteractivePressable
                      disabled={!canGoToStep2}
                      onPress={() => { setCurrentStep(2); }}
                      style={{
                        opacity: !canGoToStep2 ? 0.5 : 1,
                        backgroundColor: theme.colors.brand,
                        height: 56,
                        borderRadius: 16,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        marginTop: theme.spacing[4],
                      }}>
                      <Text style={{ color: theme.colors.surface, fontSize: 16, fontWeight: '700', fontFamily: theme.fontFamily.labelSemi }}>Next: Voucher Details</Text>
                      <Ionicons name="arrow-forward" size={18} color={theme.colors.surface} />
                    </InteractivePressable>
                  </Animated.View>
                )}

                {currentStep === 2 && (
                  <Animated.View entering={FadeIn.duration(300)} style={{ paddingHorizontal: theme.spacing[5], gap: theme.spacing[6] }}>
                    <View style={{ gap: 6 }}>
                      <Text style={{ fontFamily: theme.fontFamily.headlineExtra, fontSize: 24, fontWeight: '800', letterSpacing: -0.5, color: theme.colors.ink }}>
                        Voucher Security
                      </Text>
                      <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 15, color: theme.colors.inkSecondary }}>
                        Your details are encrypted instantly. Only the buyer can see them after payment.
                      </Text>
                    </View>

                    {voucherType === 'gift-card' ? (
                      <>
                        <View>
                          <FieldLabel>Card Number</FieldLabel>
                          <SubmergedInput
                            autoCapitalize="none" autoCorrect={false} fontMono
                            onChangeText={setCode} placeholder="ABCD-1234-EFGH-5678"
                            rightIcon={code.trim() ? (
                              <Pressable onPress={() => { void Clipboard.setStringAsync(code.trim()).then(() => { setCodeCopied(true); setTimeout(() => { setCodeCopied(false); }, 2000); }); }} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                                <Ionicons name={codeCopied ? 'checkmark-circle' : 'copy-outline'} size={20} color={codeCopied ? theme.colors.action : theme.colors.brand} />
                              </Pressable>
                            ) : <Ionicons name="lock-closed-outline" size={20} color={theme.colors.inkMuted} />}
                            value={code}
                          />
                        </View>
                        <View>
                          <FieldLabel>PIN <Text style={{ fontFamily: theme.fontFamily.label, color: theme.colors.inkMuted, fontWeight: '400' }}>(optional)</Text></FieldLabel>
                          <SubmergedInput
                            autoCapitalize="none" autoCorrect={false} fontMono
                            onChangeText={setPin} placeholder="e.g. 1234" keyboardType="numeric"
                            rightIcon={pin.trim() ? (
                              <Pressable onPress={() => { void Clipboard.setStringAsync(pin.trim()).then(() => { setPinCopied(true); setTimeout(() => { setPinCopied(false); }, 2000); }); }} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                                <Ionicons name={pinCopied ? 'checkmark-circle' : 'copy-outline'} size={20} color={pinCopied ? theme.colors.action : theme.colors.brand} />
                              </Pressable>
                            ) : <Ionicons name="keypad-outline" size={20} color={theme.colors.inkMuted} />}
                            value={pin}
                          />
                        </View>
                      </>
                    ) : (
                      <View>
                        <FieldLabel>Promo Code</FieldLabel>
                        <SubmergedInput
                          autoCapitalize="characters" autoCorrect={false} fontMono
                          onChangeText={setCode} placeholder="SAVE20"
                          rightIcon={code.trim() ? (
                            <Pressable onPress={() => { void Clipboard.setStringAsync(code.trim()).then(() => { setCodeCopied(true); setTimeout(() => { setCodeCopied(false); }, 2000); }); }} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                              <Ionicons name={codeCopied ? 'checkmark-circle' : 'copy-outline'} size={20} color={codeCopied ? theme.colors.action : theme.colors.brand} />
                            </Pressable>
                          ) : <Ionicons name="lock-closed-outline" size={20} color={theme.colors.inkMuted} />}
                          value={code}
                        />
                      </View>
                    )}

                    <View>
                      <FieldLabel>Expiry Date</FieldLabel>
                      <DateField label="Expiry date" minimumDate={new Date(Date.now() + 48 * 60 * 60 * 1000)} onChange={setExpiryDate} value={expiryDate} />
                    </View>

                    <InteractivePressable
                      disabled={!canGoToStep3}
                      onPress={() => { setCurrentStep(3); }}
                      style={{
                        opacity: !canGoToStep3 ? 0.5 : 1,
                        backgroundColor: theme.colors.brand,
                        height: 56,
                        borderRadius: 16,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        marginTop: theme.spacing[4],
                      }}>
                      <Text style={{ color: theme.colors.surface, fontSize: 16, fontWeight: '700', fontFamily: theme.fontFamily.labelSemi }}>Next: Pricing & Terms</Text>
                      <Ionicons name="arrow-forward" size={18} color={theme.colors.surface} />
                    </InteractivePressable>
                  </Animated.View>
                )}

                {currentStep === 3 && (
                  <Animated.View entering={FadeIn.duration(300)} style={{ paddingHorizontal: theme.spacing[5], gap: theme.spacing[6] }}>
                    <View style={{ gap: 6 }}>
                      <Text style={{ fontFamily: theme.fontFamily.headlineExtra, fontSize: 24, fontWeight: '800', letterSpacing: -0.5, color: theme.colors.ink }}>
                        Pricing & Terms
                      </Text>
                      <View style={{ backgroundColor: theme.colors.surfaceTray, padding: 20, borderRadius: 20, gap: 12, borderLeftWidth: 4, borderLeftColor: theme.colors.success }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 15, color: theme.colors.inkSecondary }}>You will receive</Text>
                          <Text style={{ fontFamily: theme.fontFamily.headlineExtra, fontSize: 28, color: theme.colors.ink }}>₹{sellingPrice || '0'}</Text>
                        </View>
                        <View style={{ height: 1, backgroundColor: theme.colors.borderHair }} />
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 14, color: theme.colors.inkSecondary }}>Buyer savings</Text>
                          <View style={{ backgroundColor: theme.colors.successSoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                            <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 14, fontWeight: '700', color: theme.colors.success }}>{discount}% OFF</Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
                      <View style={{ flex: 1 }}>
                        <FieldLabel>{voucherType === 'gift-card' ? 'Face Value' : 'Discount Value'}</FieldLabel>
                        <SubmergedInput value={faceValue} onChangeText={(v) => { handlePriceInput(v, setFaceValue); }} placeholder="1000" keyboardType="numeric" prefix="₹" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <FieldLabel>Your Price</FieldLabel>
                        <SubmergedInput value={sellingPrice} onChangeText={(v) => { handlePriceInput(v, setSellingPrice); }} placeholder="850" keyboardType="numeric" prefix="₹" />
                      </View>
                    </View>

                    {voucherType === 'gift-card' && (
                      <View>
                        <FieldLabel>Redeem via</FieldLabel>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {(['ONLINE', 'IN_STORE', 'BOTH'] as const).map((mode) => (
                            <FilterChip key={mode} label={mode === 'ONLINE' ? 'Online' : mode === 'IN_STORE' ? 'In-store' : 'Both'} onPress={() => { setRedemptionMode(mode); }} selected={redemptionMode === mode} />
                          ))}
                        </View>
                      </View>
                    )}

                    <View>
                      <FieldLabel>Min. Spend (optional)</FieldLabel>
                      <SubmergedInput value={minimumOrderValue} onChangeText={(v) => { setMinimumOrderValue(v.replace(/\D/g, '')); }} placeholder="e.g. 1000" keyboardType="numeric" prefix="₹" />
                    </View>

                    <View>
                      <FieldLabel>Terms & Notes (optional)</FieldLabel>
                      <TextInput
                        multiline numberOfLines={3} onChangeText={(v) => { setSellerNotes(v.slice(0, 500)); }}
                        placeholder={'e.g. Valid on electronics category'} placeholderTextColor={theme.colors.inkMuted}
                        value={sellerNotes}
                        style={{ borderRadius: 14, backgroundColor: theme.colors.surfaceHigh, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontFamily: theme.fontFamily.body, color: theme.colors.ink, minHeight: 80, textAlignVertical: 'top' }}
                      />
                    </View>

                    {feedback ? (
                      <Text style={{ textAlign: 'center', fontSize: 14, fontFamily: theme.fontFamily.labelSemi, color: theme.colors.danger }}>{feedback}</Text>
                    ) : null}

                    <InteractivePressable
                      disabled={!canSubmit || submitting}
                      onPress={() => { void handleCreateListing(); }}
                      style={{
                        opacity: (!canSubmit || submitting) ? 0.5 : 1,
                        backgroundColor: theme.colors.brand,
                        height: 56,
                        borderRadius: 16,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}>
                      {submitting ? <ActivityIndicator color={theme.colors.surface} /> : (
                        <>
                          <Text style={{ color: theme.colors.surface, fontSize: 16, fontWeight: '700', fontFamily: theme.fontFamily.labelSemi }}>List Voucher Now</Text>
                          <Ionicons name="checkmark-circle" size={18} color={theme.colors.surface} />
                        </>
                      )}
                    </InteractivePressable>
                  </Animated.View>
                )}
              </ScrollView>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Animated.View>
  );
}
