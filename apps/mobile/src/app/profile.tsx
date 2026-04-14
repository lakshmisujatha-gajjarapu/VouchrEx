import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/theme/ThemeContext';
import { useThemePreference } from '@/theme/theme-preference';
import type { ThemePreference } from '@/theme/tokens';

const appearanceLabels: Record<ThemePreference, string> = {
  system: 'Automatic',
  light: 'Light',
  dark: 'Dark',
};

function RowItem({
  icon,
  label,
  value,
  onPress,
  iconBg,
}: {
  readonly icon: keyof typeof Ionicons.glyphMap;
  readonly label: string;
  readonly value?: string;
  readonly onPress?: () => void;
  readonly iconBg?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: pressed ? theme.colors.surfaceHigh : 'transparent',
      })}>
      <View style={{
        width: 34, height: 34, borderRadius: 10,
        backgroundColor: iconBg ?? theme.colors.surfaceHigh,
        alignItems: 'center', justifyContent: 'center',
        marginRight: 14,
      }}>
        <Ionicons name={icon} size={18} color={theme.colors.brand} />
      </View>
      <Text style={{ flex: 1, fontFamily: theme.fontFamily.label, fontSize: 15, color: theme.colors.ink }}>
        {label}
      </Text>
      {value ? (
        <Text style={{ fontFamily: theme.fontFamily.label, fontSize: 14, color: theme.colors.inkMuted, marginRight: 6 }}>
          {value}
        </Text>
      ) : null}
      {onPress ? (
        <Ionicons name="chevron-forward" size={16} color={theme.colors.inkMuted} />
      ) : null}
    </Pressable>
  );
}

function SectionHeader({ title }: { readonly title: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 28, paddingBottom: 6 }}>
      <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: theme.colors.brand, marginRight: 10 }} />
      <Text style={{
        fontFamily: theme.fontFamily.labelSemi,
        fontSize: 13,
        color: theme.colors.inkSecondary,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
      }}>
        {title}
      </Text>
    </View>
  );
}

function SectionCard({ children }: { readonly children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{
      marginHorizontal: 16,
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.colors.border,
    }}>
      {children}
    </View>
  );
}

export default function ProfileScreen() {
  const auth = useAuth();
  const { user } = auth;
  const theme = useTheme();
  const router = useRouter();
  const themePrefs = useThemePreference();
  const { preference } = themePrefs;

  const initial = (user?.name ?? user?.phone ?? '?')[0].toUpperCase();
  const tier = (user?.tier ?? 'BRONZE').toLowerCase() as 'gold' | 'silver' | 'bronze';

  const tierColor =
    tier === 'gold' ? theme.colors.gold :
    tier === 'silver' ? theme.colors.silver :
    theme.colors.bronze;

  const tierIcon =
    tier === 'gold' ? 'trophy' :
    tier === 'silver' ? 'medal' :
    'ribbon';

  const appearanceOrder: ThemePreference[] = ['system', 'light', 'dark'];
  function cycleAppearance() {
    const idx = appearanceOrder.indexOf(preference);
    void themePrefs.setPreference(appearanceOrder[(idx + 1) % appearanceOrder.length]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

          {/* ── Nav bar ── */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => { router.back(); }}
              style={({ pressed }) => ({
                width: 40, height: 40, borderRadius: 20,
                alignItems: 'center', justifyContent: 'center',
                opacity: pressed ? 0.6 : 1,
              })}>
              <Ionicons name="chevron-back" size={24} color={theme.colors.ink} />
            </Pressable>
          </View>

          {/* ── Hero ── */}
          <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}>
            {/* Avatar row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <View style={{
                width: 72, height: 72, borderRadius: 36,
                backgroundColor: theme.colors.brandSoft,
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 2,
                borderColor: `${theme.colors.brand}40`,
              }}>
                <Text style={{
                  fontFamily: theme.fontFamily.headlineExtra,
                  fontSize: 30,
                  color: theme.colors.brand,
                }}>
                  {initial}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontFamily: theme.fontFamily.headlineExtra,
                  fontSize: 22, fontWeight: '800',
                  color: theme.colors.ink, letterSpacing: -0.3,
                }}>
                  {user?.name ?? 'You'}
                </Text>
                <Text style={{
                  fontFamily: theme.fontFamily.body,
                  fontSize: 14, color: theme.colors.inkSecondary, marginTop: 2,
                }}>
                  {user?.phone ?? ''}
                </Text>
              </View>
            </View>

            {/* Tier badge row */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: theme.colors.surface,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: `${tierColor}40`,
              paddingHorizontal: 16,
              paddingVertical: 14,
              gap: 12,
            }}>
              <View style={{
                width: 38, height: 38, borderRadius: 19,
                backgroundColor: `${tierColor}20`,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name={tierIcon} size={20} color={tierColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontFamily: theme.fontFamily.labelSemi,
                  fontSize: 15, color: theme.colors.ink,
                }}>
                  {tier.charAt(0).toUpperCase() + tier.slice(1)} member
                </Text>
                <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 12, color: theme.colors.inkSecondary, marginTop: 1 }}>
                  {tier === 'gold' ? 'Top seller · trusted by buyers' :
                   tier === 'silver' ? 'Growing reputation' :
                   'Building your reputation'}
                </Text>
              </View>
              <View style={{
                paddingHorizontal: 10, paddingVertical: 4,
                borderRadius: 20,
                backgroundColor: `${tierColor}20`,
              }}>
                <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 12, color: tierColor }}>
                  {String(user?.totalSales ?? 0)} sales
                </Text>
              </View>
            </View>
          </View>

          {/* ── Preferences ── */}
          <SectionHeader title="Preferences" />
          <SectionCard>
            <RowItem
              icon="sunny-outline"
              label="Appearance"
              onPress={cycleAppearance}
              value={appearanceLabels[preference]}
            />
          </SectionCard>

          {/* ── Log out ── */}
          <View style={{ paddingHorizontal: 16, paddingTop: 28 }}>
            <PrimaryButton
              icon="log-out-outline"
              label="Log Out"
              onPress={() => {
                void auth.signOut().then(() => {
                  router.replace('/sign-in');
                });
              }}
              tone="danger"
            />
          </View>

          {/* ── Version ── */}
          <Text style={{
            textAlign: 'center',
            fontFamily: theme.fontFamily.label,
            fontSize: 12,
            color: theme.colors.inkMuted,
            marginTop: 24,
          }}>
            VouchrEx v0.1.0
          </Text>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
