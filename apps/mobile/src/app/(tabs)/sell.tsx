import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateField } from '@/components/date-field';
import { FilterChip } from '@/components/filter-chip';
import { useAuth } from '@/hooks/use-auth';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { api, type PayoutAccount } from '@/lib/api';
import { searchBrandfetchBrands } from '@/lib/brandfetch';
import { useTheme } from '@/theme/ThemeContext';

const VOUCHER_TYPES = ['gift-card', 'promo-code'] as const;
type VoucherType = (typeof VOUCHER_TYPES)[number];

type Suggestion = {
  readonly name: string;
  readonly meta: string;
  readonly source: 'local' | 'brandfetch';
};

function todayString() {
  const d = new Date();
  return `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function normalizeBrandName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function SubmergedInput({
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoCorrect = true,
  rightIcon,
  prefix,
  fontMono = false,
}: {
  readonly value: string;
  readonly onChangeText: (v: string) => void;
  readonly placeholder?: string;
  readonly keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  readonly autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  readonly autoCorrect?: boolean;
  readonly rightIcon?: React.ReactNode;
  readonly prefix?: string;
  readonly fontMono?: boolean;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  // spec: bg-surface-container-high (#231f4a dark), focused → bg-surface-container-highest + ring-primary/20
  const inputBg = focused ? theme.colors.surfaceHighest : theme.colors.surfaceHigh;

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      height: 56,
      borderRadius: 14,
      backgroundColor: inputBg,
      borderWidth: focused ? 1.5 : 0,
      borderColor: focused ? `${theme.colors.brand}33` : 'transparent',
      shadowColor: theme.colors.brand,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: focused ? 0.12 : 0,
      shadowRadius: 8,
    }}>
      {prefix ? (
        <Text style={{
          paddingLeft: 16,
          fontSize: 16,
          fontWeight: '600',
          fontFamily: theme.fontFamily.labelSemi,
          color: theme.colors.inkSecondary,
        }}>
          {prefix}
        </Text>
      ) : null}
      <TextInput
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        spellCheck={autoCorrect}
        textContentType="none"
        cursorColor={theme.colors.brand}
        keyboardType={keyboardType}
        onBlur={() => { setFocused(false); }}
        onChangeText={onChangeText}
        onFocus={() => { setFocused(true); }}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.inkMuted}
        style={{
          flex: 1,
          height: '100%',
          paddingHorizontal: prefix ? 8 : 16,
          fontSize: fontMono ? 17 : 15,
          fontFamily: fontMono ? theme.fontFamily.mono : theme.fontFamily.body,
          color: theme.colors.ink,
        }}
        value={value}
      />
      {rightIcon ? (
        <View style={{ paddingRight: 16 }}>
          {rightIcon}
        </View>
      ) : null}
    </View>
  );
}

function FieldLabel({ children }: { readonly children: string }) {
  const theme = useTheme();
  return (
    <Text style={{
      fontSize: 13,
      fontWeight: '600',
      fontFamily: theme.fontFamily.labelSemi,
      color: theme.colors.inkSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 8,
    }}>
      {children}
    </Text>
  );
}

export default function SellScreen() {
  const { sessionToken, user } = useAuth();
  const theme = useTheme();
  const router = useRouter();
  const initial = (user?.name ?? user?.phone ?? '?')[0].toUpperCase();

  // ── Payout account gate ──────────────────────────────────────────
  const [payoutAccount, setPayoutAccount]   = useState<PayoutAccount | null>(null);
  const [payoutLoading, setPayoutLoading]   = useState(true);
  const [upiInput, setUpiInput]             = useState('');
  const [upiSubmitting, setUpiSubmitting]   = useState(false);
  const [upiError, setUpiError]             = useState<string | null>(null);

  useEffect(() => {
    if (!sessionToken) return;
    api.getPayoutAccount(sessionToken)
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
  const [expiryDate, setExpiryDate]     = useState(todayString);
  const [code, setCode]                 = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [feedback, setFeedback]         = useState<string | null>(null);
  const [codeCopied, setCodeCopied]     = useState(false);

  // Reset form each time this screen comes into focus so stale values from a
  // previous session don't persist (tab screens stay mounted in memory).
  useFocusEffect(
    useCallback(() => {
      setBrandName('');
      setVoucherType('gift-card');
      setFaceValue('');
      setSellingPrice('');
      setExpiryDate(todayString());
      setCode('');
      setFeedback(null);
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

  const selectedLocalSuggestion = useMemo(
    () => suggestionsResource.data?.find(
      (s) => s.source === 'local' && normalizeBrandName(s.name) === normalizeBrandName(brandName)
    ) ?? null,
    [brandName, suggestionsResource.data]
  );

  const discount =
    Number(faceValue) > 0 && Number(sellingPrice) > 0
      ? Math.max(0, Math.round(((Number(faceValue) - Number(sellingPrice)) / Number(faceValue)) * 100))
      : 0;

  const canSubmit = Boolean(brandName.trim() && code.trim() && expiryDate);

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
      });
      router.replace('/(tabs)/listings');
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : 'Could not create listing.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

          {/* ── Header ── */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 16,
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
                Sell a Voucher
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Profile"
              onPress={() => { router.push('/profile'); }}
              style={({ pressed }) => ({
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: theme.colors.brandSoft,
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 1.5,
                borderColor: `${theme.colors.brand}40`,
                opacity: pressed ? 0.7 : 1,
              })}>
              <Text style={{
                fontFamily: theme.fontFamily.headlineExtra,
                fontSize: 16, fontWeight: '800', color: theme.colors.brand,
              }}>
                {initial}
              </Text>
            </Pressable>
          </View>

          {/* ── Payout gate: loading ── */}
          {payoutLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={theme.colors.brand} size="large" />
            </View>
          ) : !payoutAccount?.registered ? (
            /* ── Payout gate: UPI registration ── */
            <ScrollView
              contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingBottom: 60, justifyContent: 'center' }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <View style={{ alignItems: 'center', marginBottom: 32 }}>
                <View style={{
                  width: 72, height: 72, borderRadius: 36,
                  backgroundColor: theme.colors.brandSoft,
                  alignItems: 'center', justifyContent: 'center',
                  marginBottom: 20,
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

              <View style={{ gap: 12 }}>
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
                    borderRadius: 16, overflow: 'hidden', marginTop: 8,
                    shadowColor: theme.colors.brand,
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: upiInput.trim() ? 0.25 : 0,
                    shadowRadius: 16,
                  })}>
                  <View style={{
                    height: 56, borderRadius: 16,
                    backgroundColor: theme.colors.brand,
                    flexDirection: 'row', alignItems: 'center',
                    justifyContent: 'center', gap: 8,
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
                borderRadius: 12, padding: 14, alignItems: 'flex-start',
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
            contentContainerStyle={{ paddingBottom: 120 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={{ paddingHorizontal: 20, gap: 24 }}>

              {/* ── KYC status banner ── */}
              {payoutAccount.kycStatus === 'PENDING' && (
                <View style={{
                  flexDirection: 'row', gap: 10, alignItems: 'flex-start',
                  backgroundColor: theme.colors.warningSoft,
                  borderRadius: 12, padding: 14,
                }}>
                  <Ionicons name="time-outline" size={18} color={theme.colors.warning} style={{ marginTop: 1 }} />
                  <Text style={{ flex: 1, fontSize: 13, fontFamily: theme.fontFamily.body, color: theme.colors.warning, lineHeight: 19 }}>
                    Your payout account is under review. You can list vouchers, but your first payout will be held until our team verifies your account (usually within 24h).
                  </Text>
                </View>
              )}
              {payoutAccount.kycStatus === 'REJECTED' && (
                <View style={{
                  flexDirection: 'row', gap: 10, alignItems: 'flex-start',
                  backgroundColor: theme.colors.dangerSoft,
                  borderRadius: 12, padding: 14,
                }}>
                  <Ionicons name="alert-circle-outline" size={18} color={theme.colors.danger} style={{ marginTop: 1 }} />
                  <Text style={{ flex: 1, fontSize: 13, fontFamily: theme.fontFamily.body, color: theme.colors.danger, lineHeight: 19 }}>
                    Payout verification failed. Please contact support to resolve this before your earnings can be released.
                  </Text>
                </View>
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
                {selectedLocalSuggestion ? (
                  <Text style={{ fontSize: 12, fontFamily: theme.fontFamily.label, color: theme.colors.inkMuted, marginTop: 6, fontStyle: 'italic' }}>
                    Existing marketplace brand: {selectedLocalSuggestion.meta}
                  </Text>
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

              {/* ── Voucher Code ── */}
              <View>
                <FieldLabel>Voucher Code</FieldLabel>
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
                        <Ionicons
                          name={codeCopied ? 'checkmark-circle' : 'copy-outline'}
                          size={20}
                          color={codeCopied ? theme.colors.action : theme.colors.brand}
                        />
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

              {/* ── Face Value + Price (2 col) ── */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ minHeight: 18, justifyContent: 'center', marginBottom: 8 }}>
                    <Text style={{
                      fontSize: 13, fontWeight: '600',
                      fontFamily: theme.fontFamily.labelSemi,
                      color: theme.colors.inkSecondary,
                      textTransform: 'uppercase', letterSpacing: 0.8,
                    }}>
                      Face Value
                    </Text>
                  </View>
                  <SubmergedInput
                    value={faceValue}
                    onChangeText={setFaceValue}
                    placeholder="1000"
                    keyboardType="numeric"
                    prefix="₹"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ minHeight: 18, justifyContent: 'center', marginBottom: 8 }}>
                    <Text style={{
                      fontSize: 13, fontWeight: '600',
                      fontFamily: theme.fontFamily.labelSemi,
                      color: theme.colors.inkSecondary,
                      textTransform: 'uppercase', letterSpacing: 0.8,
                    }}>
                      Your Price
                    </Text>
                  </View>
                  <SubmergedInput
                    value={sellingPrice}
                    onChangeText={setSellingPrice}
                    placeholder="850"
                    keyboardType="numeric"
                    prefix="₹"
                    rightIcon={discount > 0 ? (
                      <View style={{
                        paddingHorizontal: 6, paddingVertical: 3,
                        borderRadius: 6,
                        backgroundColor: theme.colors.actionSoft,
                      }}>
                        <Text style={{
                          fontSize: 11, fontWeight: '700',
                          fontFamily: theme.fontFamily.labelSemi,
                          color: theme.colors.action,
                        }}>
                          {String(discount)}%
                        </Text>
                      </View>
                    ) : undefined}
                  />
                </View>
              </View>

              {/* ── Expiry Date ── */}
              <View>
                <FieldLabel>Expiry Date</FieldLabel>
                <DateField label="Expiry date" minimumDate={new Date()} onChange={setExpiryDate} value={expiryDate} />
              </View>

              {/* ── Trust Panel ── bg-surface-container-low per spec */}
              <View style={{
                backgroundColor: theme.colors.surface,
                borderRadius: 14,
                padding: 20,
                borderLeftWidth: 4,
                borderLeftColor: theme.colors.brand,
                gap: 12,
              }}>
                <Text style={{ fontFamily: theme.fontFamily.headline, fontSize: 16, fontWeight: '700', color: theme.colors.ink }}>
                  Vault Security Principles
                </Text>
                <View style={{ gap: 12 }}>
                  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                    <Ionicons name="shield-checkmark-outline" size={18} color={theme.colors.brand} style={{ marginTop: 1 }} />
                    <Text style={{ flex: 1, fontSize: 14, fontFamily: theme.fontFamily.body, color: theme.colors.inkSecondary }}>
                      Be honest about expiry dates. Listings are verified.
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
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
                  gap: 8,
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
    </View>
  );
}
