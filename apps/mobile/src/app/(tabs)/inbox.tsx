import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/hooks/use-auth';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { useNotificationCenter } from '@/hooks/use-notification-center';
import { useNotificationsSocket } from '@/hooks/use-notifications-socket';
import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus';
import { useRefetchOnReconnect } from '@/hooks/use-refetch-on-reconnect';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useTheme } from '@/theme/theme-context';

// ─── Notification item ────────────────────────────────────────────────────────

function NotificationRow({
  title,
  message,
  time,
  isUnread,
  onPress,
}: {
  readonly title: string;
  readonly message: string;
  readonly time: string;
  readonly isUnread: boolean;
  readonly onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: pressed
          ? theme.colors.surfaceHigh
          : isUnread
            ? `${theme.colors.brand}0D`
            : theme.colors.transparent,
      })}>
      <View style={{
        width: 8, height: 8, borderRadius: 4,
        backgroundColor: isUnread ? theme.colors.brand : theme.colors.transparent,
        marginTop: 6, marginRight: 12,
      }} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
          <Text style={{
            fontFamily: theme.fontFamily.labelSemi,
            fontSize: 14, color: theme.colors.ink,
            flex: 1, marginRight: 8,
          }}>
            {title}
          </Text>
          <Text style={{ fontFamily: theme.fontFamily.label, fontSize: 12, color: theme.colors.inkMuted }}>
            {time}
          </Text>
        </View>
        <Text style={{
          fontFamily: theme.fontFamily.body,
          fontSize: 13, color: theme.colors.inkSecondary, lineHeight: 18,
        }}>
          {message}
        </Text>
      </View>
    </Pressable>
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

  const unreadCount = notificationsResource.data?.filter((n) => n.status !== 'READ').length ?? 0;

  return (
    <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(400)} style={{ flex: 1 }}>
      <AppShell title="Inbox">
        {notificationsResource.loading && !notificationsResource.data ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator color={theme.colors.brand} />
          </View>
        ) : notificationsResource.data && notificationsResource.data.length > 0 ? (
          <View style={{
            backgroundColor: theme.colors.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.colors.border,
            overflow: 'hidden',
          }}>
            {/* Actions row */}
            <View style={{
              flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing[4],
              paddingHorizontal: 16, paddingVertical: 10,
              borderBottomWidth: 1, borderBottomColor: theme.colors.border,
            }}>
              {unreadCount > 0 ? (
                <Pressable onPress={() => { void handleMarkAllRead(); }}>
                  <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 13, color: theme.colors.brand }}>
                    Mark all read
                  </Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => { void handleClearAll(); }}>
                <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 13, color: theme.colors.danger }}>
                  Clear all
                </Text>
              </Pressable>
            </View>

            {notificationsResource.data.map((notification, index) => (
              <View key={notification.id}>
                <NotificationRow
                  isUnread={notification.status !== 'READ'}
                  message={notification.message}
                  onPress={() => { void handleMarkRead(notification.id); }}
                  time={formatDateTime(notification.createdAt)}
                  title={notification.title}
                />
                {index < (notificationsResource.data?.length ?? 0) - 1 ? (
                  <View style={{ height: 1, backgroundColor: theme.colors.border, marginLeft: 40 }} />
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <View style={{ paddingVertical: 60, alignItems: 'center', gap: 10 }}>
            <Ionicons name="notifications-off-outline" size={36} color={theme.colors.inkMuted} />
            <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 15, color: theme.colors.inkMuted }}>
              No notifications yet
            </Text>
          </View>
        )}
      </AppShell>
    </Animated.View>
  );
}
