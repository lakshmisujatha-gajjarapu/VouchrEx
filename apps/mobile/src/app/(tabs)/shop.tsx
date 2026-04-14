import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { HorizontalChipRow } from '@/components/horizontal-chip-row';
import { ListingCard } from '@/components/listing-card';
import React, { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { api } from '@/lib/api';
import { useTheme } from '@/theme/ThemeContext';

const SORT_OPTIONS = ['latest', 'best-discount', 'expiring', 'price-low'] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

function sortLabel(o: SortOption) {
  return o === 'price-low' ? 'Price ↑' : o === 'best-discount' ? 'Best deal' : o === 'expiring' ? 'Expiring' : 'Latest';
}

export default function ShopScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [sort, setSort] = useState<SortOption>('best-discount');
  const [popoverVisible, setPopoverVisible] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, right: 20 });
  const sortBtnRef = useRef<View>(null);
  const popoverAnim = useRef(new Animated.Value(0)).current;
  const [category, setCategory] = useState<string | undefined>();
  const deferredQuery = useDeferredValue(query.trim());

  const openPopover = useCallback(() => {
    sortBtnRef.current?.measureInWindow((x, y, width, height) => {
      const screenWidth = Dimensions.get('window').width;
      setPopoverPos({ top: y + height + 8, right: screenWidth - x - width });
      setPopoverVisible(true);
      Animated.timing(popoverAnim, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    });
  }, [popoverAnim]);

  const closePopover = useCallback(() => {
    Animated.timing(popoverAnim, {
      toValue: 0,
      duration: 120,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => { setPopoverVisible(false); });
  }, [popoverAnim]);

  const brandsResource = useAsyncResource(useCallback(() => api.listBrands(), []), { enabled: true });

  const listingsResource = useAsyncResource(
    useCallback(
      () => api.listListings({
        ...(deferredQuery ? { q: deferredQuery } : {}),
        ...(category ? { category } : {}),
        sort,
      }),
      [category, deferredQuery, sort],
    ),
    { enabled: true },
  );

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

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

          {/* ── Hero + search ── */}
          <View style={{ paddingHorizontal: theme.spacing[5], paddingTop: theme.spacing[2], gap: theme.spacing[4] }}>
            <View style={{ gap: theme.spacing[1], marginTop: theme.spacing[2] }}>
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

            {/* ── Search bar (listings.tsx style) ── */}
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
              <View ref={sortBtnRef} collapsable={false}>
                <Pressable
                  onPress={popoverVisible ? closePopover : openPopover}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    minHeight: 32,
                    paddingHorizontal: 10,
                    borderRadius: theme.radius.pill,
                    borderWidth: 1,
                    backgroundColor: popoverVisible ? theme.colors.brandSoft : theme.colors.surfaceRaised,
                    borderColor: popoverVisible ? theme.colors.pillBrandBorder : theme.colors.border,
                    opacity: pressed ? 0.8 : 1,
                  })}>
                  <Ionicons name={popoverVisible ? 'swap-vertical' : 'swap-vertical-outline'} size={13} color={popoverVisible ? theme.colors.brand : theme.colors.inkMuted} />
                  <Text style={{
                    fontFamily: theme.fontFamily.labelSemi,
                    fontSize: 12,
                    fontWeight: '600',
                    color: popoverVisible ? theme.colors.brand : theme.colors.inkMuted,
                  }} numberOfLines={1}>
                    {sortLabel(sort)}
                  </Text>
                </Pressable>
              </View>
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

      {/* ── Sort popover (Zomato-style floating card) ── */}
      <Modal
        visible={popoverVisible}
        transparent
        animationType="none"
        onRequestClose={closePopover}
      >
        <Pressable style={{ flex: 1 }} onPress={closePopover}>
          <Animated.View
            style={{
              position: 'absolute',
              top: popoverPos.top,
              right: popoverPos.right,
              width: 220,
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: theme.colors.border,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.28,
              shadowRadius: 24,
              elevation: 16,
              opacity: popoverAnim,
              transform: [{
                scale: popoverAnim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }),
              }, {
                translateY: popoverAnim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }),
              }],
            }}
          >
            {/* Title */}
            <View style={{ paddingHorizontal: theme.spacing[5], paddingTop: theme.spacing[5], paddingBottom: 16 }}>
              <Text style={{
                fontFamily: theme.fontFamily.headline,
                fontSize: 18,
                fontWeight: '700',
                color: theme.colors.ink,
                textAlign: 'center',
              }}>
                Sort by
              </Text>
            </View>

            {/* Options */}
            {SORT_OPTIONS.map((option, idx) => {
              const active = sort === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => { setSort(option); closePopover(); }}
                  style={({ pressed }) => ({
                    backgroundColor: pressed ? theme.colors.surfaceHigh : theme.colors.transparent,
                  })}>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                    paddingHorizontal: theme.spacing[5],
                    paddingVertical: 14,
                    borderTopWidth: idx > 0 ? 1 : 0,
                    borderTopColor: theme.colors.border,
                  }}>
                    <Ionicons
                      name={active ? 'radio-button-on' : 'radio-button-off'}
                      size={22}
                      color={active ? theme.colors.brand : theme.colors.inkMuted}
                    />
                    <Text style={{
                      fontFamily: active ? theme.fontFamily.labelSemi : theme.fontFamily.label,
                      fontSize: 15,
                      fontWeight: active ? '600' : '400',
                      color: active ? theme.colors.brand : theme.colors.ink,
                      flex: 1,
                    }}>
                      {sortLabel(option)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            <View style={{ height: 12 }} />
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}
