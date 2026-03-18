import '../../global.css';

import {
  IBMPlexSans_400Regular,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
  useFonts,
} from '@expo-google-fonts/ibm-plex-sans';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { LoadingScreen } from '@/components/loading-screen';
import { AuthProvider } from '@/hooks/use-auth';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';
import { ThemePreferenceProvider, useThemePreference } from '@/theme/theme-preference';
import { darkTheme } from '@/theme/tokens';

function AppStack() {
  const theme = useTheme();
  const isDarkTheme = theme.colors.background === darkTheme.colors.background;

  return (
    <>
      <StatusBar style={isDarkTheme ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      />
    </>
  );
}

function InnerApp() {
  const { preference } = useThemePreference();

  return (
    <ThemeProvider preference={preference}>
      <AuthProvider>
        <AppStack />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
  });

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
