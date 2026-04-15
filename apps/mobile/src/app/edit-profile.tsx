import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/theme/ThemeContext';

// ─── Floating label field ─────────────────────────────────────────────────────

function FloatingField({
  label,
  value,
  onChangeText,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  editable = true,
  trailingLabel,
  onTrailingPress,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChangeText?: (v: string) => void;
  readonly keyboardType?: 'default' | 'email-address' | 'phone-pad';
  readonly autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  readonly editable?: boolean;
  readonly trailingLabel?: string;
  readonly onTrailingPress?: () => void;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const floatAnim = useRef(new Animated.Value(value ? 1 : 0)).current;

  const isFloated = focused || Boolean(value);

  function handleFocus() {
    setFocused(true);
    Animated.timing(floatAnim, { toValue: 1, duration: 150, useNativeDriver: false }).start();
  }

  function handleBlur() {
    setFocused(false);
    if (!value) {
      Animated.timing(floatAnim, { toValue: 0, duration: 150, useNativeDriver: false }).start();
    }
  }

  const labelTop = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [17, 7] });
  const labelSize = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [15, 11] });
  const labelColor = focused ? theme.colors.brand : theme.colors.inkSecondary;
  const borderColor = focused ? theme.colors.brand : theme.colors.border;

  return (
    <View style={{
      borderWidth: 1,
      borderColor,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceTray,
      paddingHorizontal: theme.spacing[4],
      paddingTop: 22,
      paddingBottom: 10,
      position: 'relative',
    }}>
      <Animated.Text style={{
        position: 'absolute',
        left: theme.spacing[4],
        top: labelTop,
        fontSize: labelSize,
        fontFamily: isFloated ? theme.fontFamily.labelSemi : theme.fontFamily.label,
        color: labelColor,
        pointerEvents: 'none',
      }}>
        {label}
      </Animated.Text>

      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TextInput
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          editable={editable}
          keyboardType={keyboardType}
          onBlur={handleBlur}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          style={{
            flex: 1,
            fontFamily: theme.fontFamily.label,
            fontSize: 16,
            color: editable ? theme.colors.ink : theme.colors.inkSecondary,
            paddingVertical: 0,
          }}
          value={value}
        />
        {trailingLabel ? (
          <Pressable onPress={onTrailingPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <Text style={{
              fontFamily: theme.fontFamily.labelSemi,
              fontSize: 12,
              color: theme.colors.brand,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}>
              {trailingLabel}
            </Text>
          </Pressable>
        ) : null}
        {!editable && !trailingLabel ? (
          <Ionicons name="lock-closed-outline" size={14} color={theme.colors.inkMuted} />
        ) : null}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EditProfileScreen() {
  const auth = useAuth();
  const { user } = auth;
  const theme = useTheme();
  const router = useRouter();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initial = (user?.name ?? user?.phone ?? '?')[0].toUpperCase();

  const isDirty =
    name.trim() !== (user?.name ?? '') ||
    (email.trim() || null) !== (user?.email ?? null);

  async function handleSave() {
    if (name.trim().length < 2) { setError('Name must be at least 2 characters.'); return; }
    setSaving(true);
    setError(null);
    try {
      await auth.updateProfile({ name: name.trim(), email: email.trim() || null });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}>

          {/* ── Nav ── */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: theme.spacing[4],
            paddingTop: theme.spacing[2],
            paddingBottom: theme.spacing[3],
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
            <Text style={{
              flex: 1,
              textAlign: 'center',
              fontFamily: theme.fontFamily.headlineExtra,
              fontSize: 17,
              color: theme.colors.ink,
              letterSpacing: -0.2,
              marginRight: 40,
            }}>
              Your Profile
            </Text>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: theme.spacing[5], paddingBottom: theme.spacing[8] }}>

            {/* ── Avatar ── */}
            <View style={{ alignItems: 'center', marginTop: theme.spacing[4], marginBottom: theme.spacing[7] }}>
              <View style={{ position: 'relative' }}>
                <View style={{
                  borderRadius: 48,
                  shadowColor: theme.colors.brand,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.28,
                  shadowRadius: 14,
                  elevation: 6,
                }}>
                  <LinearGradient
                    colors={theme.gradients.brand}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      width: 96, height: 96,
                      borderRadius: 48,
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}>
                    <Text style={{
                      fontFamily: theme.fontFamily.headlineExtra,
                      fontSize: 36,
                      color: theme.colors.white,
                    }}>
                      {initial}
                    </Text>
                  </LinearGradient>
                </View>
                {/* Edit badge */}
                <View style={{
                  position: 'absolute',
                  bottom: 2,
                  right: 2,
                  width: 28, height: 28,
                  borderRadius: 14,
                  backgroundColor: theme.colors.brand,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: theme.colors.background,
                }}>
                  <Ionicons name="pencil" size={12} color={theme.colors.white} />
                </View>
              </View>
            </View>

            {/* ── Fields ── */}
            <View style={{ gap: theme.spacing[4] }}>
              <FloatingField
                label="Name"
                value={name}
                onChangeText={(v) => { setName(v); setError(null); }}
                autoCapitalize="words"
              />
              <FloatingField
                label="Mobile"
                value={user?.phone ?? ''}
                editable={false}
              />
              <FloatingField
                label="Email (optional)"
                value={email}
                onChangeText={(v) => { setEmail(v); setError(null); }}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {error ? (
              <View style={{
                marginTop: theme.spacing[4],
                padding: theme.spacing[3],
                backgroundColor: `${theme.colors.danger}18`,
                borderRadius: theme.radius.sm,
                borderWidth: 1,
                borderColor: `${theme.colors.danger}30`,
              }}>
                <Text style={{ fontFamily: theme.fontFamily.label, fontSize: 13, color: theme.colors.danger }}>
                  {error}
                </Text>
              </View>
            ) : null}

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* ── Sticky bottom button ── */}
      <SafeAreaView edges={['bottom', 'left', 'right']} style={{ backgroundColor: theme.colors.background }}>
        <View style={{
          paddingHorizontal: theme.spacing[5],
          paddingTop: theme.spacing[3],
          paddingBottom: theme.spacing[4],
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
        }}>
          <Pressable
            onPress={() => { void handleSave(); }}
            disabled={saving || !isDirty}
            style={({ pressed }) => ({
              opacity: saving || !isDirty ? 0.5 : pressed ? 0.88 : 1,
            })}>
            <LinearGradient
              colors={theme.gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                paddingVertical: 16,
                borderRadius: theme.radius.md,
                overflow: 'hidden',
              }}>
              {saving
                ? <ActivityIndicator color={theme.colors.white} />
                : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color={theme.colors.white} />
                    <Text style={{
                      fontFamily: theme.fontFamily.labelSemi,
                      fontSize: 16,
                      color: theme.colors.white,
                      letterSpacing: 0.1,
                    }}>
                      Update profile
                    </Text>
                  </>
                )}
            </LinearGradient>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
