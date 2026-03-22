import { BlurView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';

import { useAuth } from '@/hooks/use-auth';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { useTheme } from '@/theme/ThemeContext';

export default function ListingDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const { id } = useLocalSearchParams<{ readonly id?: string | string[] }>();
  const listingId = useMemo(() => (Array.isArray(id) ? id[0] : id), [id]);
  const { sessionToken, user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listingResource = useAsyncResource(
    useCallback(() => {
      if (!listingId) throw new Error('Listing ID is missing.');
      return api.getListing(listingId);
    }, [listingId]),
    { enabled: Boolean(listingId) },
  );

  async function handleBuyNow() {
    if (!sessionToken || !listingId) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.createOrder(sessionToken, listingId);
      router.push({
        pathname: '/orders/[id]',
        params: {
          id: result.order.id,
          checkoutPaymentLinkUrl: result.checkout.paymentLinkUrl,
          checkoutPaymentLinkId: result.checkout.paymentLinkId,
        },
      });
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'Could not reserve listing.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading ──
  if (listingResource.loading && !listingResource.data) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} edges={['top', 'left', 'right']}>
          <ActivityIndicator color={theme.colors.brand} size="large" />
        </SafeAreaView>
      </View>
    );
  }

  if (!listingResource.data) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
          <Pressable onPress={() => { router.back(); }} style={{ padding: 20 }}>
            <Ionicons name="close" size={24} color={theme.colors.ink} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 15, color: theme.colors.danger, textAlign: 'center' }}>
              {listingResource.error ?? 'Listing not found.'}
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const listing = listingResource.data;
  const isOwnListing = listing.seller.id === user?.id;
  const savings = Math.round(listing.discountPercent);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>

        {/* ── Top App Bar ── */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 14,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Pressable
              onPress={() => { router.back(); }}
              style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={24} color={theme.colors.ink} />
            </Pressable>
            <Text style={{
              fontFamily: theme.fontFamily.label,
              fontSize: 12,
              fontWeight: '600',
              letterSpacing: 1,
              textTransform: 'uppercase',
              color: theme.colors.inkSecondary,
            }}>
              VOUCHER DETAIL
            </Text>
          </View>
          <Text style={{
            fontFamily: theme.fontFamily.headline,
            fontSize: 20,
            fontWeight: '700',
            letterSpacing: -0.3,
            color: theme.colors.ink,
          }}>
            CouponBazaar
          </Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={{ paddingHorizontal: 20 }}>

            {/* ── Hero ── */}
            <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'flex-end', gap: 16, marginBottom: 40 }}>
              {/* Brand avatar */}
              <View style={{
                width: 80, height: 80, borderRadius: 20,
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: `${theme.colors.border}30`,
                alignItems: 'center', justifyContent: 'center',
                shadowColor: theme.colors.shadow,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 1,
                shadowRadius: 8,
              }}>
                <Text style={{ fontFamily: theme.fontFamily.headlineExtra, fontSize: 32, color: theme.colors.brand }}>
                  {listing.brand.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontFamily: theme.fontFamily.headlineExtra,
                  fontSize: 40,
                  fontWeight: '800',
                  letterSpacing: -1.2,
                  color: theme.colors.ink,
                  lineHeight: 44,
                }}>
                  {listing.brand.name}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <Text style={{ fontFamily: theme.fontFamily.mono, fontSize: 22, fontWeight: '600', color: theme.colors.brand }}>
                    {formatCurrency(listing.faceValue)}
                  </Text>
                  <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 12, color: theme.colors.inkMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    FACE VALUE
                  </Text>
                </View>
              </View>
            </View>

            {/* ── Main Ticket Card ── */}
            <View style={{
              borderRadius: 24,
              overflow: 'hidden',
              backgroundColor: theme.colors.surface,
              shadowColor: theme.colors.shadowStrong,
              shadowOffset: { width: 0, height: 20 },
              shadowOpacity: 1,
              shadowRadius: 50,
              elevation: 4,
              marginBottom: 32,
            }}>
              {/* Accent stripe */}
              <View style={{ flexDirection: 'row' }}>
                <View style={{ width: 8, backgroundColor: theme.colors.brand }} />
                <View style={{ flex: 1, padding: 24 }}>

                  {/* Status badges */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
                    <View style={{
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999,
                      backgroundColor: '#FFDBC8',
                    }}>
                      <Ionicons name="shield-checkmark" size={13} color="#552400" />
                      <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 10, fontWeight: '700', color: '#552400', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                        TRUSTED SELLER
                      </Text>
                    </View>
                    <View style={{
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999,
                      backgroundColor: theme.colors.brandSoft,
                    }}>
                      <Ionicons name="checkmark-circle" size={13} color={theme.colors.brand} />
                      <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 10, fontWeight: '700', color: theme.colors.brand, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                        VERIFIED VOUCHER
                      </Text>
                    </View>
                  </View>

                  {/* 2-col bento grid */}
                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                    <View style={{ flex: 1, padding: 16, borderRadius: 16, backgroundColor: theme.colors.surfaceRaised }}>
                      <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 10, fontWeight: '700', color: theme.colors.inkMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                        Price
                      </Text>
                      <Text style={{ fontFamily: theme.fontFamily.mono, fontSize: 22, color: theme.colors.ink }}>
                        {formatCurrency(listing.sellingPrice)}
                      </Text>
                      <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 12, fontWeight: '600', color: theme.colors.brand, marginTop: 4 }}>
                        {String(savings)}% SAVINGS
                      </Text>
                    </View>
                    <View style={{ flex: 1, padding: 16, borderRadius: 16, backgroundColor: theme.colors.surfaceRaised }}>
                      <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 10, fontWeight: '700', color: theme.colors.inkMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                        Expires
                      </Text>
                      <Text style={{ fontFamily: theme.fontFamily.headline, fontSize: 20, fontWeight: '700', color: theme.colors.ink }}>
                        {formatDate(listing.expiryDate)}
                      </Text>
                      <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 12, color: theme.colors.inkMuted, marginTop: 4 }}>
                        {listing.voucherType}
                      </Text>
                    </View>
                  </View>

                  {/* Description */}
                  <View style={{ gap: 16 }}>
                    <View>
                      <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 11, fontWeight: '700', color: theme.colors.inkMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                        Voucher Description
                      </Text>
                      <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 15, color: theme.colors.ink, lineHeight: 22 }}>
                        Valid for {listing.brand.category} purchases. Cannot be partially redeemed. The code will be released upon payment confirmation.
                      </Text>
                    </View>
                    <View style={{ paddingTop: 16, borderTopWidth: 1, borderTopColor: `${theme.colors.border}30`, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                      <Ionicons name="information-circle-outline" size={20} color={theme.colors.brand} />
                      <Text style={{ flex: 1, fontFamily: theme.fontFamily.body, fontSize: 13, color: theme.colors.inkSecondary, lineHeight: 18 }}>
                        Once purchased, this voucher will be added to your Orders tab. Digital codes are non-refundable.
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* ── Seller snapshot ── */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 8,
              marginBottom: 32,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{
                  width: 40, height: 40, borderRadius: 20,
                  backgroundColor: theme.colors.brandSoft,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="person-outline" size={18} color={theme.colors.brand} />
                </View>
                <View>
                  <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 13, fontWeight: '700', color: theme.colors.ink }}>
                    {listing.seller.name}
                  </Text>
                  <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 11, color: theme.colors.inkMuted }}>
                    Verified seller
                  </Text>
                </View>
              </View>
            </View>

          </View>
        </ScrollView>

        {/* ── Glassmorphic sticky footer ── */}
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: Math.max(insets.bottom, 24),
          overflow: 'hidden',
        }}>
          {/* Blur background */}
          <BlurView
            intensity={60}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
            tint={colorScheme === 'dark' ? 'dark' : 'light'}
          />
          <View style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
            backgroundColor: colorScheme === 'dark' ? 'rgba(13,11,30,0.75)' : 'rgba(250,248,255,0.85)',
            borderTopWidth: 1,
            borderTopColor: colorScheme === 'dark' ? theme.colors.surfaceHighest : `${theme.colors.border}30`,
          }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 10, fontWeight: '700', color: theme.colors.inkMuted, textTransform: 'uppercase', letterSpacing: 1 }}>
                Final Price
              </Text>
              <Text style={{ fontFamily: theme.fontFamily.mono, fontSize: 24, fontWeight: '700', color: theme.colors.ink }}>
                {formatCurrency(listing.sellingPrice)}
              </Text>
            </View>
            {error ? (
              <Text style={{ position: 'absolute', top: -20, left: 0, right: 0, textAlign: 'center', fontSize: 12, color: theme.colors.danger, fontFamily: theme.fontFamily.labelSemi }}>
                {error}
              </Text>
            ) : null}
            <Pressable
              disabled={isOwnListing || submitting}
              onPress={() => { void handleBuyNow(); }}
              style={({ pressed }) => ({
                flex: 1,
                opacity: isOwnListing ? 0.5 : pressed ? 0.88 : 1,
                transform: [{ scale: pressed && !isOwnListing && !submitting ? 0.982 : 1 }],
                borderRadius: 16,
                overflow: 'hidden',
                shadowColor: theme.colors.brand,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: isOwnListing ? 0 : 0.22,
                shadowRadius: 14,
                elevation: isOwnListing ? 0 : 4,
              })}>
              <View style={{
                height: 56,
                borderRadius: 16,
                backgroundColor: isOwnListing ? theme.colors.surfaceHigh : theme.colors.brand,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}>
                {submitting
                  ? <ActivityIndicator color={theme.colors.surface} />
                  : (
                      <>
                        <Text style={{
                          color: isOwnListing ? theme.colors.inkMuted : theme.colors.surface,
                          fontSize: 16,
                          fontWeight: '700',
                          fontFamily: theme.fontFamily.labelSemi,
                        }}>
                          {isOwnListing ? 'Your listing' : `Buy for ${formatCurrency(listing.sellingPrice)}`}
                        </Text>
                        {!isOwnListing ? <Ionicons name="arrow-forward" size={18} color={theme.colors.surface} /> : null}
                      </>
                    )}
              </View>
            </Pressable>
          </View>
        </View>

      </SafeAreaView>
    </View>
  );
}
