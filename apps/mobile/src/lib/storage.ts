import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { ThemePreference } from '@/theme/tokens';

const sessionTokenKey = 'couponbazaar.session-token';
const themePreferenceKey = 'couponbazaar.theme-preference';

async function readPersistedValue(key: string) {
  if (Platform.OS === 'web') {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  if (typeof SecureStore.getItemAsync !== 'function') {
    return null;
  }

  return SecureStore.getItemAsync(key);
}

async function writePersistedValue(key: string, value: string) {
  if (Platform.OS === 'web') {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
    } catch {
      return;
    }

    return;
  }

  if (typeof SecureStore.setItemAsync !== 'function') {
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

async function clearPersistedValue(key: string) {
  if (Platform.OS === 'web') {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch {
      return;
    }

    return;
  }

  if (typeof SecureStore.deleteItemAsync !== 'function') {
    return;
  }

  await SecureStore.deleteItemAsync(key);
}

export async function readSessionToken() {
  return readPersistedValue(sessionTokenKey);
}

export async function writeSessionToken(token: string) {
  await writePersistedValue(sessionTokenKey, token);
}

export async function clearSessionToken() {
  await clearPersistedValue(sessionTokenKey);
}

export async function readThemePreference(): Promise<ThemePreference> {
  const persisted = await readPersistedValue(themePreferenceKey);

  if (persisted === 'light' || persisted === 'dark') {
    return persisted;
  }

  return 'dark';
}

export async function writeThemePreference(preference: ThemePreference) {
  if (preference === 'system') {
    await clearPersistedValue(themePreferenceKey);
    return;
  }

  await writePersistedValue(themePreferenceKey, preference);
}
