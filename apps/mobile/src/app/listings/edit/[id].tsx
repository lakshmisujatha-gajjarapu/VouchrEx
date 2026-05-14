import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfigChangeBanner } from '@/components/config-change-banner';
import { DateField } from '@/components/date-field';
import { FilterChip } from '@/components/filter-chip';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { useAuth } from '@/hooks/use-auth';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { useConfig } from '@/hooks/use-config';
import { api } from '@/lib/api';
import { searchBrandfetchBrands } from '@/lib/brandfetch';
import { formatStatus } from '@/lib/format';
import { useTheme } from '@/theme/theme-context';

const VOUCHER_TYPES = ['gift-card', 'promo-code', 'cashback', 'subscription'] as const;
type VoucherType = (typeof VOUCHER_TYPES)[number];

type Suggestion = {
  readonly name: string;
  readonly meta: string;
  readonly source: 'local' | 'brandfetch';
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
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const deferredBrandName = useDeferredValue(brandName.trim());

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
  const canSubmit = Boolean(
    listingResource.data &&
      !locked &&
      brandName.trim() &&
      expiryDate &&
      parsedFaceValue > 0 &&
      parsedSellingPrice > 0 &&
      parsedSellingPrice < parsedFaceValue &&
      !faceValueExceedsCap
  );

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

  const divider = (
    <View
      style={{
        height: 1,
        backgroundColor: theme.colors.border,
        marginVertical: 12,
      }}
    />
  );

  if (listingResource.loading && !listingResource.data) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: theme.colors.background }}>
        <ActivityIndicator color={theme.colors.brand} />
      </View>
    );
  }

  if (!listingResource.data) {
    return (
      <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
        <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
          <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: theme.spacing[3], gap: theme.spacing[3] }}>
            <Text className="font-label text-caption font-extrabold uppercase tracking-[0.6px]" style={{ color: theme.colors.brand }}>
              Listings
            </Text>
            <Text className="font-headline text-[26px] font-bold leading-[30px]" style={{ color: theme.colors.ink }}>
              Edit listing
            </Text>
            <Text className="text-body" style={{ color: theme.colors.danger }}>
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
    <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ConfigChangeBanner />
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: theme.spacing[4], gap: theme.spacing[3] }}>
              <View>
                <Text className="font-label text-caption font-extrabold uppercase tracking-[0.6px]" style={{ color: theme.colors.brand }}>
                  Listings
                </Text>
                <Text className="font-headline text-[26px] font-bold leading-[30px]" style={{ color: theme.colors.ink }}>
                  Edit listing
                </Text>
                <Text className="mt-1 text-caption" style={{ color: theme.colors.inkMuted }}>
                  Update seller-side details before the listing turns into an order.
                </Text>
              </View>

              <View
                className="rounded-app-xl"
                style={{
                  backgroundColor: theme.colors.surface,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  shadowColor: theme.colors.shadow,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 1,
                  shadowRadius: 12,
                  elevation: 2,
                  padding: theme.spacing[4],
                }}>
                <Text className="mb-2 font-label text-caption font-extrabold uppercase tracking-[0.5px]" style={{ color: theme.colors.brand }}>
                  Brand {brandName.trim() ? `· ${brandName.trim()}` : ''}
                </Text>
                <View
                  className="flex-row items-center rounded-app-sm"
                  style={{
                    backgroundColor: theme.colors.surfaceTray,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    paddingHorizontal: 10,
                    gap: 6,
                    height: 40,
                  }}>
                  <Ionicons color={theme.colors.inkMuted} name="search-outline" size={15} />
                  <TextInput
                    className="flex-1 font-label"
                    onChangeText={setBrandName}
                    placeholder="Enter brand name"
                    placeholderTextColor={theme.colors.inkMuted}
                    style={{ color: theme.colors.ink, fontSize: 14, letterSpacing: 0 }}
                    value={brandName}
                  />
                  {suggestionsResource.loading ? (
                    <ActivityIndicator color={theme.colors.brand} size="small" />
                  ) : null}
                </View>

                {deferredBrandName.length >= 2 ? null : (
                  <Text className="mt-2 text-caption" style={{ color: theme.colors.inkMuted }}>
                    Start typing to see local matches and Brandfetch suggestions.
                  </Text>
                )}

                {deferredBrandName.length >= 2 && (suggestionsResource.data?.length ?? 0) > 0 ? (
                  <View className="mt-2 gap-2">
                    <View className="flex-row flex-wrap gap-1">
                      {suggestionsResource.data?.map((suggestion) => (
                        <FilterChip
                          key={`${suggestion.source}:${suggestion.name}`}
                          label={suggestion.name}
                          onPress={() => {
                            setBrandName(suggestion.name);
                          }}
                          selected={normalizeBrandName(suggestion.name) === normalizeBrandName(brandName)}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}

                {divider}

                <Text className="mb-2 font-label text-caption font-extrabold uppercase tracking-[0.5px]" style={{ color: theme.colors.brand }}>
                  Type
                </Text>
                <View className="flex-row flex-wrap gap-1">
                  {VOUCHER_TYPES.map((type) => (
                    <FilterChip
                      key={type}
                      label={type}
                      onPress={() => {
                        setVoucherType(type);
                      }}
                      selected={voucherType === type}
                    />
                  ))}
                </View>

                {divider}

                <Text className="mb-2 font-label text-caption font-extrabold uppercase tracking-[0.5px]" style={{ color: theme.colors.brand }}>
                  Pricing {discount > 0 ? `· ${String(discount)}% off` : ''}
                </Text>
                <View className="mb-2 flex-row gap-2">
                  <View className="flex-1">
                    <TextField
                      label="Face value (₹)"
                      onChangeText={(v) => { handlePriceInput(v, setFaceValue); }}
                      value={faceValue}
                      keyboardType="numeric"
                      placeholder="500"
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
                  <View className="flex-1">
                    <TextField
                      label="Sell price (₹)"
                      onChangeText={(v) => { handlePriceInput(v, setSellingPrice); }}
                      value={sellingPrice}
                      keyboardType="numeric"
                      placeholder="420"
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
                <View className="mb-2">
                  <DateField
                    label="Expiry date"
                    minimumDate={new Date(Date.now() + 48 * 60 * 60 * 1000)}
                    onChange={setExpiryDate}
                    value={expiryDate}
                  />
                </View>
                <TextField
                  label="Voucher code (optional replacement)"
                  onChangeText={setCode}
                  value={code}
                  autoCapitalize="characters"
                  placeholder="Leave blank to keep current code"
                />

                <Text className="mt-2 text-caption" style={{ color: theme.colors.inkMuted }}>
                  {locked
                    ? `This listing is ${formatStatus(listingResource.data.status)} and can no longer be changed.`
                    : 'Once an order exists, the listing becomes immutable.'}
                </Text>

                <View className="mt-4 gap-2">
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

              {feedback ? (
                <Text
                  className="text-center text-caption font-semibold"
                  style={{ color: feedback.ok ? theme.colors.success : theme.colors.danger }}>
                  {feedback.text}
                </Text>
              ) : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
