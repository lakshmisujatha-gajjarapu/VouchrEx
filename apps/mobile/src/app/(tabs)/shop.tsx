import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { FilterChip } from '@/components/filter-chip';
import { HorizontalChipRow } from '@/components/horizontal-chip-row';
import { ListingCard } from '@/components/listing-card';
import { ListingCardSkeleton } from '@/components/listing-card-skeleton';
import { PrimaryButton } from '@/components/primary-button';
import { ProfileAvatar } from '@/components/profile-avatar';
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Gesture, GestureDetector, type GestureUpdateEvent, type PanGestureHandlerEventPayload } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from 'nativewind';

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
  const width = useSharedValue(0);
  const translateX = useSharedValue(0);
  const thumbScale = useSharedValue(1);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (width.value > 0) {
      translateX.value = (value / DISCOUNT_MAX) * width.value;
    }
  }, [value, width.value, translateX]);

  const gesture = Gesture.Pan()
    .onBegin(() => {
      thumbScale.value = withSpring(1.2);
    })
    .onUpdate((e: GestureUpdateEvent<PanGestureHandlerEventPayload>) => {
      const x = Math.max(0, Math.min(width.value, e.x));
      translateX.value = x;
    })
    .onEnd(() => {
      const v = snapDiscount(Math.round((translateX.value / width.value) * DISCOUNT_MAX));
      const snappedX = (v / DISCOUNT_MAX) * width.value;
      
      translateX.value = reducedMotion ? snappedX : withSpring(snappedX, { damping: 20, stiffness: 150 });
      thumbScale.value = withSpring(1);
      scheduleOnRN(onChange, v);
    });

  const tapGesture = Gesture.Tap()
    .onEnd((e) => {
      const x = Math.max(0, Math.min(width.value, e.x));
      const v = snapDiscount(Math.round((x / width.value) * DISCOUNT_MAX));
      const snappedX = (v / DISCOUNT_MAX) * width.value;

      translateX.value = reducedMotion ? snappedX : withSpring(snappedX, { damping: 20, stiffness: 150 });
      scheduleOnRN(onChange, v);
    });

  const trackStyle = useAnimatedStyle(() => ({
    width: translateX.value,
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value - THUMB_SIZE / 2 },
      { scale: thumbScale.value }
    ],
  }));

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] }}>
      <GestureDetector gesture={Gesture.Exclusive(gesture, tapGesture)}>
        <View
          style={{ flex: 1, height: THUMB_SIZE + 16, justifyContent: 'center' }}
          onLayout={(e) => {
            width.value = e.nativeEvent.layout.width;
            translateX.value = (value / DISCOUNT_MAX) * width.value;
          }}
        >
          {/* Track Base */}
          <View style={{ height: 6, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceHigh, overflow: 'hidden' }}>
            <Animated.View style={[{ height: '100%', backgroundColor: theme.colors.brand }, trackStyle]} />
          </View>
          
          {/* Thumb */}
          <Animated.View style={[
            {
              position: 'absolute',
              width: THUMB_SIZE,
              height: THUMB_SIZE,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.brand,
              borderWidth: 3,
              borderColor: theme.colors.surface,
              shadowColor: theme.colors.brand,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
            },
            thumbStyle,
          ]} />
        </View>
      </GestureDetector>
    </View>
  );
}

/**
 * A glassy backdrop for bottom sheets that blurs the content behind it.
 */
function GlassyBackdrop({ animatedIndex, style, onClose }: BottomSheetBackdropProps & { readonly onClose: () => void }) {
  const { colorScheme } = useColorScheme();
  const theme = useTheme();
  
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      animatedIndex.value,
      [-1, 0],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));

  const isHidden = useAnimatedStyle(() => ({
    pointerEvents: animatedIndex.value === -1 ? 'none' : 'auto',
  }));

  return (
    <Animated.View
      style={[style, animatedStyle, isHidden, { backgroundColor: theme.colors.scrim }]}
    >
      <Pressable style={{ flex: 1 }} onPress={onClose}>
        <BlurView
          intensity={theme.blurIntensity.high}
          tint={colorScheme === 'dark' ? 'dark' : 'light'}
          style={{ flex: 1 }}
        />
      </Pressable>
    </Animated.View>
  );
}

export default function ShopScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { colorScheme } = useColorScheme();
  const reducedMotion = useReducedMotion();
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [category, setCategory] = useState<string | undefined>();

  const [appliedFilters, setAppliedFilters] = useState<{ sort: SortOption; minDiscount: number }>({
    sort: 'best-discount',
    minDiscount: 0,
  });

  const [draftSort, setDraftSort] = useState<SortOption | null>(null);
  const [draftMinDiscount, setDraftMinDiscount] = useState(0);

  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['65%'], []);
  const deferredQuery = useDeferredValue(query.trim());

  const openSheet = useCallback(() => {
    setDraftSort(appliedFilters.sort !== 'best-discount' ? appliedFilters.sort : null);
    setDraftMinDiscount(appliedFilters.minDiscount);
    bottomSheetRef.current?.expand();
  }, [appliedFilters]);

  const closeSheet = useCallback(() => {
    bottomSheetRef.current?.close();
  }, []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <GlassyBackdrop {...props} onClose={closeSheet} />
    ),
    [closeSheet]
  );

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
    <Animated.View 
      entering={reducedMotion ? undefined : FadeIn.duration(400)}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView
          stickyHeaderIndices={[1]}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
        >

          {/* ── Hero ── */}
          <View style={{ paddingHorizontal: theme.spacing[5], paddingTop: theme.spacing[2], gap: theme.spacing[4], paddingBottom: theme.spacing[4] }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: theme.spacing[2] }}>
              <View style={{ gap: theme.spacing[1], flex: 1, paddingRight: theme.spacing[3] }}>
                <Text style={{
                  fontFamily: theme.fontFamily.headlineExtra,
                  fontSize: 32,
                  lineHeight: 36,
                  letterSpacing: -0.8,
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
          </View>

          {/* ── Sticky Glassy Search Bar ── */}
          <View style={{ backgroundColor: 'transparent' }}>
            <BlurView
              intensity={theme.blurIntensity.mid}
              tint={colorScheme === 'dark' ? 'dark' : 'light'}
              style={{
                paddingHorizontal: theme.spacing[5],
                paddingVertical: theme.spacing[3],
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.borderHair,
              }}
            >
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
            </BlurView>
          </View>

          {/* ── Category chips ── */}
          <View>
            {categories.length > 1 ? (
              <HorizontalChipRow
                options={categories}
                selected={category ?? 'All'}
                onSelect={(cat) => { setCategory(cat === 'All' ? undefined : cat); }}
                style={{ marginTop: 16 }}
              />
            ) : null}
          </View>

          {/* ── Listings ── */}
          <View style={{ paddingHorizontal: theme.spacing[5], gap: theme.spacing[5], marginTop: theme.spacing[5] }}>
            {listingsResource.loading && !listingsResource.data ? (
              <>
                <ListingCardSkeleton />
                <ListingCardSkeleton />
                <ListingCardSkeleton />
              </>
            ) : null}

            {listingsResource.error ? (
              <Text style={{ fontFamily: theme.fontFamily.label, fontSize: 14, color: theme.colors.danger }}>
                {listingsResource.error}
              </Text>
            ) : null}

            {listingsResource.data?.map((listing, index) => (
              <Animated.View
                key={listing.id}
                entering={reducedMotion ? undefined : FadeInDown.delay(index * 50).springify()}
                exiting={reducedMotion ? undefined : FadeOut.duration(200)}
                layout={reducedMotion ? undefined : LinearTransition.springify()}
              >
                <ListingCard
                  listing={listing}
                  onPress={() => { router.push(`/listings/${listing.id}`); }}
                />
              </Animated.View>
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

      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: theme.colors.surface }}
        handleIndicatorStyle={{ backgroundColor: theme.colors.border }}
      >
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

          <View style={{ height: 1, backgroundColor: theme.colors.borderHair, marginHorizontal: theme.spacing[5], marginBottom: theme.spacing[5] }} />

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
    </Animated.View>
  );
}
