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
  Alert,
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
import { useAuth } from '@/hooks/use-auth';
import { useListingsSocket } from '@/hooks/use-listings-socket';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { readTrustBannerDismissed, writeTrustBannerDismissed } from '@/lib/storage';
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

function getTimeBasedConfig() {
  const hour = new Date().getHours();
  const day = new Date().getDay();
  const isWeekend = day === 0 || day === 6;

  if (isWeekend) return { title: 'Weekend vibes', category: undefined, icon: 'sparkles-outline' as const };
  if (hour >= 7 && hour < 9) return { title: 'Morning picks', category: 'Coffee & Breakfast', icon: 'cafe-outline' as const };
  if (hour >= 12 && hour < 14) return { title: 'Lunch break deals', category: 'Food', icon: 'fast-food-outline' as const };
  if (hour >= 17 && hour < 21) return { title: 'Dinner tonight', category: 'Food', icon: 'pizza-outline' as const };
  if (hour >= 22 || hour < 0) return { title: 'Night owl', category: 'Entertainment', icon: 'moon-outline' as const };
  
  return { title: 'Featured deals', category: undefined, icon: 'flame-outline' as const };
}

function SectionHeader({ title, icon, subtitle }: { title: string; icon?: keyof typeof Ionicons.glyphMap; subtitle?: string }) {
  const theme = useTheme();
  return (
    <View style={{ paddingHorizontal: theme.spacing[5], marginBottom: theme.spacing[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}>
        {icon && <Ionicons name={icon} size={20} color={theme.colors.brand} />}
        <Text style={{ fontFamily: theme.fontFamily.headline, fontSize: 18, color: theme.colors.ink }}>{title}</Text>
      </View>
      {subtitle && <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 13, color: theme.colors.inkSecondary }}>{subtitle}</Text>}
    </View>
  );
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
  const { sessionToken, user } = useAuth();
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
        return api.listListings(params, sessionToken);
      },
      [category, deferredQuery, appliedFilters, sessionToken],
    ),
    { enabled: true },
  );

  const reloadListings = useCallback(() => { void listingsResource.reload(); }, [listingsResource]);
  useListingsSocket({ onCreated: reloadListings, onUpdated: reloadListings });

  const categories = useMemo(() => {
    const raw = brandsResource.data?.map((b) => b.category) ?? [];
    return ['All', ...Array.from(new Set(raw))];
  }, [brandsResource.data]);

  const activeFilterCount =
    (appliedFilters.sort !== 'best-discount' ? 1 : 0) +
    (appliedFilters.minDiscount > 0 ? 1 : 0);

  async function handleSetAlert(brandName: string) {
    if (!sessionToken) {
      Alert.alert('Sign in required', 'Please sign in to set brand alerts.');
      return;
    }
    try {
      const brands = await api.listBrands({ q: brandName, limit: 1 });
      if (brands.length > 0) {
        await api.createAlert(sessionToken, brands[0].id);
        Alert.alert('Alert Set!', `We'll notify you when a new ${brands[0].name} voucher is listed.`);
      } else {
        Alert.alert('Not available', 'This brand is not yet in our catalog for alerts.');
      }
    } catch (_e) {
      // silent fail
    }

  }

  const [trustBannerDismissed, setTrustBannerDismissed] = useState(true);
  useEffect(() => {
    if (!user || (user.totalSaved > 0)) return;
    void readTrustBannerDismissed().then((dismissed) => {
      setTrustBannerDismissed(dismissed);
    });
  }, [user]);

  function dismissTrustBanner() {
    setTrustBannerDismissed(true);
    void writeTrustBannerDismissed();
  }

  const dealResource = useAsyncResource(useCallback(() => api.getDealOfDay(), []), { enabled: true });

  const timeBasedConfig = useMemo(() => getTimeBasedConfig(), []);

  const sections = useMemo(() => {
    if (!listingsResource.data) return { expiringSoon: [], newThisHour: [], bestDeals: [], timeBased: [] };

    const now = Date.now();
    const seen = new Set<string>();
    if (dealResource.data) seen.add(dealResource.data.id);

    const timeBased = timeBasedConfig.category
      ? listingsResource.data.filter(l => l.brand.category === timeBasedConfig.category)
      : [];
    timeBased.forEach(l => { seen.add(l.id); });

    const expiringSoon = listingsResource.data.filter(l =>
      !seen.has(l.id) && (new Date(l.expiryDate).getTime() - now) < 48 * 60 * 60 * 1000
    );
    expiringSoon.forEach(l => { seen.add(l.id); });

    const newThisHour = listingsResource.data.filter(l =>
      !seen.has(l.id) && (now - new Date(l.createdAt).getTime()) < 2 * 60 * 60 * 1000
    );
    newThisHour.forEach(l => { seen.add(l.id); });

    const bestDeals = [...listingsResource.data]
      .filter(l => !seen.has(l.id))
      .sort((a, b) => b.discountPercent - a.discountPercent)
      .slice(0, 5);

    return { expiringSoon, newThisHour, bestDeals, timeBased };
  }, [listingsResource.data, timeBasedConfig]);

  const isFiltering = !!deferredQuery || !!category || activeFilterCount > 0;

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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}>
                  <Ionicons name={timeBasedConfig.icon} size={28} color={theme.colors.brand} />
                  <Text style={{
                    fontFamily: theme.fontFamily.headlineExtra,
                    fontSize: 32,
                    lineHeight: 36,
                    letterSpacing: -0.8,
                    color: theme.colors.ink,
                  }}>
                    {timeBasedConfig.title}
                  </Text>
                </View>
                <Text style={{
                  fontFamily: theme.fontFamily.body,
                  fontSize: 15,
                  color: theme.colors.inkSecondary,
                }}>
                  {user && user.totalSaved > 0 
                    ? `🎉 You've saved ${formatCurrency(user.totalSaved)} total on Vouchrex!`
                    : 'Save up to 35% on your favorite food, travel, and shopping brands.'}
                </Text>
              </View>
              <ProfileAvatar marginTop={6} />
            </View>
          </View>

          {/* ── Trust Banner (first-time buyers only, dismissible) ── */}
          {!trustBannerDismissed && (
            <Animated.View
              entering={reducedMotion ? undefined : FadeInDown.duration(300)}
              exiting={reducedMotion ? undefined : FadeOut.duration(200)}
              style={{
                marginHorizontal: theme.spacing[5],
                marginBottom: theme.spacing[4],
                backgroundColor: theme.colors.brandSoft,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: theme.colors.pillBrandBorder,
                padding: theme.spacing[4],
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: theme.spacing[3],
              }}
            >
              <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.brand} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, gap: theme.spacing[1] }}>
                <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 13, color: theme.colors.brand }}>
                  Your money is protected
                </Text>
                <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 13, color: theme.colors.inkSecondary, lineHeight: 18 }}>
                  Vouchrex uses escrow — your money only releases when you confirm the voucher works. You cannot lose.
                </Text>
              </View>
              <Pressable
                onPress={dismissTrustBanner}
                hitSlop={8}
                accessibilityLabel="Dismiss"
              >
                <Ionicons name="close" size={16} color={theme.colors.inkMuted} />
              </Pressable>
            </Animated.View>
          )}

          {/* ── Sticky Search Bar ── */}
          <View style={{
            backgroundColor: theme.colors.background,
            paddingHorizontal: theme.spacing[5],
            paddingVertical: theme.spacing[3],
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.borderHair,
          }}>
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
          </View>

          {/* ── Dynamic Sections (Hidden when searching/filtering) ── */}
          {!isFiltering && listingsResource.data ? (
            <View style={{ marginTop: theme.spacing[6], gap: theme.spacing[8] }}>

              {dealResource.data && (
                <View>
                  <SectionHeader title="Deal of the Day" icon="star-outline" subtitle="Admin-picked — today only" />
                  <View style={{ paddingHorizontal: theme.spacing[5] }}>
                    <ListingCard listing={dealResource.data} onPress={() => { router.push(`/listings/${String(dealResource.data?.id)}`); }} />
                  </View>
                </View>
              )}

              {sections.timeBased.length > 0 && (
                <View style={{ gap: theme.spacing[3] }}>
                  <SectionHeader title={timeBasedConfig.title} icon={timeBasedConfig.icon} subtitle={`Top picks for your ${timeBasedConfig.title.toLowerCase()}`} />
                  <View style={{ paddingHorizontal: theme.spacing[5], gap: theme.spacing[3] }}>
                    {sections.timeBased.slice(0, 3).map(l => (
                      <ListingCard key={l.id} listing={l} onPress={() => { router.push(`/listings/${l.id}`); }} />
                    ))}
                  </View>
                </View>
              )}

              {sections.expiringSoon.length > 0 && (
                <View style={{ gap: theme.spacing[3] }}>
                  <SectionHeader title="Expiring Soon" icon="time-outline" subtitle="Last chance to grab these deals" />
                  <View style={{ paddingHorizontal: theme.spacing[5], gap: theme.spacing[3] }}>
                    {sections.expiringSoon.slice(0, 3).map(l => (
                      <ListingCard key={l.id} listing={l} onPress={() => { router.push(`/listings/${l.id}`); }} />
                    ))}
                  </View>
                </View>
              )}

              {sections.newThisHour.length > 0 && (
                <View style={{ gap: theme.spacing[3] }}>
                  <SectionHeader title="New This Hour" icon="flash-outline" subtitle="Fresh inventory just listed" />
                  <View style={{ paddingHorizontal: theme.spacing[5], gap: theme.spacing[3] }}>
                    {sections.newThisHour.slice(0, 3).map(l => (
                      <ListingCard key={l.id} listing={l} onPress={() => { router.push(`/listings/${l.id}`); }} />
                    ))}
                  </View>
                </View>
              )}

              {sections.bestDeals.length > 0 && (
                <View style={{ gap: theme.spacing[3] }}>
                  <SectionHeader title="Best Deals" icon="trending-up-outline" subtitle="Highest discounts available now" />
                  <View style={{ paddingHorizontal: theme.spacing[5], gap: theme.spacing[3] }}>
                    {sections.bestDeals.slice(0, 3).map(l => (
                      <ListingCard key={l.id} listing={l} onPress={() => { router.push(`/listings/${l.id}`); }} />
                    ))}
                  </View>
                </View>
              )}
            </View>
          ) : null}

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

          {/* ── All Listings ── */}
          <View style={{ paddingHorizontal: theme.spacing[5], gap: theme.spacing[5], marginTop: theme.spacing[5] }}>
            {!isFiltering && listingsResource.data && (
              <Text style={{ fontFamily: theme.fontFamily.headline, fontSize: 18, color: theme.colors.ink, marginBottom: theme.spacing[2] }}>All Listings</Text>
            )}
            
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
              <View style={{ alignItems: 'center', paddingVertical: 40, gap: 16 }}>
                <View style={{ gap: 4, alignItems: 'center' }}>
                  <Text style={{ fontFamily: theme.fontFamily.headline, fontSize: 18, color: theme.colors.inkMuted }}>No matches</Text>
                  <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 14, color: theme.colors.inkMuted, textAlign: 'center' }}>Try another brand or category</Text>
                </View>
                {deferredQuery.length > 2 && (
                  <Pressable 
                    onPress={() => { void handleSetAlert(deferredQuery); }}
                    style={({ pressed }) => ({
                      backgroundColor: theme.colors.brandSoft,
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      borderRadius: theme.radius.pill,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      opacity: pressed ? 0.7 : 1
                    })}>
                    <Ionicons name="notifications-outline" size={18} color={theme.colors.brand} />
                    <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 14, color: theme.colors.brand }}>Alert me when listed</Text>
                  </Pressable>
                )}
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
