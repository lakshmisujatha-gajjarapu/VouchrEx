import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateField } from '@/components/date-field';
import { FilterChip } from '@/components/filter-chip';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
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

export default function SellScreen() {
  const { sessionToken } = useAuth();
  const theme = useTheme();
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

  const selectedLocalSuggestion = useMemo(
    () =>
      suggestionsResource.data?.find(
        (suggestion) =>
          suggestion.source === 'local' &&
          normalizeBrandName(suggestion.name) === normalizeBrandName(brandName)
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
      setBrandName('');
      setCode('');
      setFaceValue('');
      setSellingPrice('');
      setExpiryDate(todayString());
      setFeedback({ ok: true, text: 'Live in the bazaar. This brand is now searchable for the next seller.' });
    } catch (e) {
      setFeedback({ ok: false, text: e instanceof Error ? e.message : 'Could not create listing.' });
    } finally {
      setSubmitting(false);
    }
  }

  const divider = <View style={{ height: 1, backgroundColor: theme.colors.border, marginVertical: 12 }} />;

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 12 }}>

          <View>
            <Text className="font-ui text-caption font-extrabold uppercase tracking-[0.6px]" style={{ color: theme.colors.brand }}>
              Sell
            </Text>
            <Text className="font-display text-[26px] font-bold leading-[30px]" style={{ color: theme.colors.ink }}>
              New listing
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
              padding: 16,
            }}>
            <Text className="mb-2 font-ui text-caption font-extrabold uppercase tracking-[0.5px]" style={{ color: theme.colors.brand }}>
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
                className="flex-1 font-ui"
                onChangeText={setBrandName}
                placeholder="Enter brand name"
                placeholderTextColor={theme.colors.inkMuted}
                style={{ color: theme.colors.ink, fontSize: 14, letterSpacing: 0 }}
                value={brandName}
              />
              {suggestionsResource.loading ? <ActivityIndicator color={theme.colors.brand} size="small" /> : null}
            </View>

            {selectedLocalSuggestion ? (
              <Text className="mt-2 text-caption" style={{ color: theme.colors.inkMuted }}>
                Existing marketplace brand: {selectedLocalSuggestion.meta}
              </Text>
            ) : deferredBrandName.length >= 2 ? (
              <Text className="mt-2 text-caption" style={{ color: theme.colors.inkMuted }}>
                No exact local match required. You can still create this brand.
              </Text>
            ) : (
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
                      onPress={() => { setBrandName(suggestion.name); }}
                      selected={normalizeBrandName(suggestion.name) === normalizeBrandName(brandName)}
                    />
                  ))}
                </View>
                <Text className="text-caption" style={{ color: theme.colors.inkMuted }}>
                  Suggestions combine your saved brands with live Brandfetch results.
                </Text>
              </View>
            ) : null}

            {divider}

            <Text className="mb-2 font-ui text-caption font-extrabold uppercase tracking-[0.5px]" style={{ color: theme.colors.brand }}>
              Type
            </Text>
            <View className="flex-row flex-wrap gap-1">
              {VOUCHER_TYPES.map((t) => (
                <FilterChip key={t} label={t} onPress={() => { setVoucherType(t); }} selected={voucherType === t} />
              ))}
            </View>

            {divider}

            <Text className="mb-2 font-ui text-caption font-extrabold uppercase tracking-[0.5px]" style={{ color: theme.colors.brand }}>
              Pricing {discount > 0 ? `· ${String(discount)}% off` : ''}
            </Text>
            <View className="mb-2 flex-row gap-2">
              <View className="flex-1">
                <TextField label="Face value (₹)" onChangeText={setFaceValue} value={faceValue} keyboardType="numeric" placeholder="500" />
              </View>
              <View className="flex-1">
                <TextField label="Sell price (₹)" onChangeText={setSellingPrice} value={sellingPrice} keyboardType="numeric" placeholder="420" />
              </View>
            </View>
            <View className="mb-2">
              <DateField label="Expiry date" minimumDate={new Date()} onChange={setExpiryDate} value={expiryDate} />
            </View>
            <TextField label="Voucher code" onChangeText={setCode} value={code} autoCapitalize="characters" />
          </View>
          {feedback ? (
            <Text
              className="text-center text-caption font-semibold"
              style={{ color: feedback.ok ? theme.colors.success : theme.colors.danger }}>
              {feedback.text}
            </Text>
          ) : null}

          <PrimaryButton
            disabled={!canSubmit}
            label="Create listing"
            loading={submitting}
            onPress={() => { void handleCreateListing(); }}
            tone="brand"
          />
        </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
