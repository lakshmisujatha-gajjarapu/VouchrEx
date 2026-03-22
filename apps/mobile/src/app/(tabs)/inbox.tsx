import React, { useCallback } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { FilterChip } from '@/components/filter-chip';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenShell } from '@/components/screen-shell';
import { SectionPanel } from '@/components/section-panel';
import { StatusPill } from '@/components/status-pill';
import { TicketCard } from '@/components/ticket-card';
import { useAuth } from '@/hooks/use-auth';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus';
import { api } from '@/lib/api';
import { formatDateTime, formatStatus } from '@/lib/format';
import { useTheme } from '@/theme/ThemeContext';
import { useThemePreference } from '@/theme/theme-preference';
import type { ThemePreference } from '@/theme/tokens';

const appearanceOptions: readonly ThemePreference[] = ['system', 'light', 'dark'] as const;

function formatPreferenceLabel(preference: ThemePreference) {
  if (preference === 'system') {
    return 'system';
  }

  return preference;
}

export default function InboxScreen() {
  const auth = useAuth();
  const { sessionToken, user } = auth;
  const theme = useTheme();
  const themePreference = useThemePreference();
  const { preference } = themePreference;
  const notificationsResource = useAsyncResource(
    useCallback(() => {
      if (!sessionToken) {
        throw new Error('Session missing.');
      }

      return api.listNotifications(sessionToken);
    }, [sessionToken]),
    { enabled: Boolean(sessionToken) },
  );

  useRefetchOnFocus(useCallback(() => { void notificationsResource.reload(); }, [notificationsResource.reload]));

  async function handleMarkRead(id: string) {
    if (!sessionToken) return;
    const next = await api.markNotificationRead(sessionToken, id);
    notificationsResource.setData((previous) =>
      previous?.map((item) => (item.id === id ? next : item)) ?? [next],
    );
  }

  async function handleMarkAllRead() {
    if (!sessionToken) return;
    await api.markAllNotificationsRead(sessionToken);
    notificationsResource.setData((previous) =>
      previous?.map((item) => ({ ...item, status: 'READ' as const })) ?? [],
    );
  }

  async function handleClearAll() {
    if (!sessionToken) return;
    await api.clearAllNotifications(sessionToken);
    notificationsResource.setData(() => []);
  }

  return (
    <ScreenShell eyebrow="Account" subtitle="Notifications, preferences, and sign-out." title="Inbox">
      <TicketCard
        eyebrow="Account"
        meta={user?.status ?? 'Active'}
        subtitle={user?.phone}
        title={user?.name ?? 'Signed-in user'}
        tone="brand">
        <View className="mt-2 flex-row flex-wrap gap-2">
          <StatusPill label={formatStatus(user?.status ?? 'ACTIVE')} tone="brand" />
        </View>
        <View className="mt-2">
          <PrimaryButton
            label="Sign out"
            onPress={() => {
              void auth.signOut();
            }}
            tone="secondary"
          />
        </View>
      </TicketCard>

      <SectionPanel
        description="Switch instantly and keep the preference on this device."
        title="Appearance">
        <View className="mt-2 flex-row flex-wrap gap-2">
          <StatusPill
            label={preference === 'system' ? 'Following system' : `${formatPreferenceLabel(preference)} locked`}
            tone="neutral"
          />
        </View>
        <View className="flex-row flex-wrap gap-2">
          {appearanceOptions.map((option) => (
            <FilterChip
              key={option}
              label={formatPreferenceLabel(option)}
              onPress={() => {
                void themePreference.setPreference(option);
              }}
              selected={preference === option}
            />
          ))}
        </View>
      </SectionPanel>

      {notificationsResource.loading && !notificationsResource.data ? (
        <ActivityIndicator color={theme.colors.brand} />
      ) : null}

      {notificationsResource.data && notificationsResource.data.length > 0 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 16 }}>
          {notificationsResource.data.some((n) => n.status !== 'READ') ? (
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
      ) : null}

      {notificationsResource.data?.map((notification) => (
        <Pressable key={notification.id} onPress={() => void handleMarkRead(notification.id)}>
          <TicketCard
            eyebrow={notification.eventType.replace('.', ' ')}
            meta={formatDateTime(notification.createdAt)}
            subtitle={notification.message}
            title={notification.title}
            tone={notification.status === 'READ' ? 'neutral' : 'brand'}>
            <Text
              className="font-label text-caption font-bold"
              style={{ color: notification.status === 'READ' ? theme.colors.inkMuted : theme.colors.brand }}>
              {notification.status === 'READ' ? 'Opened' : 'Tap to mark read'}
            </Text>
          </TicketCard>
        </Pressable>
      ))}

      {!notificationsResource.loading && notificationsResource.data?.length === 0 ? (
        <TicketCard subtitle="New order and payout updates will show here." title="No notifications yet" />
      ) : null}
    </ScreenShell>
  );
}
