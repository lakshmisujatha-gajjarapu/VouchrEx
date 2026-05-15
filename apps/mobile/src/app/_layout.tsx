import '../../global.css';

import {
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts as useManropeFonts,
} from '@expo-google-fonts/manrope';
import {
  WorkSans_400Regular,
  WorkSans_500Medium,
  WorkSans_600SemiBold,
  useFonts as useWorkSansFonts,
} from '@expo-google-fonts/work-sans';
import {
  JetBrainsMono_500Medium,
  useFonts as useJetBrainsMonoFonts,
} from '@expo-google-fonts/jetbrains-mono';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import Toast from 'react-native-toast-message';

import { LoadingScreen } from '@/components/loading-screen';
import { toastConfig } from '@/components/toast-config';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { ConfigProvider } from '@/hooks/use-config';
import { NotificationCenterProvider } from '@/hooks/use-notification-center';
import { PushRegistrar } from '@/hooks/use-push-registrar';
import { SocketProvider } from '@/hooks/use-socket';
import { ThemeProvider, useTheme } from '@/theme/theme-context';
import { ThemePreferenceProvider, useThemePreference } from '@/theme/theme-preference';
import { darkTheme } from '@/theme/tokens';

function AppStack() {
  const theme = useTheme();
  useAuth();
  const isDarkTheme = theme.colors.background === darkTheme.colors.background;

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style={isDarkTheme ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      />
    </View>
  );
}

function InnerApp() {
  const { preference } = useThemePreference();

  return (
    <ThemeProvider preference={preference}>
      <AuthProvider>
        <SocketProvider>
          <ConfigProvider>
            <PushRegistrar>
              <NotificationCenterProvider>
                <AppStack />
                <Toast config={toastConfig} topOffset={56} />
              </NotificationCenterProvider>
            </PushRegistrar>
          </ConfigProvider>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [manropeLoaded] = useManropeFonts({ Manrope_700Bold, Manrope_800ExtraBold });
  const [workSansLoaded] = useWorkSansFonts({ WorkSans_400Regular, WorkSans_500Medium, WorkSans_600SemiBold });
  const [jetbrainsLoaded] = useJetBrainsMonoFonts({ JetBrainsMono_500Medium });
  const fontsLoaded = manropeLoaded && workSansLoaded && jetbrainsLoaded;

  if (!fontsLoaded) {
    return <LoadingScreen label="Preparing your vault..." />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemePreferenceProvider fallback={<LoadingScreen label="Preparing your vault..." />}>
        <InnerApp />
      </ThemePreferenceProvider>
    </GestureHandlerRootView>
  );
}
