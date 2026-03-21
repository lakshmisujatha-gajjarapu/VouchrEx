import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useDeferredValue, useMemo, useState } from 'react';
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
import { api } from '@/lib/api';
import { searchBrandfetchBrands } from '@/lib/brandfetch';
import { useTheme } from '@/theme/ThemeContext';

const VOUCHER_TYPES = ['gift-card', 'promo-code', 'cashback', 'subscription'] as const;
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

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      height: 56,
      borderRadius: 14,
      backgroundColor: focused ? theme.colors.surface : theme.colors.surfaceHigh,
      borderWidth: focused ? 1.5 : 0,
      borderColor: focused ? theme.colors.brand : 'transparent',
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
  const { sessionToken } = useAuth();
  const theme = useTheme();
  const router = useRouter();
  const [brandName, setBrandName]       = useState('');
  const [voucherType, setVoucherType]   = useState<VoucherType>('gift-card');
  const [faceValue, setFaceValue]       = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [expiryDate, setExpiryDate]     = useState(todayString);
  const [code, setCode]                 = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [feedback, setFeedback]         = useState<{ ok: boolean; text: string } | null>(null);
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
      setBrandName(''); setCode(''); setFaceValue(''); setSellingPrice(''); setExpiryDate(todayString());
      setFeedback({ ok: true, text: 'Live in the bazaar. This brand is now searchable for the next seller.' });
    } catch (e) {
      setFeedback({ ok: false, text: e instanceof Error ? e.message : 'Could not create listing.' });
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
            <View style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: theme.colors.surfaceHigh,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="help-circle-outline" size={22} color={theme.colors.inkSecondary} />
            </View>
          </View>

          <ScrollView
            contentContainerStyle={{ paddingBottom: 120 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={{ paddingHorizontal: 20, gap: 24 }}>

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
                  rightIcon={<Ionicons name="lock-closed-outline" size={20} color={theme.colors.inkMuted} />}
                  value={code}
                />
                <Text style={{ fontSize: 12, fontFamily: theme.fontFamily.label, color: theme.colors.inkMuted, marginTop: 6, fontStyle: 'italic' }}>
                  Only visible to the buyer after purchase.
                </Text>
              </View>

              {/* ── Face Value + Price (2 col) ── */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Face Value</FieldLabel>
                  <SubmergedInput
                    value={faceValue}
                    onChangeText={setFaceValue}
                    placeholder="1000"
                    keyboardType="numeric"
                    prefix="₹"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldLabel>{`Your Price${discount > 0 ? ` · ${String(discount)}% off` : ''}`}</FieldLabel>
                  <SubmergedInput
                    value={sellingPrice}
                    onChangeText={setSellingPrice}
                    placeholder="850"
                    keyboardType="numeric"
                    prefix="₹"
                  />
                </View>
              </View>

              {/* ── Expiry Date ── */}
              <View>
                <FieldLabel>Expiry Date</FieldLabel>
                <DateField label="Expiry date" minimumDate={new Date()} onChange={setExpiryDate} value={expiryDate} />
              </View>

              {/* ── Trust Panel ── */}
              <View style={{
                backgroundColor: theme.colors.surfaceRaised,
                borderRadius: 14,
                padding: 20,
                borderLeftWidth: 4,
                borderLeftColor: theme.colors.actionFixed,
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
                  color: feedback.ok ? theme.colors.success : theme.colors.danger,
                }}>
                  {feedback.text}
                </Text>
              ) : null}

              {/* ── Submit CTA ── */}
              <Pressable
                disabled={!canSubmit || submitting}
                onPress={() => { void handleCreateListing(); }}
                style={({ pressed }) => ({
                  opacity: (!canSubmit || submitting) ? 0.5 : pressed ? 0.88 : 1,
                  transform: [{ scale: pressed && canSubmit && !submitting ? 0.985 : 1 }],
                  shadowColor: theme.colors.brand,
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: canSubmit ? 0.28 : 0,
                  shadowRadius: 20,
                  elevation: canSubmit ? 5 : 0,
                  borderRadius: 16,
                  overflow: 'hidden',
                })}>
                <LinearGradient
                  colors={[theme.colors.brandBright, theme.colors.brand]}
                  end={{ x: 1, y: 1 }}
                  start={{ x: 0, y: 0 }}
                  style={{
                    height: 56,
                    borderRadius: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}>
                  {submitting
                    ? <ActivityIndicator color="#FFFFFF" />
                    : (
                        <>
                          <Text style={{
                            color: '#FFFFFF',
                            fontSize: 16,
                            fontWeight: '700',
                            fontFamily: theme.fontFamily.labelSemi,
                            letterSpacing: 0.1,
                          }}>
                            List Voucher
                          </Text>
                          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                        </>
                      )}
                </LinearGradient>
              </Pressable>

            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
