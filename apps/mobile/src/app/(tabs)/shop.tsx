import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { FilterChip } from '@/components/filter-chip';
import { HorizontalChipRow } from '@/components/horizontal-chip-row';
import { ListingCard } from '@/components/listing-card';
import { PrimaryButton } from '@/components/primary-button';
import { ProfileAvatar } from '@/components/profile-avatar';
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { useListingsSocket } from '@/hooks/use-listings-socket';
import { api } from '@/lib/api';
import { useTheme } from '@/theme/theme-context';

const SORT_OPTIONS = ['latest', 'best-discount', 'expiring', 'price-low'] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

const DISCOUNT_MAX = 100;
const THUMB_SIZE = 22;
const SNAP_STEP = 5;

function snapDiscount(raw: number) {
  return Math.round(raw / SNAP_STEP) * SNAP_STEP;
}

function sortLabel(o: SortOption) {
  return o === 'price-low' ? 'Price ↑' : o === 'best-discount' ? 'Best deal' : o === 'expiring' ? 'Expiring' : 'Latest';
}

function DiscountSlider({
  value,
  onChange,
}: {
  readonly value: number;
  readonly onChange: (v: number) => void;
}) {
  const theme = useTheme();
  const trackRef = useRef<View>(null);
  const widthRef = useRef(0);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const thumbAnim = useRef(new Animated.Value(0)).current;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (widthRef.current > 0) {
      const x = (value / DISCOUNT_MAX) * widthRef.current;
      currentXRef.current = x;
      thumbAnim.setValue(x);
    }
  }, [value, thumbAnim]);

  const commitX = useCallback((x: number) => {
    const clamped = Math.max(0, Math.min(widthRef.current, x));
    const v = snapDiscount(Math.round((clamped / widthRef.current) * DISCOUNT_MAX));
    const snappedX = (v / DISCOUNT_MAX) * widthRef.current;
    currentXRef.current = snappedX;
    thumbAnim.setValue(snappedX);
    onChangeRef.current(v);
  }, [thumbAnim]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        trackRef.current?.measureInWindow((px) => {
          const tapX = Math.max(0, Math.min(widthRef.current, evt.nativeEvent.pageX - px));
          startXRef.current = tapX;
          currentXRef.current = tapX;
          thumbAnim.setValue(tapX);
        });
      },
      onPanResponderMove: (_, gesture) => {
        const x = Math.max(0, Math.min(widthRef.current, startXRef.current + gesture.dx));
        currentXRef.current = x;
        thumbAnim.setValue(x);
      },
      onPanResponderRelease: (_, gesture) => {
        commitX(startXRef.current + gesture.dx);
      },
      onPanResponderTerminate: (_, gesture) => {
        commitX(startXRef.current + gesture.dx);
      },
    })
  ).current;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] }}>
      <View
        ref={trackRef}
        style={{ flex: 1, height: THUMB_SIZE + 8, justifyContent: 'center' }}
        onLayout={(e) => {
          widthRef.current = e.nativeEvent.layout.width;
          trackRef.current?.measureInWindow(() => {});
          const x = (value / DISCOUNT_MAX) * widthRef.current;
          currentXRef.current = x;
          thumbAnim.setValue(x);
        }}
        {...panResponder.panHandlers}
      >
        <View style={{ height: 4, borderRadius: theme.radius.pill, backgroundColor: theme.colors.border, overflow: 'hidden' }}>
          <Animated.View style={{ height: '100%', width: thumbAnim, backgroundColor: theme.colors.brand }} />
        </View>
        <Animated.View style={{
          position: 'absolute',
          width: THUMB_SIZE,
          height: THUMB_SIZE,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.brand,
          borderWidth: 2.5,
          borderColor: theme.colors.surface,
          shadowColor: theme.colors.brand,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.4,
          shadowRadius: 6,
          elevation: 4,
          transform: [{ translateX: Animated.subtract(thumbAnim, THUMB_SIZE / 2) }],
        }} />
      </View>
    </View>
  );
}

export default function ShopScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [category, setCategory] = useState<string | undefined>();

  // Single atomic object — updated only when Apply is tapped, drives API call
  const [appliedFilters, setAppliedFilters] = useState<{ sort: SortOption; minDiscount: number }>({
    sort: 'best-discount',
    minDiscount: 0,
  });

  // Draft values — live inside the sheet, never touch the API until Apply
  const [draftSort, setDraftSort] = useState<SortOption | null>(null);
  const [draftMinDiscount, setDraftMinDiscount] = useState(0);

  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['65%'], []);
  const deferredQuery = useDeferredValue(query.trim());

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} pressBehavior="close" />
    ),
    []
  );

  const openSheet = useCallback(() => {
    setDraftSort(appliedFilters.sort !== 'best-discount' ? appliedFilters.sort : null);
    setDraftMinDiscount(appliedFilters.minDiscount);
    bottomSheetRef.current?.expand();
  }, [appliedFilters]);

  const closeSheet = useCallback(() => {
    bottomSheetRef.current?.close();
  }, []);

  const applyFilters = useCallback(() => {
    const next = { sort: draftSort ?? 'best-discount', minDiscount: draftMinDiscount };
    setAppliedFilters(next);
    closeSheet();
  }, [draftSort, draftMinDiscount, closeSheet]);

  const brandsResource = useAsyncResource(useCallback(() => api.listBrands(), []), { enabled: true });

  const listingsResource = useAsyncResource(
    useCallback(
      () => {
        const params = {
          ...(deferredQuery ? { q: deferredQuery } : {}),
          ...(category ? { category } : {}),
          ...(appliedFilters.minDiscount > 0 ? { minDiscount: appliedFilters.minDiscount } : {}),
          sort: appliedFilters.sort,
        };
        return api.listListings(params);
      },
      [category, deferredQuery, appliedFilters],
    ),
    { enabled: true },
  );

  const reloadListings = useCallback(() => { void listingsResource.reload(); }, [listingsResource]);
  useListingsSocket({ onCreated: reloadListings, onUpdated: reloadListings });

  const categories = useMemo(() => {
    const raw = brandsResource.data?.map((b) => b.category) ?? [];
    return ['All', ...Array.from(new Set(raw))];
  }, [brandsResource.data]);

  const avgDiscount = useMemo(() => {
    const ls = listingsResource.data ?? [];
    return ls.length > 0
      ? Math.round(ls.reduce((s, l) => s + l.discountPercent, 0) / ls.length)
      : 0;
  }, [listingsResource.data]);

  const activeFilterCount =
    (appliedFilters.sort !== 'best-discount' ? 1 : 0) +
    (appliedFilters.minDiscount > 0 ? 1 : 0);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

          {/* ── Hero + search ── */}
          <View style={{ paddingHorizontal: theme.spacing[5], paddingTop: theme.spacing[2], gap: theme.spacing[4] }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: theme.spacing[2] }}>
              <View style={{ gap: theme.spacing[1], flex: 1, paddingRight: theme.spacing[3] }}>
                <Text style={{
                  fontFamily: theme.fontFamily.headlineExtra,
                  fontSize: 56,
                  lineHeight: 58,
                  letterSpacing: -1.5,
                  color: theme.colors.ink,
                }}>
                  Shop
                </Text>
                <Text style={{
                  fontFamily: theme.fontFamily.body,
                  fontSize: 15,
                  color: theme.colors.inkSecondary,
                }}>
                  {(listingsResource.data?.length ?? 0) > 0
                    ? `${String(listingsResource.data?.length)} listings · avg ${String(avgDiscount)}% off`
                    : 'Discover premium secondary market vouchers.'}
                </Text>
              </View>
              <ProfileAvatar marginTop={6} />
            </View>

            {/* ── Search bar ── */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderRadius: theme.radius.sm,
              borderWidth: 1,
              paddingHorizontal: theme.spacing[3],
              gap: theme.spacing[2],
              minHeight: 48,
              backgroundColor: theme.colors.surfaceTray,
              borderColor: searchFocused ? theme.colors.brand : theme.colors.border,
            }}>
              <Ionicons color={searchFocused ? theme.colors.brand : theme.colors.inkMuted} name="search-outline" size={18} />
              <TextInput
                cursorColor={theme.colors.brand}
                onBlur={() => { setSearchFocused(false); }}
                onChangeText={setQuery}
                onFocus={() => { setSearchFocused(true); }}
                placeholder="Search brand or category"
                placeholderTextColor={theme.colors.inkMuted}
                style={{
                  flex: 1, fontFamily: theme.fontFamily.body,
                  fontSize: 15, color: theme.colors.ink, letterSpacing: 0,
                }}
                value={query}
              />
              {query ? (
                <Pressable onPress={() => { setQuery(''); }} accessibilityLabel="Clear search">
                  <Ionicons color={theme.colors.inkMuted} name="close-circle" size={18} />
                </Pressable>
              ) : null}
              <View style={{ width: 1, height: 18, backgroundColor: theme.colors.border }} />
              {/* ── Refine button ── */}
              <Pressable
                onPress={openSheet}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  minHeight: 32,
                  paddingHorizontal: 10,
                  borderRadius: theme.radius.pill,
                  borderWidth: 1,
                  backgroundColor: activeFilterCount > 0 ? theme.colors.brandSoft : theme.colors.surfaceRaised,
                  borderColor: activeFilterCount > 0 ? theme.colors.pillBrandBorder : theme.colors.border,
                  opacity: pressed ? 0.8 : 1,
                })}>
                <Ionicons
                  name="options-outline"
                  size={16}
                  color={activeFilterCount > 0 ? theme.colors.brand : theme.colors.inkMuted}
                />
                {activeFilterCount > 0 ? (
                  <Text style={{
                    fontFamily: theme.fontFamily.labelSemi,
                    fontSize: 12,
                    color: theme.colors.brand,
                  }}>
                    {String(activeFilterCount)}
                  </Text>
                ) : null}
              </Pressable>
            </View>
          </View>

          {/* ── Category chips ── */}
          {categories.length > 1 ? (
            <HorizontalChipRow
              options={categories}
              selected={category ?? 'All'}
              onSelect={(cat) => { setCategory(cat === 'All' ? undefined : cat); }}
              style={{ marginTop: 16 }}
            />
          ) : null}

          {/* ── Listings ── */}
          <View style={{ paddingHorizontal: theme.spacing[5], gap: theme.spacing[5], marginTop: theme.spacing[5] }}>
            {listingsResource.loading && !listingsResource.data ? (
              <ActivityIndicator color={theme.colors.brand} />
            ) : null}

            {listingsResource.error ? (
              <Text style={{ fontFamily: theme.fontFamily.label, fontSize: 14, color: theme.colors.danger }}>
                {listingsResource.error}
              </Text>
            ) : null}

            {listingsResource.data?.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onPress={() => { router.push(`/listings/${listing.id}`); }}
              />
            ))}

            {!listingsResource.loading && listingsResource.data?.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ fontFamily: theme.fontFamily.headline, fontSize: 18, color: theme.colors.inkMuted }}>No matches</Text>
                <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 14, color: theme.colors.inkMuted, marginTop: 4 }}>Try another brand or category</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* ── Refine bottom sheet ── */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: theme.colors.surface }}
        handleIndicatorStyle={{ backgroundColor: theme.colors.border }}
      >
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: theme.spacing[5],
          paddingTop: theme.spacing[2],
          paddingBottom: theme.spacing[4],
        }}>
          <Text style={{ fontFamily: theme.fontFamily.headline, fontSize: 22, color: theme.colors.ink }}>
            Refine
          </Text>
          <Pressable
            onPress={closeSheet}
            style={({ pressed }) => ({
              width: 32, height: 32, borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.surfaceRaised,
              alignItems: 'center', justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}>
            <Ionicons name="close" size={18} color={theme.colors.inkMuted} />
          </Pressable>
        </View>

        <BottomSheetScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: theme.spacing[5] }}>

          {/* ── Sort by ── */}
          <View style={{ paddingHorizontal: theme.spacing[5], marginBottom: theme.spacing[5] }}>
            <Text style={{
              fontFamily: theme.fontFamily.labelSemi,
              fontSize: 11,
              letterSpacing: 1.2,
              color: theme.colors.inkMuted,
              marginBottom: theme.spacing[3],
            }}>
              SORT BY
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] }}>
              {SORT_OPTIONS.map((option) => (
                <FilterChip
                  key={option}
                  label={sortLabel(option)}
                  selected={draftSort === option}
                  onPress={() => { setDraftSort(option); }}
                />
              ))}
            </View>
          </View>

          {/* ── Divider ── */}
          <View style={{ height: 1, backgroundColor: theme.colors.borderHair, marginHorizontal: theme.spacing[5], marginBottom: theme.spacing[5] }} />

          {/* ── Min. Discount ── */}
          <View style={{ paddingHorizontal: theme.spacing[5], marginBottom: theme.spacing[6] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing[4] }}>
              <Text style={{
                fontFamily: theme.fontFamily.labelSemi,
                fontSize: 11,
                letterSpacing: 1.2,
                color: theme.colors.inkMuted,
              }}>
                MIN. DISCOUNT
              </Text>
              <View style={{
                paddingHorizontal: theme.spacing[3],
                paddingVertical: 4,
                borderRadius: theme.radius.pill,
                backgroundColor: draftMinDiscount > 0 ? theme.colors.brandSoft : theme.colors.surfaceHighest,
              }}>
                <Text style={{
                  fontFamily: theme.fontFamily.mono,
                  fontSize: 16,
                  color: draftMinDiscount > 0 ? theme.colors.brand : theme.colors.inkMuted,
                }}>
                  {draftMinDiscount > 0 ? `${String(draftMinDiscount)}%` : '0%'}
                </Text>
              </View>
            </View>
            <DiscountSlider value={draftMinDiscount} onChange={setDraftMinDiscount} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ fontFamily: theme.fontFamily.label, fontSize: 11, color: theme.colors.inkMuted }}>0%</Text>
              <Text style={{ fontFamily: theme.fontFamily.label, fontSize: 11, color: theme.colors.inkMuted }}>50%</Text>
              <Text style={{ fontFamily: theme.fontFamily.label, fontSize: 11, color: theme.colors.inkMuted }}>100%</Text>
            </View>
          </View>

          {/* ── Apply button ── */}
          <View style={{ paddingHorizontal: theme.spacing[5], paddingBottom: theme.spacing[6], paddingTop: theme.spacing[2] }}>
            <Pressable
              onPress={() => { setDraftSort(null); setDraftMinDiscount(0); }}
              disabled={draftSort === null && draftMinDiscount === 0}
              style={{ alignItems: 'center', marginBottom: 14, opacity: (draftSort !== null || draftMinDiscount > 0) ? 1 : 0 }}>
              <Text style={{ fontFamily: theme.fontFamily.label, fontSize: 13, color: theme.colors.inkMuted }}>
                Clear all filters
              </Text>
            </Pressable>
            <PrimaryButton label="Apply Filters" onPress={applyFilters} tone="brand" icon="checkmark" />
          </View>

        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}
