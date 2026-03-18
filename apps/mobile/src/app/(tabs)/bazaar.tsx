import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';

import { FilterChip } from '@/components/filter-chip';
import { ScreenShell } from '@/components/screen-shell';
import { TrustBadge } from '@/components/trust-badge';
import { SectionPanel } from '@/components/section-panel';
import { StatusPill } from '@/components/status-pill';
import { TicketCard } from '@/components/ticket-card';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { useTheme } from '@/theme/ThemeContext';

const sortOptions = ['latest', 'best-discount', 'expiring', 'price-low'] as const;

function formatSortLabel(option: (typeof sortOptions)[number]) {
  if (option === 'price-low') {
    return 'price';
  }

  return option.replace('-', ' ');
}

export default function BazaarScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [sort, setSort] = useState<(typeof sortOptions)[number]>('best-discount');
  const [category, setCategory] = useState<string | undefined>();
  const deferredQuery = useDeferredValue(query.trim());

  const brandsResource = useAsyncResource(useCallback(() => api.listBrands(), []), { enabled: true });

  const listingsResource = useAsyncResource(
    useCallback(
      () =>
        api.listListings({
          ...(deferredQuery ? { q: deferredQuery } : {}),
          ...(category ? { category } : {}),
          sort,
        }),
      [category, deferredQuery, sort],
    ),
    { enabled: true },
  );

  const categories = useMemo(() => {
    const rawCategories = brandsResource.data?.map((brand) => brand.category) ?? [];
    return ['All', ...Array.from(new Set(rawCategories))];
  }, [brandsResource.data]);

  const summary = useMemo(() => {
    const listings = listingsResource.data ?? [];
    const avgDiscount =
      listings.length > 0
        ? Math.round(listings.reduce((total, listing) => total + listing.discountPercent, 0) / listings.length)
        : 0;

    return {
      count: listings.length,
      avgDiscount,
    };
  }, [listingsResource.data]);

  return (
    <ScreenShell eyebrow="Buy" subtitle="Search, reserve, and pay with full protection." title="Bazaar">
      {summary.count > 0 ? (
        <View className="flex-row gap-2">
          <StatusPill label={`${String(summary.count)} live`} tone="brand" />
          <StatusPill label={`avg ${String(summary.avgDiscount)}% off`} tone="success" />
        </View>
      ) : null}

      <View
        className="flex-row items-center rounded-app-lg border"
        style={{
          backgroundColor: theme.colors.surfaceTray,
          borderColor: searchFocused ? theme.colors.borderStrong : theme.colors.border,
          borderWidth: searchFocused ? 1.5 : 1,
        }}>
        <Ionicons
          color={searchFocused ? theme.colors.brand : theme.colors.inkMuted}
          name="search-outline"
          size={18}
          style={{ marginLeft: 14 }}
        />
        <TextInput
          cursorColor={theme.colors.brand}
          onBlur={() => { setSearchFocused(false); }}
          onChangeText={setQuery}
          onFocus={() => { setSearchFocused(true); }}
          placeholder="Brand or category"
          placeholderTextColor={theme.colors.inkMuted}
          className="min-h-[54px] flex-1 px-3"
          style={{ color: theme.colors.ink, fontSize: 15, letterSpacing: 0 }}
          value={query}
        />
      </View>

      <SectionPanel>
        <View className="flex-row flex-wrap gap-2">
          {sortOptions.map((option) => (
            <FilterChip
              key={option}
              label={formatSortLabel(option)}
              onPress={() => { setSort(option); }}
              selected={sort === option}
            />
          ))}
        </View>
        {categories.length > 1 ? (
          <View className="flex-row flex-wrap gap-2">
            {categories.map((value) => (
              <FilterChip
                key={value}
                label={value}
                onPress={() => { setCategory(value === 'All' ? undefined : value); }}
                selected={value === 'All' ? !category : category === value}
              />
            ))}
          </View>
        ) : null}
      </SectionPanel>

      {listingsResource.loading && !listingsResource.data ? (
        <ActivityIndicator color={theme.colors.action} />
      ) : null}

      {listingsResource.error ? (
        <Text
          className="text-body font-semibold"
          style={{ color: theme.colors.danger }}>
          {listingsResource.error}
        </Text>
      ) : null}

      {listingsResource.data?.map((listing) => (
        <TicketCard
          key={listing.id}
          eyebrow={listing.brand.category}
          meta={`Expires ${formatDate(listing.expiryDate)}`}
          onPress={() => {
            router.push(`/listings/${listing.id}`);
          }}
          subtitle={`${formatCurrency(listing.sellingPrice)} • ${listing.voucherType}`}
          title={listing.brand.name}
          tone="brand">
          <View className="mt-2 flex-row flex-wrap items-center gap-2">
            <StatusPill label={`${String(Math.round(listing.discountPercent))}% off`} tone="success" />
            <StatusPill label={listing.seller.name} tone="neutral" />
            {listing.seller.trustTier ? <TrustBadge tier={listing.seller.trustTier} /> : null}
          </View>
          <Text
            className="mt-2 text-body"
            style={{ color: theme.colors.inkMuted }}>
            {formatCurrency(listing.faceValue)} face value
          </Text>
        </TicketCard>
      ))}

      {!listingsResource.loading && listingsResource.data?.length === 0 ? (
        <TicketCard
          subtitle="Try another brand, category, or sort order."
          title="No matches"
        />
      ) : null}
    </ScreenShell>
  );
}
