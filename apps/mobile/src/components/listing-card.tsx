import { Ionicons } from '@expo/vector-icons';
import { Image, Text, View } from 'react-native';
import { InteractivePressable } from '@/components/interactive-pressable';
import type { Listing } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { useTheme } from '@/theme/theme-context';
import React from 'react';

type Props = {
  readonly listing: Listing;
  readonly onPress: () => void;
};

export function ListingCard({ listing, onPress }: Props) {
  const theme = useTheme();

  const expiryDate = new Date(listing.expiryDate).getTime();
  const createdAt = new Date(listing.createdAt).getTime();
  const now = Date.now();

  const isNew = now - createdAt < 2 * 60 * 60 * 1000;
  const daysToExpiry = Math.ceil((expiryDate - now) / (24 * 60 * 60 * 1000));
  const isExpiringSoon = daysToExpiry <= 7;
  const isCritical = daysToExpiry <= 2;

  return (
    <InteractivePressable
      onPress={onPress}
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
      {/* Left accent bar */}
      <View style={{
        position: 'absolute',
        left: 0,
        top: theme.spacing[4],
        bottom: theme.spacing[4],
        width: 4,
        backgroundColor: isCritical ? theme.colors.danger : theme.colors.brand,
        borderTopRightRadius: 4,
        borderBottomRightRadius: 4,
      }} />

      <View style={{ paddingVertical: theme.spacing[4], paddingLeft: theme.spacing[5], paddingRight: theme.spacing[4], flexDirection: 'row', gap: theme.spacing[3], alignItems: 'center' }}>
        {/* Brand logo */}
        <View style={{
          width: 40,
          height: 40,
          borderRadius: theme.radius.sm,
          backgroundColor: theme.colors.surfaceRaised,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          {listing.brand.logoUrl ? (
            <Image source={{ uri: listing.brand.logoUrl }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          ) : (
            <Text style={{ fontFamily: theme.fontFamily.headlineExtra, fontSize: 16, color: theme.colors.brand }}>
              {listing.brand.name.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>

        {/* Main info */}
        <View style={{ flex: 1, gap: theme.spacing[1] }}>
          {/* Brand + Verified + New */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}>
            <Text style={{ fontFamily: theme.fontFamily.headline, fontSize: 16, color: theme.colors.ink, flex: 1 }} numberOfLines={1}>
              {listing.brand.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[1], backgroundColor: theme.colors.brandSoft, paddingHorizontal: theme.spacing[2], paddingVertical: 2, borderRadius: theme.radius.pill }}>
              <Ionicons name="checkmark-circle" size={10} color={theme.colors.brand} />
              <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 9, color: theme.colors.brand, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Verified
              </Text>
            </View>
            {isNew && (
              <View style={{ backgroundColor: theme.colors.successSoft, paddingHorizontal: theme.spacing[2], paddingVertical: 2, borderRadius: theme.radius.pill }}>
                <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 9, color: theme.colors.success, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  New
                </Text>
              </View>
            )}
          </View>

          {/* Price row */}
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing[2] }}>
            <Text style={{ fontFamily: theme.fontFamily.mono, fontSize: 18, fontWeight: '700', color: theme.colors.ink }}>
              {formatCurrency(listing.sellingPrice)}
            </Text>
            <Text style={{ fontFamily: theme.fontFamily.mono, fontSize: 12, color: theme.colors.inkMuted, textDecorationLine: 'line-through' }}>
              {formatCurrency(listing.faceValue)}
            </Text>
            <View style={{ backgroundColor: theme.colors.successSoft, paddingHorizontal: theme.spacing[2], paddingVertical: 2, borderRadius: theme.radius.pill }}>
              <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 11, fontWeight: '700', color: theme.colors.success }}>
                {String(Math.round(listing.discountPercent))}% off
              </Text>
            </View>
          </View>

          {/* Expiry row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}>
            {isExpiringSoon ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: theme.colors.dangerSoft, paddingHorizontal: theme.spacing[2], paddingVertical: 2, borderRadius: theme.radius.pill }}>
                <Ionicons name="time" size={10} color={theme.colors.danger} />
                <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 10, color: theme.colors.danger }}>
                  {daysToExpiry <= 0 ? 'Expires today' : `${String(daysToExpiry)}d left`}
                </Text>
              </View>
            ) : (
              <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 11, color: theme.colors.inkMuted }}>
                Expires {formatDate(listing.expiryDate)}
              </Text>
            )}
          </View>
        </View>
      </View>
    </InteractivePressable>
  );
}
