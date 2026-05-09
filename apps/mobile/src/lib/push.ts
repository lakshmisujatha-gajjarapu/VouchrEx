import * as Application from 'expo-application';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from './api';

export type PushPlatform = 'IOS' | 'ANDROID' | 'WEB';

function detectPlatform(): PushPlatform {
  if (Platform.OS === 'ios') return 'IOS';
  if (Platform.OS === 'android') return 'ANDROID';
  return 'WEB';
}

async function getDeviceId(): Promise<string> {
  if (Platform.OS === 'android') {
    return Application.getAndroidId() || 'unknown-android';
  }
  return (await Application.getIosIdForVendorAsync()) ?? 'unknown-ios';
}

export async function registerForPush(sessionToken: string): Promise<void> {
  const settings = await Notifications.getPermissionsAsync();
  let granted = settings.granted;

  if (!granted) {
    const ask = await Notifications.requestPermissionsAsync();
    granted = ask.granted;
  }
  if (!granted) return;

  const tokenResult = await Notifications.getExpoPushTokenAsync();
  const deviceId = await getDeviceId();

  await api.registerPushToken(sessionToken, {
    deviceId,
    token: tokenResult.data,
    platform: detectPlatform()
  });
}

export async function unregisterFromPush(sessionToken: string): Promise<void> {
  const deviceId = await getDeviceId();
  try {
    await api.unregisterPushToken(sessionToken, deviceId);
  } catch {
    // best-effort
  }
}

export function configureForegroundBehavior(): void {
  Notifications.setNotificationHandler({
    handleNotification: () => Promise.resolve({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false
    })
  });
}

/**
 * Validates that a deep-link is a safe relative path (starts with `/` and
 * does not contain `://`). Returns the link or null. Prevents a malformed
 * payload from navigating to an external URL or breaking the router.
 */
export function safeDeepLink(link: unknown): string | null {
  if (typeof link !== 'string' || link.length === 0) return null;
  if (!link.startsWith('/') || link.includes('://')) return null;
  return link;
}

export function subscribeToNotificationTaps(onTap: (link: string) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const link = safeDeepLink(response.notification.request.content.data.link);
    if (link) onTap(link);
  });
  return () => { sub.remove(); };
}
