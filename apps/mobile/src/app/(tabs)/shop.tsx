import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
import { TrustBadge } from '@/components/trust-badge';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
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
          <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 16 }}>
            <View style={{ gap: 4, marginTop: 8 }}>
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

            {/* ── Search bar + sort button ── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                height: 52,
                borderRadius: 9999,
                backgroundColor: searchFocused ? theme.colors.surface : theme.colors.surfaceHigh,
                borderWidth: searchFocused ? 2 : 0,
                borderColor: searchFocused ? theme.colors.brand : 'transparent',
                shadowColor: theme.colors.brand,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: searchFocused ? 0.12 : 0,
                shadowRadius: 12,
              }}>
                <Ionicons
                  color={searchFocused ? theme.colors.brand : theme.colors.inkMuted}
                  name="search-outline"
                  size={18}
                  style={{ marginLeft: 16 }}
                />
                <TextInput
                  cursorColor={theme.colors.brand}
                  onBlur={() => { setSearchFocused(false); }}
                  onChangeText={setQuery}
                  onFocus={() => { setSearchFocused(true); }}
                  placeholder="Search brand or category"
                  placeholderTextColor={theme.colors.inkMuted}
                  style={{
                    flex: 1, height: '100%', paddingHorizontal: 10,
                    fontSize: 15, fontFamily: theme.fontFamily.body,
                    color: theme.colors.ink, letterSpacing: 0,
                  }}
                  value={query}
                />
              </View>

              {/* Sort button */}
              <View ref={sortBtnRef} collapsable={false}>
                <Pressable
                  onPress={popoverVisible ? closePopover : openPopover}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    height: 52,
                    paddingHorizontal: 14,
                    borderRadius: 9999,
                    backgroundColor: popoverVisible ? theme.colors.brandSoft : theme.colors.surfaceHigh,
                    borderWidth: 1,
                    borderColor: popoverVisible ? theme.colors.brand : 'transparent',
                    opacity: pressed ? 0.8 : 1,
                  })}>
                  <Ionicons
                    name="swap-vertical-outline"
                    size={15}
                    color={popoverVisible ? theme.colors.brand : theme.colors.inkMuted}
                  />
                  <Text style={{
                    fontFamily: theme.fontFamily.labelSemi,
                    fontSize: 13,
                    fontWeight: '600',
                    color: popoverVisible ? theme.colors.brand : theme.colors.ink,
                  }}>
                    {sortLabel(sort)}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* ── Category chips ── */}
          {categories.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, flexDirection: 'row' }}>
              {categories.map((cat) => {
                const active = cat === 'All' ? !category : category === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => { setCategory(cat === 'All' ? undefined : cat); }}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      borderRadius: 9999,
                      backgroundColor: active ? theme.colors.surfaceHighest : theme.colors.surfaceHigh,
                      borderWidth: active ? 1 : 0,
                      borderColor: active ? theme.colors.border : 'transparent',
                    }}>
                    <Text style={{
                      fontFamily: theme.fontFamily.label,
                      fontSize: 13,
                      color: active ? theme.colors.ink : theme.colors.inkMuted,
                    }}>
                      {cat}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {/* ── Listings ── */}
          <View style={{ paddingHorizontal: 20, gap: 20, marginTop: 20 }}>
            {listingsResource.loading && !listingsResource.data ? (
              <ActivityIndicator color={theme.colors.brand} />
            ) : null}

            {listingsResource.error ? (
              <Text style={{ fontFamily: theme.fontFamily.label, fontSize: 14, color: theme.colors.danger }}>
                {listingsResource.error}
              </Text>
            ) : null}

            {listingsResource.data?.map((listing) => (
              <Pressable
                key={listing.id}
                onPress={() => { router.push(`/listings/${listing.id}`); }}
                style={({ pressed }) => ({
                  backgroundColor: theme.colors.surface,
                  borderRadius: 24,
                  overflow: 'hidden',
                  shadowColor: theme.colors.shadowStrong,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 1,
                  shadowRadius: 40,
                  elevation: 2,
                  opacity: pressed ? 0.92 : 1,
                })}>
                <View style={{ position: 'absolute', left: 0, top: 24, bottom: 24, width: 6, backgroundColor: theme.colors.brand, borderTopRightRadius: 6, borderBottomRightRadius: 6 }} />
                <View style={{ padding: 20 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: theme.colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: theme.fontFamily.headlineExtra, fontSize: 18, color: theme.colors.brand }}>
                        {listing.brand.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.brandSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 }}>
                      <Ionicons name="checkmark-circle" size={12} color={theme.colors.brand} />
                      <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 10, fontWeight: '700', color: theme.colors.brand, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                        Verified
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontFamily: theme.fontFamily.headline, fontSize: 20, fontWeight: '700', color: theme.colors.ink, marginBottom: 4 }}>
                    {listing.brand.name}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
                    <Text style={{ fontFamily: theme.fontFamily.mono, fontSize: 24, fontWeight: '700', color: theme.colors.ink }}>
                      {formatCurrency(listing.sellingPrice)}
                    </Text>
                    <Text style={{ fontFamily: theme.fontFamily.mono, fontSize: 13, color: theme.colors.inkMuted, textDecorationLine: 'line-through' }}>
                      {formatCurrency(listing.faceValue)}
                    </Text>
                    <View style={{ backgroundColor: theme.colors.successSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 }}>
                      <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 11, fontWeight: '700', color: theme.colors.success }}>
                        {String(Math.round(listing.discountPercent))}% off
                      </Text>
                    </View>
                  </View>
                  <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.border, borderStyle: 'dashed', marginBottom: 12 }} />
                  <View style={{ gap: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 12, color: theme.colors.inkMuted }}>Expiry</Text>
                      <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 12, fontWeight: '600', color: theme.colors.ink }}>{formatDate(listing.expiryDate)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 12, color: theme.colors.inkMuted }}>Seller</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 12, fontWeight: '600', color: theme.colors.ink }}>{listing.seller.name}</Text>
                        {listing.seller.trustTier ? <TrustBadge tier={listing.seller.trustTier} /> : null}
                      </View>
                    </View>
                  </View>
                </View>
              </Pressable>
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
              borderRadius: 20,
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
            <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 }}>
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
                    backgroundColor: pressed ? theme.colors.surfaceHigh : 'transparent',
                  })}>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                    paddingHorizontal: 20,
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
