import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { TrustBadge } from '@/components/trust-badge';
import type { Listing } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { useTheme } from '@/theme/ThemeContext';

type Props = {
  listing: Listing;
  onPress: () => void;
};

export function ListingCard({ listing, onPress }: Props) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.lg,
        overflow: 'hidden',
        shadowColor: theme.colors.shadowStrong,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 40,
        elevation: 2,
        opacity: pressed ? 0.92 : 1,
      })}>
      <View style={{ position: 'absolute', left: 0, top: 24, bottom: 24, width: 6, backgroundColor: theme.colors.brand, borderTopRightRadius: 6, borderBottomRightRadius: 6 }} />
      <View style={{ padding: theme.spacing[5] }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: theme.colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: theme.fontFamily.headlineExtra, fontSize: 18, color: theme.colors.brand }}>
              {listing.brand.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[1], backgroundColor: theme.colors.brandSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.pill }}>
            <Ionicons name="checkmark-circle" size={12} color={theme.colors.brand} />
            <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 10, fontWeight: '700', color: theme.colors.brand, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Verified
            </Text>
          </View>
        </View>
        <Text style={{ fontFamily: theme.fontFamily.headline, fontSize: 20, fontWeight: '700', color: theme.colors.ink, marginBottom: 4 }}>
          {listing.brand.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing[2], marginBottom: theme.spacing[4] }}>
          <Text style={{ fontFamily: theme.fontFamily.mono, fontSize: 24, fontWeight: '700', color: theme.colors.ink }}>
            {formatCurrency(listing.sellingPrice)}
          </Text>
          <Text style={{ fontFamily: theme.fontFamily.mono, fontSize: 13, color: theme.colors.inkMuted, textDecorationLine: 'line-through' }}>
            {formatCurrency(listing.faceValue)}
          </Text>
          <View style={{ backgroundColor: theme.colors.successSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.radius.pill }}>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[1] }}>
              <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 12, fontWeight: '600', color: theme.colors.ink }}>{listing.seller.name}</Text>
              {listing.seller.trustTier ? <TrustBadge tier={listing.seller.trustTier} /> : null}
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
