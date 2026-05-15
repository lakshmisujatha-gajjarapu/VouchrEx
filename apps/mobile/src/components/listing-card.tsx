import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { InteractivePressable } from '@/components/interactive-pressable';
import { TrustBadge } from '@/components/trust-badge';
import type { Listing } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { useTheme } from '@/theme/theme-context';

type Props = {
  readonly listing: Listing;
  readonly onPress: () => void;
};

export function ListingCard({ listing, onPress }: Props) {
  const theme = useTheme();

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
      <View style={{ 
        position: 'absolute', 
        left: 0, 
        top: theme.spacing[6], 
        bottom: theme.spacing[6], 
        width: 6, 
        backgroundColor: theme.colors.brand, 
        borderTopRightRadius: 6, 
        borderBottomRightRadius: 6 
      }} />
      <View style={{ padding: theme.spacing[5] }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing[3] }}>
          <View style={{ 
            width: 48, 
            height: 48, 
            borderRadius: theme.radius.sm, 
            backgroundColor: theme.colors.surfaceRaised, 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}>
            <Text style={{ fontFamily: theme.fontFamily.headlineExtra, fontSize: 18, color: theme.colors.brand }}>
              {listing.brand.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            gap: theme.spacing[1], 
            backgroundColor: theme.colors.brandSoft, 
            paddingHorizontal: theme.spacing[2], 
            paddingVertical: theme.spacing[1], 
            borderRadius: theme.radius.pill 
          }}>
            <Ionicons name="checkmark-circle" size={12} color={theme.colors.brand} />
            <Text style={{ 
              fontFamily: theme.fontFamily.labelSemi, 
              fontSize: 10, 
              fontWeight: '700', 
              color: theme.colors.brand, 
              textTransform: 'uppercase', 
              letterSpacing: 0.6 
            }}>
              Verified
            </Text>
          </View>
        </View>
        <Text style={{ 
          fontFamily: theme.fontFamily.headline, 
          fontSize: 20, 
          fontWeight: '700', 
          color: theme.colors.ink, 
          marginBottom: theme.spacing[1] 
        }}>
          {listing.brand.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing[2], marginBottom: theme.spacing[4] }}>
          <Text style={{ fontFamily: theme.fontFamily.mono, fontSize: 24, fontWeight: '700', color: theme.colors.ink }}>
            {formatCurrency(listing.sellingPrice)}
          </Text>
          <Text style={{ fontFamily: theme.fontFamily.mono, fontSize: 13, color: theme.colors.inkMuted, textDecorationLine: 'line-through' }}>
            {formatCurrency(listing.faceValue)}
          </Text>
          <View style={{ backgroundColor: theme.colors.successSoft, paddingHorizontal: theme.spacing[2], paddingVertical: 2, borderRadius: theme.radius.pill }}>
            <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 11, fontWeight: '700', color: theme.colors.success }}>
              {String(Math.round(listing.discountPercent))}% off
            </Text>
          </View>
        </View>
        <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.border, borderStyle: 'dashed', marginBottom: theme.spacing[2] }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[1], backgroundColor: theme.colors.successSoft, paddingHorizontal: theme.spacing[2], paddingVertical: theme.spacing[1], borderRadius: theme.radius.pill, alignSelf: 'flex-start', marginBottom: theme.spacing[2] }}>
          <Ionicons name="lock-closed" size={11} color={theme.colors.success} />
          <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 10, fontWeight: '700', color: theme.colors.success, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            100% Escrow Protected
          </Text>
        </View>
        <View style={{ gap: theme.spacing[1] }}>
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
    </InteractivePressable>
  );
}
