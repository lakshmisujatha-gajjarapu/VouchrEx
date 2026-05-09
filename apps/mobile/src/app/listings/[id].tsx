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

import { PrimaryButton } from '@/components/primary-button';
import { useAuth } from '@/hooks/use-auth';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { useListingsSocket } from '@/hooks/use-listings-socket';
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

  const handleListingUpdated = useCallback((payload: { listingId: string }) => {
    if (payload.listingId === listingId) {
      void listingResource.reload();
    }
  }, [listingId, listingResource]);
  useListingsSocket({ onUpdated: handleListingUpdated });

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
          checkoutRazorpayOrderId: result.checkout.razorpayOrderId,
          checkoutAmountPaise: String(result.checkout.amountPaise),
          checkoutCurrency: result.checkout.currency,
          checkoutKeyId: result.checkout.keyId,
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
          <Pressable onPress={() => { router.back(); }} style={{ padding: theme.spacing[5] }}>
            <Ionicons name="close" size={24} color={theme.colors.ink} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing[5] }}>
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
          paddingHorizontal: theme.spacing[5],
          paddingVertical: 14,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[4] }}>
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
            VouchrEx
          </Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={{ paddingHorizontal: 20 }}>

            {/* ── Hero ── */}
            <View style={{ marginTop: theme.spacing[4], flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing[4], marginBottom: 40 }}>
              {/* Brand avatar — white bg per spec (brand logo area) */}
              <View style={{
                width: 80, height: 80, borderRadius: 20,
                backgroundColor: theme.colors.white,
                borderWidth: 1,
                borderColor: `${theme.colors.border}20`,
                alignItems: 'center', justifyContent: 'center',
                shadowColor: theme.colors.shadowStrong,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.10,
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2], marginTop: theme.spacing[1] }}>
                  <Text style={{ fontFamily: theme.fontFamily.mono, fontSize: 22, fontWeight: '600', color: theme.colors.brand }}>
                    {formatCurrency(listing.faceValue)}
                  </Text>
                  <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 12, color: theme.colors.inkMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    FACE VALUE
                  </Text>
                </View>
              </View>
            </View>

            {/* ── Main Ticket Card ── bg-surface-container-lowest per spec */}
            <View style={{
              borderRadius: theme.radius.lg,
              overflow: 'hidden',
              backgroundColor: theme.colors.surface,
              shadowColor: theme.colors.shadowStrong,
              shadowOffset: { width: 0, height: 20 },
              shadowOpacity: 0.3,
              shadowRadius: 50,
              elevation: 4,
              marginBottom: theme.spacing[8],
            }}>
              {/* Accent stripe */}
              <View style={{ flexDirection: 'row' }}>
                <View style={{ width: 8, backgroundColor: theme.colors.brand }} />
                <View style={{ flex: 1, padding: 24 }}>

                  {/* Status badges */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2], marginBottom: theme.spacing[6] }}>
                    {/* TRUSTED SELLER — tertiary-container tone (dark: #783600 bg / #ffb68b text) */}
                    <View style={{
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      paddingHorizontal: theme.spacing[3], paddingVertical: 6, borderRadius: theme.radius.pill,
                      backgroundColor: theme.colors.warningSoft,
                    }}>
                      <Ionicons name="shield-checkmark" size={13} color={theme.colors.warning} />
                      <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 10, fontWeight: '700', color: theme.colors.warning, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                        TRUSTED SELLER
                      </Text>
                    </View>
                    {/* VERIFIED VOUCHER — primary-container tone (dark: #3a268a bg / #68dba9 text) */}
                    <View style={{
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      paddingHorizontal: theme.spacing[3], paddingVertical: 6, borderRadius: theme.radius.pill,
                      backgroundColor: theme.colors.brandSoft,
                    }}>
                      <Ionicons name="checkmark-circle" size={13} color={theme.colors.success} />
                      <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 10, fontWeight: '700', color: theme.colors.success, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                        VERIFIED VOUCHER
                      </Text>
                    </View>
                  </View>

                  {/* 2-col bento grid */}
                  <View style={{ flexDirection: 'row', gap: theme.spacing[3], marginBottom: theme.spacing[6] }}>
                    <View style={{ flex: 1, padding: theme.spacing[4], borderRadius: theme.radius.sm, backgroundColor: theme.colors.surfaceRaised }}>
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
                    <View style={{ flex: 1, padding: theme.spacing[4], borderRadius: theme.radius.sm, backgroundColor: theme.colors.surfaceRaised }}>
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
                  <View style={{ gap: theme.spacing[4] }}>
                    <View>
                      <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 11, fontWeight: '700', color: theme.colors.inkMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: theme.spacing[2] }}>
                        Voucher Description
                      </Text>
                      <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 15, color: theme.colors.ink, lineHeight: 22 }}>
                        Valid for {listing.brand.category} purchases. Cannot be partially redeemed. The code will be released upon payment confirmation.
                      </Text>
                    </View>
                    <View style={{ paddingTop: theme.spacing[4], borderTopWidth: 1, borderTopColor: theme.colors.borderHair, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
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
              paddingHorizontal: theme.spacing[2],
              marginBottom: theme.spacing[8],
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] }}>
                <View style={{
                  width: 40, height: 40, borderRadius: 20,
                  backgroundColor: theme.colors.surfaceHigh,
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
          paddingHorizontal: theme.spacing[5],
          paddingTop: theme.spacing[4],
          paddingBottom: Math.max(insets.bottom, theme.spacing[6]),
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
            backgroundColor: theme.colors.glassSurface,
            borderTopWidth: 1,
            borderTopColor: theme.colors.borderHair,
          }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[4] }}>
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
            <View style={{ flex: 1 }}>
              <PrimaryButton
                disabled={isOwnListing}
                icon={isOwnListing ? undefined : 'ticket-outline'}
                label={isOwnListing ? 'Your listing' : 'Buy'}
                loading={submitting}
                onPress={() => { void handleBuyNow(); }}
                tone="brand"
              />
            </View>
          </View>
        </View>

      </SafeAreaView>
    </View>
  );
}
