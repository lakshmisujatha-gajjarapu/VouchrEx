import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { AppShell } from '@/components/app-shell';
import { SwipeableCard, type SwipeAction } from '@/components/swipeable-card';
import { TicketCard } from '@/components/ticket-card';
import { useAuth } from '@/hooks/use-auth';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { useNotificationCenter } from '@/hooks/use-notification-center';
import { useNotificationsSocket } from '@/hooks/use-notifications-socket';
import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus';
import { useRefetchOnReconnect } from '@/hooks/use-refetch-on-reconnect';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useTheme } from '@/theme/theme-context';
// ─── Types ────────────────────────────────────────────────────────────────────

type Notification = {
  readonly id: string;
  readonly title: string;
  readonly message: string;
  readonly status: string;
  readonly createdAt: string;
};

type Tone = 'neutral' | 'brand' | 'success' | 'danger' | 'warning';

// ─── Tone mapping ─────────────────────────────────────────────────────────────

function getTone(title: string, isUnread: boolean): Tone {
  if (!isUnread) return 'neutral';
  const t = title.toLowerCase();
  if (t.includes('dispute') || t.includes('refund') || t.includes('strike') || t.includes('issue'))
    return 'danger';
  if (t.includes('payment') || t.includes('payout') || t.includes('paid') || t.includes('sold'))
    return 'success';
  if (t.includes('expir') || t.includes('expiring') || t.includes('remind'))
    return 'warning';
  return 'brand';
}

// ─── Date grouping ────────────────────────────────────────────────────────────

function getDateLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
  if (d >= todayStart) return 'Today';
  if (d >= yesterdayStart) return 'Yesterday';
  return 'Earlier';
}

type Group = { readonly label: string; readonly items: Notification[] };

function groupByDate(items: Notification[]): Group[] {
  const map: Partial<Record<string, Notification[]>> = {};
  const order: string[] = [];
  for (const item of items) {
    const label = getDateLabel(item.createdAt);
    if (!map[label]) { map[label] = []; order.push(label); }
    map[label].push(item);
  }
  return order.map((label) => ({ label, items: map[label] ?? [] }));
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ label }: { readonly label: string }) {
  const theme = useTheme();
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[2],
      marginBottom: theme.spacing[2],
    }}>
      <Text style={{
        fontFamily: theme.fontFamily.labelSemi,
        fontSize: 11,
        color: theme.colors.inkMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
      }}>
        {label}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border }} />
    </View>
  );
}

// ─── Action pill ──────────────────────────────────────────────────────────────

function ActionPill({
  icon,
  label,
  color,
  onPress,
}: {
  readonly icon: React.ComponentProps<typeof Ionicons>['name'];
  readonly label: string;
  readonly color: string;
  readonly onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: theme.radius.pill,
        borderWidth: 1,
        borderColor: `${color}40`,
        backgroundColor: pressed ? `${color}20` : `${color}10`,
      })}>
      <Ionicons name={icon} size={13} color={color} />
      <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 12, color }}>
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function SkeletonCard() {
  const theme = useTheme();
  return (
    <View style={{
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
      shadowColor: theme.colors.shadowStrong,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 40,
      elevation: 1,
    }}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 6, backgroundColor: theme.colors.surfaceHighest }} />
        <View style={{ flex: 1, padding: 16, gap: 8 }}>
          <View style={{ width: 60, height: 10, borderRadius: 4, backgroundColor: theme.colors.surfaceHighest }} />
          <View style={{ width: '60%', height: 14, borderRadius: 6, backgroundColor: theme.colors.surfaceHigh }} />
          <View style={{ width: '90%', height: 12, borderRadius: 4, backgroundColor: theme.colors.surfaceHighest }} />
        </View>
      </View>
    </View>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingTop: 64, paddingBottom: 40, gap: theme.spacing[4] }}>
      <View style={{
        width: 80,
        height: 80,
        borderRadius: theme.radius.xl,
        backgroundColor: theme.colors.surfaceRaised,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Ionicons name="notifications-outline" size={34} color={theme.colors.inkMuted} />
      </View>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Text style={{
          fontFamily: theme.fontFamily.headline,
          fontSize: 18,
          color: theme.colors.ink,
        }}>
          All caught up
        </Text>
        <Text style={{
          fontFamily: theme.fontFamily.body,
          fontSize: 14,
          color: theme.colors.inkMuted,
          textAlign: 'center',
          lineHeight: 20,
          maxWidth: 240,
        }}>
          You'll hear from us when your listings sell, orders update, or payouts land.
        </Text>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function InboxScreen() {
  const { sessionToken } = useAuth();
  const theme = useTheme();
  const { markAllRead } = useNotificationCenter();
  const reducedMotion = useReducedMotion();

  const notificationsResource = useAsyncResource(
    useCallback(() => {
      if (!sessionToken) throw new Error('Session missing.');
      return api.listNotifications(sessionToken);
    }, [sessionToken]),
    { enabled: Boolean(sessionToken) },
  );

  useRefetchOnFocus(useCallback(() => { void notificationsResource.reload(); }, [notificationsResource.reload]));
  useRefetchOnReconnect(useCallback(() => { void notificationsResource.reload(); }, [notificationsResource.reload]));
  useNotificationsSocket(useCallback(() => { void notificationsResource.reload(); }, [notificationsResource.reload]));
  useFocusEffect(useCallback(() => { markAllRead(); }, [markAllRead]));

  async function handleMarkRead(id: string) {
    if (!sessionToken) return;
    const next = await api.markNotificationRead(sessionToken, id);
    notificationsResource.setData((prev) =>
      prev?.map((item) => (item.id === id ? next : item)) ?? [next],
    );
  }

  async function handleClearOne(id: string) {
    notificationsResource.setData((prev) => prev?.filter((item) => item.id !== id) ?? []);
    if (sessionToken) await api.clearNotification(sessionToken, id);
  }

  async function handleMarkAllRead() {
    if (!sessionToken) return;
    await api.markAllNotificationsRead(sessionToken);
    notificationsResource.setData((prev) =>
      prev?.map((item) => ({ ...item, status: 'READ' as const })) ?? [],
    );
  }

  async function handleClearAll() {
    if (!sessionToken) return;
    await api.clearAllNotifications(sessionToken);
    notificationsResource.setData(() => []);
  }

  const notifications = [...(notificationsResource.data ?? [])] as Notification[];
  const unreadCount = notifications.filter((n) => n.status !== 'READ').length;
  const groups = groupByDate(notifications);

  const isLoading = notificationsResource.loading && !notificationsResource.data;
  const hasData = notifications.length > 0;

  let rowIndex = 0;

  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeIn.duration(350)}
      style={{ flex: 1 }}>
      <AppShell
        title="Inbox"
        subtitle={unreadCount > 0 ? `${String(unreadCount)} unread` : undefined}>

        {/* ── Loading skeletons ── */}
        {isLoading ? (
          <View style={{ gap: theme.spacing[3] }}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>

        /* ── Populated feed ── */
        ) : hasData ? (
          <View style={{ gap: theme.spacing[5] }}>

            {/* Action pills — only when there's content */}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing[2] }}>
              {unreadCount > 0 ? (
                <ActionPill
                  color={theme.colors.brand}
                  icon="checkmark-done-outline"
                  label="Mark all read"
                  onPress={() => { void handleMarkAllRead(); }}
                />
              ) : null}
              <ActionPill
                color={theme.colors.danger}
                icon="trash-outline"
                label="Clear all"
                onPress={() => { void handleClearAll(); }}
              />
            </View>

            {/* Date groups */}
            {groups.map((group) => (
              <View key={group.label} style={{ gap: theme.spacing[3] }}>
                <SectionHeader label={group.label} />
                {group.items.map((notification) => {
                  const isUnread = notification.status !== 'READ';
                  const tone = getTone(notification.title, isUnread);
                  const currentIndex = rowIndex++;

                  const actions: SwipeAction[] = [
                    ...(isUnread ? [{
                      key: 'read',
                      label: 'Mark read',
                      icon: 'checkmark-done-outline' as const,
                      backgroundColor: theme.colors.success,
                      onPress: () => { void handleMarkRead(notification.id); },
                    }] : []),
                    {
                      key: 'clear',
                      label: 'Clear',
                      icon: 'trash-outline' as const,
                      backgroundColor: theme.colors.danger,
                      onPress: () => { void handleClearOne(notification.id); },
                    },
                  ];

                  return (
                    <SwipeableCard key={notification.id} actions={actions}>
                      <Animated.View
                        entering={reducedMotion
                          ? undefined
                          : FadeInDown.delay(currentIndex * 50).duration(300).springify()}>
                        <TicketCard
                          eyebrow={isUnread ? 'UNREAD' : undefined}
                          meta={formatDateTime(notification.createdAt)}
                          subtitle={notification.message}
                          title={notification.title}
                          tone={tone}
                          onPress={() => { void handleMarkRead(notification.id); }}
                        />
                      </Animated.View>
                    </SwipeableCard>
                  );
                })}
              </View>
            ))}
          </View>

        /* ── Empty state ── */
        ) : (
          <EmptyState />
        )}

      </AppShell>
    </Animated.View>
  );
}
