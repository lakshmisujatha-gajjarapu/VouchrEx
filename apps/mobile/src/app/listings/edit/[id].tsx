import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
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

import { ConfigChangeBanner } from '@/components/config-change-banner';
import { DateField } from '@/components/date-field';
import { FieldLabel } from '@/components/field-label';
import { FilterChip } from '@/components/filter-chip';
import { PrimaryButton } from '@/components/primary-button';
import { SubmergedInput } from '@/components/submerged-input';
import { useAuth } from '@/hooks/use-auth';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { useConfig } from '@/hooks/use-config';
import { api } from '@/lib/api';
import { searchBrandfetchBrands } from '@/lib/brandfetch';
import { formatStatus } from '@/lib/format';
import { useTheme } from '@/theme/theme-context';

const VOUCHER_TYPES = ['gift-card', 'promo-code'] as const;
type VoucherType = (typeof VOUCHER_TYPES)[number];

type Suggestion = {
  readonly name: string;
  readonly meta: string;
  readonly source: 'local' | 'brandfetch';
};

const REDEMPTION_MODES = ['ONLINE', 'IN_STORE', 'BOTH'] as const;
type RedemptionMode = (typeof REDEMPTION_MODES)[number];

const REDEMPTION_MODE_LABELS: Record<RedemptionMode, string> = {
  ONLINE: 'Online',
  IN_STORE: 'In-store',
  BOTH: 'Both',
};

const editableStatuses = new Set(['ACTIVE', 'DRAFT', 'VERIFYING']);

function normalizeBrandName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function isoToDateInput(value: string) {
  return value.slice(0, 10);
}

export default function EditListingScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { sessionToken } = useAuth();
  const { listingMaxPriceInr } = useConfig();
  const { id } = useLocalSearchParams<{ readonly id?: string | string[] }>();
  const listingId = useMemo(() => (Array.isArray(id) ? id[0] : id), [id]);

  const [brandName, setBrandName] = useState('');
  const [voucherType, setVoucherType] = useState<VoucherType>('gift-card');
  const [faceValue, setFaceValue] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [code, setCode] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const deferredBrandName = useDeferredValue(brandName.trim());

  const [pin, setPin]                             = useState('');
  const [pinCopied, setPinCopied]                 = useState(false);
  const [redemptionMode, setRedemptionMode]       = useState<'ONLINE' | 'IN_STORE' | 'BOTH' | null>(null);
  const [minimumOrderValue, setMinimumOrderValue] = useState('');
  const [sellerNotes, setSellerNotes]             = useState('');

  const listingResource = useAsyncResource(
    useCallback(async () => {
      if (!sessionToken) {
        throw new Error('Session missing.');
      }

      if (!listingId) {
        throw new Error('Listing ID is missing.');
      }

      const listings = await api.listMyListings(sessionToken);
      const listing = listings.find((entry) => entry.id === listingId);

      if (!listing) {
        throw new Error('Listing was not found.');
      }

      return listing;
    }, [listingId, sessionToken]),
    { enabled: Boolean(sessionToken && listingId) }
  );

  const suggestionsResource = useAsyncResource(
    useCallback(async () => {
      const localBrands = await api.listBrands({
        q: deferredBrandName,
        limit: 6,
      });

      const externalBrands = await searchBrandfetchBrands(deferredBrandName).catch(
        () => [] as readonly Awaited<ReturnType<typeof searchBrandfetchBrands>>[number][]
      );

      const seen = new Set(localBrands.map((brand) => normalizeBrandName(brand.name)));
      const suggestions: Suggestion[] = localBrands.map((brand) => ({
        name: brand.name,
        meta: brand.category,
        source: 'local',
      }));

      for (const brand of externalBrands) {
        const key = normalizeBrandName(brand.name);
        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        suggestions.push({
          name: brand.name,
          meta: brand.domain ?? 'Brandfetch suggestion',
          source: 'brandfetch',
        });
      }

      return suggestions.slice(0, 8);
    }, [deferredBrandName]),
    { enabled: deferredBrandName.length >= 2 }
  );

  useEffect(() => {
    if (!listingResource.data) {
      return;
    }

    setBrandName(listingResource.data.brand.name);
    setVoucherType(
      VOUCHER_TYPES.includes(listingResource.data.voucherType as VoucherType)
        ? (listingResource.data.voucherType as VoucherType)
        : 'gift-card'
    );
    setFaceValue(String(listingResource.data.faceValue));
    setSellingPrice(String(listingResource.data.sellingPrice));
    setExpiryDate(isoToDateInput(listingResource.data.expiryDate));
    setCode('');
    setFeedback(null);
    setRedemptionMode(
      listingResource.data.redemptionMode === 'ONLINE' ||
      listingResource.data.redemptionMode === 'IN_STORE' ||
      listingResource.data.redemptionMode === 'BOTH'
        ? listingResource.data.redemptionMode
        : null
    );
    setMinimumOrderValue(listingResource.data.minimumOrderValue ? String(listingResource.data.minimumOrderValue) : '');
    setSellerNotes(listingResource.data.sellerNotes ?? '');
  }, [listingResource.data]);

  const handlePriceInput = (next: string, setter: (v: string) => void) => {
    const digitsOnly = next.replace(/\D/g, '');
    if (digitsOnly === '') { setter(''); return; }
    if (Number(digitsOnly) > listingMaxPriceInr) return;
    setter(digitsOnly);
  };

  const parsedFaceValue = Number(faceValue);
  const parsedSellingPrice = Number(sellingPrice);
  const discount =
    parsedFaceValue > 0 && parsedSellingPrice > 0
      ? Math.max(0, Math.round(((parsedFaceValue - parsedSellingPrice) / parsedFaceValue) * 100))
      : 0;

  const locked = listingResource.data
    ? Boolean(listingResource.data.order) || !editableStatuses.has(listingResource.data.status)
    : false;

  const faceValueExceedsCap = parsedFaceValue > listingMaxPriceInr;
  const sellingPriceInvalid =
    parsedSellingPrice > 0 && parsedFaceValue > 0 && parsedSellingPrice >= parsedFaceValue;

  const canSubmit =
    Boolean(brandName.trim() && expiryDate) &&
    parsedFaceValue > 0 &&
    parsedSellingPrice > 0 &&
    parsedSellingPrice < parsedFaceValue &&
    !faceValueExceedsCap &&
    (voucherType === 'gift-card' ? redemptionMode !== null : true) &&
    Boolean(listingResource.data && !locked);

  async function handleSubmit() {
    if (!sessionToken || !listingId) {
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      await api.updateListing(sessionToken, listingId, {
        brandName: brandName.trim(),
        voucherType,
        faceValue: parsedFaceValue,
        sellingPrice: parsedSellingPrice,
        expiryDate: new Date(`${expiryDate}T23:59:59.000Z`).toISOString(),
        ...(code.trim() ? { code: code.trim() } : {}),
        ...(pin.trim() ? { pin: pin.trim() } : {}),
        ...(redemptionMode ? { redemptionMode } : {}),
        ...(minimumOrderValue ? { minimumOrderValue: Number(minimumOrderValue) } : {}),
        ...(sellerNotes.trim() ? { sellerNotes: sellerNotes.trim() } : {}),
      });

      router.replace('/listings');
    } catch (error) {
      setFeedback({
        ok: false,
        text: error instanceof Error ? error.message : 'Could not update listing.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (listingResource.loading && !listingResource.data) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator color={theme.colors.brand} />
      </View>
    );
  }

  if (!listingResource.data) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
          <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: theme.spacing[3], gap: theme.spacing[3] }}>
            <Text style={{ fontFamily: theme.fontFamily.label, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, color: theme.colors.brand }}>
              Listings
            </Text>
            <Text style={{ fontFamily: theme.fontFamily.headline, fontSize: 26, fontWeight: '700', lineHeight: 30, color: theme.colors.ink }}>
              Edit listing
            </Text>
            <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 14, color: theme.colors.danger }}>
              {listingResource.error ?? 'Listing was not found.'}
            </Text>
            <PrimaryButton
              label="Back to listings"
              onPress={() => {
                router.replace('/listings');
              }}
              tone="secondary"
            />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ConfigChangeBanner />
          <ScrollView
            contentContainerStyle={{ paddingBottom: 120 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={{ paddingHorizontal: theme.spacing[5], paddingTop: theme.spacing[5], gap: theme.spacing[6] }}>

              {/* ── Header ── */}
              <View style={{ gap: 6 }}>
                <Text style={{
                  fontFamily: theme.fontFamily.label,
                  fontSize: 12,
                  fontWeight: '800',
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  color: theme.colors.brand,
                }}>
                  Listings
                </Text>
                <Text style={{
                  fontFamily: theme.fontFamily.headline,
                  fontSize: 26,
                  fontWeight: '700',
                  lineHeight: 30,
                  color: theme.colors.ink,
                }}>
                  Edit listing
                </Text>
                <Text style={{
                  fontFamily: theme.fontFamily.body,
                  fontSize: 14,
                  color: theme.colors.inkMuted,
                }}>
                  Update seller-side details before the listing turns into an order.
                </Text>
              </View>

              {/* ── Brand ── */}
              <View>
                <FieldLabel>Brand</FieldLabel>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    height: 56,
                    borderRadius: 14,
                    backgroundColor: theme.colors.surfaceHigh,
                    paddingHorizontal: 16,
                    gap: 8,
                  }}>
                  <Ionicons color={theme.colors.inkMuted} name="search-outline" size={18} />
                  <TextInput
                    style={{ flex: 1, fontFamily: theme.fontFamily.body, fontSize: 15, color: theme.colors.ink }}
                    onChangeText={setBrandName}
                    placeholder="Enter brand name"
                    placeholderTextColor={theme.colors.inkMuted}
                    value={brandName}
                  />
                  {suggestionsResource.loading ? (
                    <ActivityIndicator color={theme.colors.brand} size="small" />
                  ) : null}
                </View>

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

              {/* ── Type chips (display-only) ── */}
              <View>
                <FieldLabel>Type</FieldLabel>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} pointerEvents="none">
                  {VOUCHER_TYPES.map((t) => (
                    <FilterChip key={t} label={t} onPress={() => {}} selected={voucherType === t} />
                  ))}
                </View>
                <Text style={{ fontSize: 12, fontFamily: theme.fontFamily.label, color: theme.colors.inkMuted, marginTop: 6 }}>
                  Voucher type cannot be changed after listing.
                </Text>
              </View>

              {/* ── Form: gift-card ── */}
              {voucherType === 'gift-card' ? (
                <>
                  {/* Code */}
                  <View>
                    <FieldLabel>Voucher Code (optional replacement)</FieldLabel>
                    <SubmergedInput
                      autoCapitalize="characters"
                      autoCorrect={false}
                      fontMono
                      onChangeText={setCode}
                      placeholder="Leave blank to keep current code"
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

                  {/* PIN (optional) */}
                  <View>
                    <FieldLabel>PIN (optional)</FieldLabel>
                    <SubmergedInput
                      autoCapitalize="none"
                      autoCorrect={false}
                      fontMono
                      keyboardType="numeric"
                      onChangeText={setPin}
                      placeholder="e.g. 1234"
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
                            <Ionicons
                              name={pinCopied ? 'checkmark-circle' : 'copy-outline'}
                              size={20}
                              color={pinCopied ? theme.colors.action : theme.colors.brand}
                            />
                          </Pressable>
                        ) : undefined
                      }
                      value={pin}
                    />
                  </View>

                  {/* Face Value + Price */}
                  <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
                    <View style={{ flex: 1 }}>
                      <FieldLabel>Face Value</FieldLabel>
                      <SubmergedInput
                        keyboardType="numeric"
                        onChangeText={(v) => { handlePriceInput(v, setFaceValue); }}
                        placeholder="1000"
                        prefix="₹"
                        value={faceValue}
                      />
                      <Text style={{
                        fontSize: 11,
                        fontFamily: theme.fontFamily.body,
                        color: faceValueExceedsCap ? theme.colors.danger : theme.colors.inkSecondary,
                        marginTop: theme.spacing[1],
                      }}>
                        {faceValueExceedsCap
                          ? `Voucher value can't exceed ₹${String(listingMaxPriceInr)} right now.`
                          : `Max ₹${String(listingMaxPriceInr)} face value`}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <FieldLabel>Your Price</FieldLabel>
                      <SubmergedInput
                        keyboardType="numeric"
                        onChangeText={(v) => { handlePriceInput(v, setSellingPrice); }}
                        placeholder="850"
                        prefix="₹"
                        rightIcon={discount > 0 ? (
                          <View style={{
                            paddingHorizontal: 6,
                            paddingVertical: 3,
                            borderRadius: 6,
                            backgroundColor: theme.colors.actionSoft,
                          }}>
                            <Text style={{
                              fontSize: 11,
                              fontWeight: '700',
                              fontFamily: theme.fontFamily.labelSemi,
                              color: theme.colors.action,
                            }}>
                              {String(discount)}%
                            </Text>
                          </View>
                        ) : undefined}
                        value={sellingPrice}
                      />
                      {sellingPriceInvalid ? (
                        <Text style={{
                          fontSize: 11,
                          fontFamily: theme.fontFamily.body,
                          color: theme.colors.danger,
                          marginTop: theme.spacing[1],
                        }}>
                          Selling price must be less than face value.
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {/* Expiry */}
                  <View>
                    <FieldLabel>Expiry Date</FieldLabel>
                    <DateField
                      label="Expiry date"
                      minimumDate={new Date(Date.now() + 48 * 60 * 60 * 1000)}
                      onChange={setExpiryDate}
                      value={expiryDate}
                    />
                  </View>

                  {/* Redeem via */}
                  <View>
                    <FieldLabel>Redeem via</FieldLabel>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {REDEMPTION_MODES.map((mode) => (
                        <FilterChip
                          key={mode}
                          label={REDEMPTION_MODE_LABELS[mode]}
                          onPress={() => { setRedemptionMode(mode); }}
                          selected={redemptionMode === mode}
                        />
                      ))}
                    </View>
                    {redemptionMode === 'IN_STORE' || redemptionMode === 'BOTH' ? (
                      <View style={{
                        marginTop: 10,
                        flexDirection: 'row',
                        gap: 8,
                        backgroundColor: theme.colors.surfaceRaised,
                        borderRadius: theme.radius.sm,
                        padding: 12,
                        alignItems: 'flex-start',
                      }}>
                        <Ionicons name="information-circle-outline" size={16} color={theme.colors.inkMuted} style={{ marginTop: 1 }} />
                        <Text style={{ flex: 1, fontSize: 13, fontFamily: theme.fontFamily.body, color: theme.colors.inkSecondary, lineHeight: 18 }}>
                          Buyers will need to visit a store to redeem. Make sure the voucher is valid for in-store use.
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Min spend */}
                  <View>
                    <FieldLabel>Minimum Spend (optional)</FieldLabel>
                    <SubmergedInput
                      keyboardType="numeric"
                      onChangeText={(v) => {
                        const digits = v.replace(/\D/g, '');
                        setMinimumOrderValue(digits);
                      }}
                      placeholder="e.g. 500"
                      prefix="₹"
                      value={minimumOrderValue}
                    />
                    <Text style={{ fontSize: 12, fontFamily: theme.fontFamily.label, color: theme.colors.inkMuted, marginTop: 6 }}>
                      Minimum cart value required to apply this voucher.
                    </Text>
                  </View>

                  {/* Terms / seller notes */}
                  <View>
                    <FieldLabel>Terms &amp; Notes (optional)</FieldLabel>
                    <SubmergedInput
                      autoCapitalize="sentences"
                      onChangeText={setSellerNotes}
                      placeholder="Any usage restrictions or tips for the buyer…"
                      value={sellerNotes}
                    />
                  </View>
                </>
              ) : (
                /* ── Form: promo-code / cashback / subscription ── */
                <>
                  {/* Code */}
                  <View>
                    <FieldLabel>Promo Code (optional replacement)</FieldLabel>
                    <SubmergedInput
                      autoCapitalize="characters"
                      autoCorrect={false}
                      fontMono
                      onChangeText={setCode}
                      placeholder="Leave blank to keep current code"
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

                  {/* Discount Value + Price */}
                  <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
                    <View style={{ flex: 1 }}>
                      <FieldLabel>Discount Value</FieldLabel>
                      <SubmergedInput
                        keyboardType="numeric"
                        onChangeText={(v) => { handlePriceInput(v, setFaceValue); }}
                        placeholder="200"
                        prefix="₹"
                        value={faceValue}
                      />
                      <Text style={{
                        fontSize: 11,
                        fontFamily: theme.fontFamily.body,
                        color: faceValueExceedsCap ? theme.colors.danger : theme.colors.inkSecondary,
                        marginTop: theme.spacing[1],
                      }}>
                        {faceValueExceedsCap
                          ? `Voucher value can't exceed ₹${String(listingMaxPriceInr)} right now.`
                          : `Max ₹${String(listingMaxPriceInr)} face value`}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <FieldLabel>Your Price</FieldLabel>
                      <SubmergedInput
                        keyboardType="numeric"
                        onChangeText={(v) => { handlePriceInput(v, setSellingPrice); }}
                        placeholder="150"
                        prefix="₹"
                        rightIcon={discount > 0 ? (
                          <View style={{
                            paddingHorizontal: 6,
                            paddingVertical: 3,
                            borderRadius: 6,
                            backgroundColor: theme.colors.actionSoft,
                          }}>
                            <Text style={{
                              fontSize: 11,
                              fontWeight: '700',
                              fontFamily: theme.fontFamily.labelSemi,
                              color: theme.colors.action,
                            }}>
                              {String(discount)}%
                            </Text>
                          </View>
                        ) : undefined}
                        value={sellingPrice}
                      />
                      {sellingPriceInvalid ? (
                        <Text style={{
                          fontSize: 11,
                          fontFamily: theme.fontFamily.body,
                          color: theme.colors.danger,
                          marginTop: theme.spacing[1],
                        }}>
                          Selling price must be less than face value.
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {/* Expiry */}
                  <View>
                    <FieldLabel>Expiry Date</FieldLabel>
                    <DateField
                      label="Expiry date"
                      minimumDate={new Date(Date.now() + 48 * 60 * 60 * 1000)}
                      onChange={setExpiryDate}
                      value={expiryDate}
                    />
                  </View>

                  {/* Min spend */}
                  <View>
                    <FieldLabel>Minimum Spend (optional)</FieldLabel>
                    <SubmergedInput
                      keyboardType="numeric"
                      onChangeText={(v) => {
                        const digits = v.replace(/\D/g, '');
                        setMinimumOrderValue(digits);
                      }}
                      placeholder="e.g. 500"
                      prefix="₹"
                      value={minimumOrderValue}
                    />
                    <Text style={{ fontSize: 12, fontFamily: theme.fontFamily.label, color: theme.colors.inkMuted, marginTop: 6 }}>
                      Minimum cart value required to apply this code.
                    </Text>
                  </View>

                  {/* Terms / seller notes */}
                  <View>
                    <FieldLabel>Terms &amp; Notes (optional)</FieldLabel>
                    <SubmergedInput
                      autoCapitalize="sentences"
                      onChangeText={setSellerNotes}
                      placeholder="Any usage restrictions or tips for the buyer…"
                      value={sellerNotes}
                    />
                  </View>
                </>
              )}

              {/* ── Lock notice ── */}
              <Text style={{ fontSize: 13, fontFamily: theme.fontFamily.body, color: theme.colors.inkMuted }}>
                {locked
                  ? `This listing is ${formatStatus(listingResource.data.status)} and can no longer be changed.`
                  : 'Once an order exists, the listing becomes immutable.'}
              </Text>

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

              {/* ── Actions ── */}
              <View style={{ gap: theme.spacing[3] }}>
                <PrimaryButton
                  disabled={!canSubmit}
                  label="Save changes"
                  loading={submitting}
                  onPress={() => {
                    void handleSubmit();
                  }}
                  tone="brand"
                />
                <PrimaryButton
                  label="Back to listings"
                  onPress={() => {
                    router.replace('/listings');
                  }}
                  tone="secondary"
                />
              </View>

            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
