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

import { KeylineRow } from '@/components/keyline-row';
import { PrimaryButton } from '@/components/primary-button';
import { AppShell } from '@/components/app-shell';
import { StatusPill } from '@/components/status-pill';
import { TicketCard } from '@/components/ticket-card';
import { useAuth } from '@/hooks/use-auth';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { useListingsSocket } from '@/hooks/use-listings-socket';
import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus';
import { useRefetchOnReconnect } from '@/hooks/use-refetch-on-reconnect';
import { api, type Listing } from '@/lib/api';
import { formatCurrency, formatDate, formatStatus } from '@/lib/format';
import { getCardEyebrow, getCardTone, getStatusPillTone, getExpiryUrgency } from '@/lib/status';
import { useTheme } from '@/theme/ThemeContext';

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

function isEditable(listing: Listing): boolean {
  return (
    editableStatuses.has(listing.status) &&
    !listing.order &&
    new Date(listing.expiryDate).getTime() > Date.now()
  );
}

function isDeletable(listing: Listing): boolean {
  return editableStatuses.has(listing.status) && !listing.order;
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
  const editable = isEditable(listing);
  const deletable = isDeletable(listing);
  const hasActiveOrder = Boolean(listing.order);

  return (
    <View style={styles.sheetOverlay}>
      {/* Tap outside to close */}
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
          <Ionicons color={theme.colors.inkMuted} name="close" size={16} />
        </Pressable>

        <ScrollView
          contentContainerStyle={styles.sheetScroll}
          showsVerticalScrollIndicator={false}>

          {/* Brand header */}
          <View style={{ gap: 2 }}>
            <Text style={[styles.sheetCategory, { color: theme.colors.brand }]}>
              {listing.brand.category}
            </Text>
            <Text style={[styles.sheetBrandName, { color: theme.colors.ink }]}>
              {listing.brand.name}
            </Text>
            <Text style={[styles.sheetType, { color: theme.colors.inkMuted }]}>
              {listing.voucherType}
            </Text>
          </View>

          {/* Status pills */}
          <View style={styles.pillRow}>
            <StatusPill label={getCardEyebrow(listing)} tone={getStatusPillTone(listing)} />
            {urgency === 'warning' ? (
              <StatusPill label="10 days left" tone="warning" />
            ) : null}
            {urgency === 'danger' && !['EXPIRED', 'RESERVED', 'SOLD'].includes(listing.status) ? (
              <StatusPill label="Final 48h" tone="danger" />
            ) : null}
          </View>

          {/* Price + expiry grid */}
          <View
            style={[
              styles.sheetGrid,
              { borderColor: theme.colors.border },
            ]}>
            <KeylineRow label="Selling price" value={formatCurrency(listing.sellingPrice)} />
            <KeylineRow label="Face value" value={formatCurrency(listing.faceValue)} />
            <KeylineRow
              label="Discount"
              value={`${String(Math.round(listing.discountPercent))}% off`}
            />
            <KeylineRow label="Expires" value={formatDate(listing.expiryDate)} />
          </View>

          {/* Order section */}
          {hasActiveOrder && listing.order ? (
            <View style={{ gap: 10 }}>
              <Text style={[styles.sheetSectionLabel, { color: theme.colors.inkMuted }]}>
                Active order
              </Text>
              <View
                style={[
                  styles.sheetGrid,
                  { borderColor: theme.colors.pillBrandBorder },
                ]}>
                <KeylineRow
                  label="Order status"
                  value={formatStatus(listing.order.status)}
                />
              </View>
              <PrimaryButton label="View order" onPress={onViewOrder} tone="secondary" />
            </View>
          ) : null}

          {/* Actions */}
          <View style={{ gap: 10 }}>
            {editable ? (
              <PrimaryButton label="Edit listing" onPress={onEdit} tone="secondary" />
            ) : null}
            {deletable ? (
              <PrimaryButton
                label="Delete listing"
                loading={deleting}
                onPress={onDelete}
                tone="danger"
              />
            ) : null}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

// ─── screen ───────────────────────────────────────────────────────────────────

export default function ListingsScreen() {
  const router = useRouter();
  const { sessionToken } = useAuth();
  const theme = useTheme();
  const [tab, setTab] = useState<ListingTab>('live');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deferredQuery = useDeferredValue(searchQuery.trim().toLowerCase());

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
    <AppShell
      eyebrow="Listings"
      subtitle="Tap any card for details and actions."
      title="Inventory">

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
        <ActivityIndicator color={theme.colors.brand} />
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
