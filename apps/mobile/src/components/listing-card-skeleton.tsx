import React from 'react';
import { View } from 'react-native';
import { Shimmer } from '@/components/shimmer';
import { useTheme } from '@/theme/theme-context';

export function ListingCardSkeleton() {
  const theme = useTheme();

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.lg,
        overflow: 'hidden',
        shadowColor: theme.colors.shadowStrong,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 40,
        elevation: 2,
      }}>
      <View style={{ position: 'absolute', left: 0, top: 24, bottom: 24, width: 6, backgroundColor: theme.colors.surfaceHigh, borderTopRightRadius: 6, borderBottomRightRadius: 6 }} />
      <View style={{ padding: theme.spacing[5] }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing[3] }}>
          {/* Brand Avatar */}
          <Shimmer width={48} height={48} borderRadius={14} />
          {/* Verified Badge */}
          <Shimmer width={70} height={22} borderRadius={theme.radius.pill} />
        </View>

        {/* Brand Name */}
        <Shimmer width="60%" height={24} borderRadius={4} style={{ marginBottom: theme.spacing[2] }} />

        {/* Price Row */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing[2], marginBottom: theme.spacing[4] }}>
          <Shimmer width={80} height={28} borderRadius={4} />
          <Shimmer width={50} height={18} borderRadius={4} />
          <Shimmer width={60} height={18} borderRadius={theme.radius.pill} />
        </View>

        {/* Divider */}
        <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.borderHair, borderStyle: 'solid', marginBottom: theme.spacing[3] }} />

        {/* Details */}
        <View style={{ gap: theme.spacing[2] }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Shimmer width={50} height={14} borderRadius={2} />
            <Shimmer width={90} height={14} borderRadius={2} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Shimmer width={40} height={14} borderRadius={2} />
            <Shimmer width={110} height={14} borderRadius={2} />
          </View>
        </View>
      </View>
    </View>
  );
}
