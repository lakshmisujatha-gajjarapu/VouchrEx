import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useDeferredValue, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { KeylineRow } from '@/components/keyline-row';
import { PrimaryButton } from '@/components/primary-button';
import { AppShell } from '@/components/app-shell';
import { StatusPill } from '@/components/status-pill';
import { TicketCard } from '@/components/ticket-card';
import { ListingCardSkeleton } from '@/components/listing-card-skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { useListingsSocket } from '@/hooks/use-listings-socket';
import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus';
import { useRefetchOnReconnect } from '@/hooks/use-refetch-on-reconnect';
import { api, type Listing } from '@/lib/api';
import { formatCurrency, formatDate, formatStatus } from '@/lib/format';
import { getCardEyebrow, getCardTone, getStatusPillTone, getExpiryUrgency } from '@/lib/status';
import { useTheme } from '@/theme/theme-context';

// ─── constants ────────────────────────────────────────────────────────────────

const editableStatuses = new Set(['ACTIVE', 'DRAFT', 'VERIFYING']);

// ─── helpers ──────────────────────────────────────────────────────────────────

type ListingTab = 'live' | 'history';

/**
 * Classify listing into the correct tab.
 *
 * Core fix: a RESERVED listing whose voucher expiry date has passed but still
 * has a non-terminal order (PAYMENT_PENDING, ESCROW_ACTIVE, CODE_REVEALED …)
 * belongs in "live". The seller needs visibility. Only after the order reaches
 * a terminal state (CONFIRMED / AUTO_CONFIRMED / CANCELLED) does expiry apply.
 */
function getListingTab(listing: Listing): ListingTab {
  const { status, order } = listing;

  const orderTerminal =
    !order || ['CONFIRMED', 'AUTO_CONFIRMED', 'CANCELLED'].includes(order.status);

  if (!orderTerminal) return 'live';

  if (['SOLD', 'REFUNDED', 'REJECTED', 'EXPIRED'].includes(status)) return 'history';

  if (new Date(listing.expiryDate).getTime() <= Date.now()) return 'history';

  return 'live';
}

function matchesSearch(listing: Listing, query: string): boolean {
  if (!query) return true;
  const hay = [listing.brand.name, listing.voucherType, listing.status].join(' ').toLowerCase();
  return hay.includes(query);
}

// ─── detail sheet ─────────────────────────────────────────────────────────────

function ListingDetailSheet({
  listing,
  onClose,
  onEdit,
  onDelete,
  onViewOrder,
  deleting,
}: {
  readonly listing: Listing;
  readonly onClose: () => void;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
  readonly onViewOrder: () => void;
  readonly deleting: boolean;
}) {
  const theme = useTheme();
  const urgency = getExpiryUrgency(listing.expiryDate);
  const hasActiveOrder = Boolean(listing.order);
  const savings = Math.round(listing.discountPercent);

  const editable = (
    editableStatuses.has(listing.status) &&
    !listing.order &&
    new Date(listing.expiryDate).getTime() > Date.now()
  );

  const deletable = editableStatuses.has(listing.status) && !listing.order;

  return (
    <View style={styles.sheetOverlay}>
      <Pressable
        accessibilityLabel="Close"
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.scrim }]}
        onPress={onClose}
      />

      <View style={[styles.sheetContainer, { backgroundColor: theme.colors.surface }]}>
        {/* Drag handle */}
        <View style={[styles.sheetHandle, { backgroundColor: theme.colors.border }]} />

        {/* Close button */}
        <Pressable
          accessibilityLabel="Close"
          accessibilityRole="button"
          onPress={onClose}
          style={({ pressed }) => [
            styles.sheetCloseBtn,
            { backgroundColor: theme.colors.surfaceTray, opacity: pressed ? 0.7 : 1 },
          ]}>
          <Ionicons color={theme.colors.inkMuted} name="close-outline" size={18} />
        </Pressable>

        <ScrollView
          contentContainerStyle={styles.sheetScroll}
          showsVerticalScrollIndicator={false}>

          {/* ── Brand header ── */}
          <View style={{ gap: 4 }}>
            <Text style={{
              fontFamily: theme.fontFamily.labelSemi,
              fontSize: 11,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              color: theme.colors.brand,
            }}>
              {listing.brand.category}
            </Text>
            <Text style={{
              fontFamily: theme.fontFamily.headlineExtra,
              fontSize: 26,
              letterSpacing: -0.5,
              color: theme.colors.ink,
            }}>
              {listing.brand.name}
            </Text>
            <Text style={{
              fontFamily: theme.fontFamily.body,
              fontSize: 14,
              color: theme.colors.inkMuted,
            }}>
              {listing.voucherType}
            </Text>
          </View>

          {/* ── Status pills ── */}
          <View style={styles.pillRow}>
            <StatusPill label={getCardEyebrow(listing)} tone={getStatusPillTone(listing)} />
            {urgency === 'warning' ? (
              <StatusPill label="10 days left" tone="warning" />
            ) : null}
            {urgency === 'danger' && !['EXPIRED', 'RESERVED', 'SOLD'].includes(listing.status) ? (
              <StatusPill label="Final 48h" tone="danger" />
            ) : null}
          </View>

          {/* ── Price bento ── */}
          <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
            {/* Selling price tile */}
            <View style={{
              flex: 1,
              backgroundColor: theme.colors.surfaceRaised,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: theme.colors.border,
              padding: theme.spacing[4],
              gap: 6,
            }}>
              <Text style={{
                fontFamily: theme.fontFamily.labelSemi,
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                color: theme.colors.inkMuted,
              }}>
                Selling Price
              </Text>
              <Text style={{
                fontFamily: theme.fontFamily.mono,
                fontSize: 26,
                color: theme.colors.ink,
                letterSpacing: -0.5,
              }}>
                {formatCurrency(listing.sellingPrice)}
              </Text>
              {/* Savings badge */}
              <View style={{
                alignSelf: 'flex-start',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: theme.colors.actionSoft,
                borderRadius: theme.radius.pill,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}>
                <Ionicons name="trending-down-outline" size={11} color={theme.colors.action} />
                <Text style={{
                  fontFamily: theme.fontFamily.labelSemi,
                  fontSize: 11,
                  color: theme.colors.action,
                }}>
                  {String(savings)}% off
                </Text>
              </View>
            </View>

            {/* Expiry tile */}
            <View style={{
              flex: 1,
              backgroundColor: theme.colors.surfaceRaised,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: urgency === 'danger'
                ? theme.colors.pillDangerBorder
                : urgency === 'warning'
                  ? theme.colors.pillWarnBorder
                  : theme.colors.border,
              padding: theme.spacing[4],
              gap: 6,
            }}>
              <Text style={{
                fontFamily: theme.fontFamily.labelSemi,
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                color: theme.colors.inkMuted,
              }}>
                Expires
              </Text>
              <Text style={{
                fontFamily: theme.fontFamily.headline,
                fontSize: 20,
                color: urgency === 'danger'
                  ? theme.colors.danger
                  : urgency === 'warning'
                    ? theme.colors.warning
                    : theme.colors.ink,
                letterSpacing: -0.3,
              }}>
                {formatDate(listing.expiryDate)}
              </Text>
              <Text style={{
                fontFamily: theme.fontFamily.body,
                fontSize: 12,
                color: theme.colors.inkMuted,
              }}>
                Face value {formatCurrency(listing.faceValue)}
              </Text>
            </View>
          </View>

          {/* ── Active order ── */}
          {hasActiveOrder && listing.order ? (
            <View style={{ gap: 10 }}>
              <Text style={{
                fontFamily: theme.fontFamily.labelSemi,
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                color: theme.colors.inkMuted,
              }}>
                Active order
              </Text>
              <View style={[styles.sheetGrid, { borderColor: theme.colors.pillBrandBorder }]}>
                <KeylineRow label="Order status" value={formatStatus(listing.order.status)} />
              </View>
              <PrimaryButton label="View order" onPress={onViewOrder} tone="secondary" />
            </View>
          ) : null}

          {/* ── Reprice Nudge ── */}
          {urgency === 'danger' && editable && (
            <View style={{
              backgroundColor: theme.colors.warningSoft,
              borderRadius: theme.radius.md,
              padding: 16,
              gap: 12,
              borderWidth: 1,
              borderColor: theme.colors.pillWarnBorder
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="trending-down" size={20} color={theme.colors.warning} />
                <Text style={{ fontFamily: theme.fontFamily.headline, fontSize: 16, color: theme.colors.ink }}>Sell it faster!</Text>
              </View>
              <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 14, color: theme.colors.inkSecondary, lineHeight: 20 }}>
                This voucher expires soon. Drop the price by 5% to attract buyers now.
              </Text>
              <Pressable 
                onPress={onEdit}
                style={{ backgroundColor: theme.colors.warning, paddingVertical: 10, borderRadius: theme.radius.pill, alignItems: 'center' }}>
                <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 14, color: '#FFFFFF' }}>Reprice Now</Text>
              </Pressable>
            </View>
          )}

          {/* ── Actions — edit (primary gradient) + compact danger delete ── */}
          {(editable || deletable) ? (
            <View style={{ flexDirection: 'row', gap: theme.spacing[3], alignItems: 'center' }}>
              {editable ? (
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    icon="create-outline"
                    label="Edit listing"
                    onPress={onEdit}
                    tone="brand"
                    variant="gradient"
                  />
                </View>
              ) : null}
              {deletable ? (
                <Pressable
                  accessibilityLabel="Delete listing"
                  accessibilityRole="button"
                  onPress={onDelete}
                  style={({ pressed }) => ({
                    width: editable ? 64 : undefined,
                    flex: editable ? undefined : 1,
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                    height: 56,
                    borderRadius: theme.radius.md,
                    borderWidth: 1.5,
                    borderColor: theme.colors.pillDangerBorder,
                    backgroundColor: pressed ? theme.colors.dangerSoft : `${theme.colors.danger}0F`,
                  })}>
                  {deleting
                    ? <ActivityIndicator size="small" color={theme.colors.danger} />
                    : (
                        <>
                          <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
                          {editable ? (
                            <Text style={{
                              fontFamily: theme.fontFamily.labelSemi,
                              fontSize: 10,
                              color: theme.colors.danger,
                              letterSpacing: 0.3,
                            }}>
                              Delete
                            </Text>
                          ) : (
                            <Text style={{
                              fontFamily: theme.fontFamily.labelSemi,
                              fontSize: 15,
                              color: theme.colors.danger,
                            }}>
                              Delete
                            </Text>
                          )}
                        </>
                      )}
                </Pressable>
              ) : null}
            </View>
          ) : null}

        </ScrollView>
      </View>
    </View>
  );
}

// ─── screen ───────────────────────────────────────────────────────────────────

export default function ListingsScreen() {
  const router = useRouter();
  const { sessionToken, user } = useAuth();
  const theme = useTheme();
  const [tab, setTab] = useState<ListingTab>('live');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deferredQuery = useDeferredValue(searchQuery.trim().toLowerCase());
  const reducedMotion = useReducedMotion();

  const listingsResource = useAsyncResource(
    useCallback(() => {
      if (!sessionToken) throw new Error('Session missing.');
      return api.listMyListings(sessionToken);
    }, [sessionToken]),
    { enabled: Boolean(sessionToken) },
  );

  const reloadListings = useCallback(() => { void listingsResource.reload(); }, [listingsResource]);
  useListingsSocket({ onCreated: reloadListings, onUpdated: reloadListings });

  useRefetchOnFocus(useCallback(() => { void listingsResource.reload(); }, [listingsResource.reload]));
  useRefetchOnReconnect(useCallback(() => { void listingsResource.reload(); }, [listingsResource.reload]));

  const visibleListings = useMemo(
    () =>
      (listingsResource.data ?? []).filter(
        (l) => getListingTab(l) === tab && matchesSearch(l, deferredQuery),
      ),
    [listingsResource.data, tab, deferredQuery],
  );

  function closeSheet() {
    setSelectedListing(null);
  }

  function handleEdit(listing: Listing) {
    closeSheet();
    router.push({ pathname: '/listings/edit/[id]', params: { id: listing.id } });
  }

  function handleViewOrder(listing: Listing) {
    if (listing.order) {
      closeSheet();
      router.push({ pathname: '/orders/[id]', params: { id: listing.order.id } });
    }
  }

  function handleDeletePress(listing: Listing) {
    Alert.alert(
      'Delete listing?',
      `${listing.brand.name} will be permanently removed from the bazaar.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => { void executeDelete(listing); },
        },
      ],
    );
  }

  async function executeDelete(listing: Listing) {
    if (!sessionToken) return;
    setDeleting(true);
    setFeedback(null);
    try {
      await api.deleteListing(sessionToken, listing.id);
      closeSheet();
      setFeedback({ ok: true, text: `${listing.brand.name} removed.` });
      await listingsResource.reload();
    } catch (error) {
      setFeedback({
        ok: false,
        text: error instanceof Error ? error.message : 'Could not delete listing.',
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(400)} style={{ flex: 1 }}>
      <AppShell
        eyebrow="Listings"
        subtitle="Tap any card for details and actions."
        title="Inventory">

        {/* ── Total Earnings Strip ── */}
        {Boolean(user?.totalEarned) && (
          <View style={{
            backgroundColor: theme.colors.brand,
            borderRadius: theme.radius.md,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20
          }}>
            <View>
              <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 12, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 1 }}>Total Earned</Text>
              <Text style={{ fontFamily: theme.fontFamily.headlineExtra, fontSize: 26, color: '#FFFFFF', marginTop: 2 }}>{formatCurrency(user?.totalEarned ?? 0)}</Text>
            </View>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="sparkles" size={24} color="#FFFFFF" />
            </View>
          </View>
        )}

        {/* Search + tab toggle */}
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: theme.colors.surfaceTray,
              borderColor: theme.colors.border,
            },
          ]}>
          <Ionicons color={theme.colors.inkMuted} name="search-outline" size={18} />
          <TextInput
            className="flex-1 font-body text-body"
            onChangeText={setSearchQuery}
            placeholder="Search by brand or type"
            placeholderTextColor={theme.colors.inkMuted}
            style={{ color: theme.colors.ink, letterSpacing: 0 }}
            value={searchQuery}
          />
          {searchQuery ? (
            <Pressable
              accessibilityLabel="Clear search"
              accessibilityRole="button"
              onPress={() => { setSearchQuery(''); }}>
              <Ionicons color={theme.colors.inkMuted} name="close-circle" size={18} />
            </Pressable>
          ) : null}
          <View style={[styles.searchDivider, { backgroundColor: theme.colors.border }]} />
          <Pressable
            accessibilityLabel={`Switch to ${tab === 'live' ? 'history' : 'live'}`}
            accessibilityRole="button"
            onPress={() => { setTab((t) => (t === 'live' ? 'history' : 'live')); }}
            style={({ pressed }) => [
              styles.tabToggle,
              {
                backgroundColor: tab === 'live' ? theme.colors.brandSoft : theme.colors.surfaceRaised,
                borderColor: tab === 'live' ? theme.colors.pillBrandBorder : theme.colors.border,
                opacity: pressed ? 0.82 : 1,
              },
            ]}>
            <Ionicons
              color={tab === 'live' ? theme.colors.brand : theme.colors.inkMuted}
              name={tab === 'live' ? 'radio-button-on-outline' : 'time-outline'}
              size={13}
            />
            <Text
              className="font-label text-caption font-bold"
              style={{ color: tab === 'live' ? theme.colors.brand : theme.colors.inkMuted }}>
              {tab === 'live' ? 'Live' : 'History'}
            </Text>
          </Pressable>
        </View>

        {/* Feedback */}
        {feedback ? (
          <Text
            className="text-center text-caption font-semibold"
            style={{ color: feedback.ok ? theme.colors.success : theme.colors.danger }}>
            {feedback.text}
          </Text>
        ) : null}

        {/* Loading / error */}
        {listingsResource.loading && !listingsResource.data ? (
          <View style={{ gap: theme.spacing[5] }}>
            <ListingCardSkeleton />
            <ListingCardSkeleton />
            <ListingCardSkeleton />
          </View>
        ) : null}
        {listingsResource.error ? (
          <Text className="text-body" style={{ color: theme.colors.danger }}>
            {listingsResource.error}
          </Text>
        ) : null}

        {/* Compact listing cards — tap opens detail sheet */}
        {visibleListings.map((listing) => (
          <TicketCard
            key={listing.id}
            eyebrow={getCardEyebrow(listing)}
            meta={`Expires ${formatDate(listing.expiryDate)}`}
            onPress={() => { setSelectedListing(listing); }}
            subtitle={`${formatCurrency(listing.sellingPrice)} • ${listing.voucherType}`}
            title={listing.brand.name}
            tone={getCardTone(listing)}
          />
        ))}

        {/* Empty state */}
        {!listingsResource.loading && !listingsResource.error && visibleListings.length === 0 ? (
          <TicketCard
            subtitle={
              deferredQuery
                ? 'Try a different brand or voucher type.'
                : tab === 'live'
                  ? 'Use the Sell tab to list a voucher.'
                  : 'No sold or expired listings yet.'
            }
            title={
              deferredQuery
                ? 'No matching listings'
                : tab === 'live'
                  ? 'No live listings'
                  : 'No history yet'
            }
          />
        ) : null}

        {/* Detail sheet modal */}
        <Modal
          animationType="slide"
          transparent
          visible={Boolean(selectedListing)}
          onRequestClose={closeSheet}>
          {selectedListing ? (
            <ListingDetailSheet
              deleting={deleting}
              listing={selectedListing}
              onClose={closeSheet}
              onDelete={() => { handleDeletePress(selectedListing); }}
              onEdit={() => { handleEdit(selectedListing); }}
              onViewOrder={() => { handleViewOrder(selectedListing); }}
            />
          ) : null}
        </Modal>
      </AppShell>
    </Animated.View>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 8,
    minHeight: 48,
  },
  searchDivider: {
    width: 1,
    height: 18,
  },
  tabToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '86%',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  sheetCloseBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetScroll: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 48,
    gap: 20,
  },
  sheetCategory: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  sheetBrandName: {
    fontSize: 22,
    fontWeight: '800',
  },
  sheetType: {
    fontSize: 14,
    marginTop: 2,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sheetGrid: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sheetSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
