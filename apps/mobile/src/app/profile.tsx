import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/theme/theme-context';
import { useThemePreference } from '@/theme/theme-preference';
import type { ThemePreference } from '@/theme/tokens';

const appearanceLabels: Record<ThemePreference, string> = {
  system: 'Automatic',
  light: 'Light',
  dark: 'Dark',
};

const appearanceIcons: Record<ThemePreference, keyof typeof Ionicons.glyphMap> = {
  system: 'phone-portrait-outline',
  light: 'sunny-outline',
  dark: 'moon-outline',
};

// ─── Row ──────────────────────────────────────────────────────────────────────

function Row({
  icon,
  label,
  value,
  onPress,
  destructive = false,
}: {
  readonly icon: keyof typeof Ionicons.glyphMap;
  readonly label: string;
  readonly value?: string;
  readonly onPress?: () => void;
  readonly destructive?: boolean;
}) {
  const theme = useTheme();
  const iconColor = destructive ? theme.colors.danger : theme.colors.brand;
  const labelColor = destructive ? theme.colors.danger : theme.colors.ink;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? theme.colors.surfaceRaised : theme.colors.transparent,
      })}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing[5],
        paddingVertical: 14,
        gap: theme.spacing[3],
      }}>
        <View style={{
          width: 34, height: 34,
          borderRadius: 9,
          backgroundColor: destructive
            ? `${theme.colors.danger}14`
            : theme.colors.surfaceRaised,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Ionicons name={icon} size={17} color={iconColor} />
        </View>

        <Text style={{
          flex: 1,
          fontFamily: theme.fontFamily.label,
          fontSize: 15,
          color: labelColor,
        }}>
          {label}
        </Text>

        {value ? (
          <Text style={{
            fontFamily: theme.fontFamily.label,
            fontSize: 14,
            color: theme.colors.inkMuted,
          }}>
            {value}
          </Text>
        ) : null}

        {onPress ? (
          <Ionicons name="chevron-forward" size={15} color={theme.colors.inkMuted} />
        ) : null}
      </View>
    </Pressable>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ marginTop: theme.spacing[6] }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing[5],
        marginBottom: theme.spacing[2],
        gap: 8,
      }}>
        <View style={{
          width: 3, height: 14,
          borderRadius: 2,
          backgroundColor: theme.colors.brand,
        }} />
        <Text style={{
          fontFamily: theme.fontFamily.labelSemi,
          fontSize: 11,
          color: theme.colors.inkSecondary,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
        }}>
          {title}
        </Text>
      </View>

      {/* Card */}
      <View style={{
        marginHorizontal: theme.spacing[4],
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        overflow: 'hidden',
      }}>
        {React.Children.map(children, (child, i) => (
          <>
            {i > 0 && (
              <View style={{
                height: 1,
                backgroundColor: theme.colors.border,
                marginLeft: 34 + theme.spacing[3] + theme.spacing[5],
              }} />
            )}
            {child}
          </>
        ))}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

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

  const tierIcon: keyof typeof Ionicons.glyphMap =
    tier === 'gold' ? 'trophy' :
    tier === 'silver' ? 'medal' :
    'ribbon';

  const tierTagline =
    tier === 'gold' ? 'Top seller · trusted by buyers' :
    tier === 'silver' ? 'Growing reputation' :
    'Building your reputation';

  const appearanceOrder: ThemePreference[] = ['system', 'light', 'dark'];
  function cycleAppearance() {
    const idx = appearanceOrder.indexOf(preference);
    void themePrefs.setPreference(appearanceOrder[(idx + 1) % appearanceOrder.length]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 56 }}>

          {/* ── Nav ── */}
          <View style={{
            paddingHorizontal: theme.spacing[4],
            paddingTop: theme.spacing[2],
            paddingBottom: theme.spacing[1],
          }}>
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
          <View style={{
            paddingHorizontal: theme.spacing[5],
            paddingTop: theme.spacing[1],
            paddingBottom: theme.spacing[5],
            gap: theme.spacing[4],
          }}>

            {/* Avatar + name */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[4] }}>
              {/* Gradient avatar */}
              <View style={{
                borderRadius: 36,
                shadowColor: theme.colors.brand,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.30,
                shadowRadius: 12,
                elevation: 5,
              }}>
                <LinearGradient
                  colors={theme.gradients.brand}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    width: 72, height: 72,
                    borderRadius: 36,
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}>
                  <Text style={{
                    fontFamily: theme.fontFamily.headlineExtra,
                    fontSize: 28,
                    color: theme.colors.white,
                  }}>
                    {initial}
                  </Text>
                </LinearGradient>
              </View>

              {/* Identity */}
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{
                  fontFamily: theme.fontFamily.headlineExtra,
                  fontSize: 22,
                  letterSpacing: -0.3,
                  color: theme.colors.ink,
                }}>
                  {user?.name ?? 'You'}
                </Text>
                <Text style={{
                  fontFamily: theme.fontFamily.body,
                  fontSize: 13,
                  color: theme.colors.inkSecondary,
                }}>
                  {user?.phone ?? ''}
                </Text>
                <Pressable
                  onPress={() => { router.push('/edit-profile'); }}
                  style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, alignSelf: 'flex-start', marginTop: 4 })}>
                  <Text style={{
                    fontFamily: theme.fontFamily.labelSemi,
                    fontSize: 13,
                    color: theme.colors.brand,
                  }}>
                    Edit profile ›
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Membership card — the signature element */}
            <View style={{
              flexDirection: 'row',
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: `${tierColor}30`,
              overflow: 'hidden',
              shadowColor: tierColor,
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.12,
              shadowRadius: 8,
              elevation: 2,
            }}>
              {/* Tier color stripe */}
              <View style={{ width: 4, backgroundColor: tierColor }} />

              <View style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: theme.spacing[4],
                paddingVertical: 14,
                gap: theme.spacing[3],
              }}>
                <View style={{
                  width: 40, height: 40, borderRadius: 20,
                  backgroundColor: `${tierColor}18`,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name={tierIcon} size={20} color={tierColor} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontFamily: theme.fontFamily.labelSemi,
                    fontSize: 15,
                    color: theme.colors.ink,
                  }}>
                    {tier.charAt(0).toUpperCase() + tier.slice(1)} member
                  </Text>
                  <Text style={{
                    fontFamily: theme.fontFamily.body,
                    fontSize: 12,
                    color: theme.colors.inkSecondary,
                    marginTop: 1,
                  }}>
                    {tierTagline}
                  </Text>
                </View>

                <View style={{
                  paddingHorizontal: 10, paddingVertical: 5,
                  borderRadius: theme.radius.pill,
                  backgroundColor: `${tierColor}18`,
                  borderWidth: 1,
                  borderColor: `${tierColor}30`,
                }}>
                  <Text style={{
                    fontFamily: theme.fontFamily.labelSemi,
                    fontSize: 12,
                    color: tierColor,
                  }}>
                    {String(user?.totalSales ?? 0)} sales
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* ── Preferences ── */}
          <Section title="Preferences">
            <Row
              icon={appearanceIcons[preference]}
              label="Appearance"
              onPress={cycleAppearance}
              value={appearanceLabels[preference]}
            />
            <Row
              icon="notifications-outline"
              label="Notifications"
              onPress={() => { Alert.alert('Notifications', 'Coming soon.'); }}
              value="On"
            />
          </Section>

          {/* ── Account ── */}
          <Section title="Account">
            <Row
              icon="shield-checkmark-outline"
              label="Security"
              onPress={() => {
                Alert.alert(
                  'Sign out everywhere?',
                  'This will sign you out of all devices, including this one.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Sign out all',
                      style: 'destructive',
                      onPress: () => { void auth.signOut().then(() => { router.replace('/sign-in'); }); },
                    },
                  ],
                );
              }}
            />
            <Row
              icon="document-text-outline"
              label="Terms & Privacy"
              onPress={() => { router.push('/terms'); }}
            />
            <Row
              destructive
              icon="log-out-outline"
              label="Log Out"
              onPress={() => {
                void auth.signOut().then(() => { router.replace('/sign-in'); });
              }}
            />
          </Section>

          {/* ── Version ── */}
          <Text style={{
            textAlign: 'center',
            fontFamily: theme.fontFamily.label,
            fontSize: 12,
            color: theme.colors.inkMuted,
            marginTop: theme.spacing[7],
          }}>
            VouchrEx v0.1.0
          </Text>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
