import CountryFlag from 'react-native-country-flag';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';

import heroIcon from '../../assets/images/hero-icon.png';

import { PrimaryButton } from '@/components/primary-button';
import { useAuth } from '@/hooks/use-auth';

function normalizeDigits(value: string) {
  return value.replace(/\D/g, '').slice(0, 10);
}

export default function SignInScreen() {
  const auth = useAuth();
  const { otpRequest, status } = auth;
  const [profileName, setProfileName] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();

  if (status === 'signedIn') {
    return <Redirect href="/(tabs)/shop" />;
  }

  const fullPhone = `+91${phoneDigits}`;
  const activePhone = otpRequest?.phone ?? fullPhone;
  const isNewUser = otpRequest?.isNewUser ?? false;
  const otpDeadline = otpRequest
    ? new Date(otpRequest.expiresAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
    : null;

  async function handleRequestOtp() {
    if (phoneDigits.length !== 10) { setError('Enter a valid 10-digit mobile number.'); return; }
    setLoading(true); setError(null);
    try {
      await auth.requestOtp({ phone: fullPhone });
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not request OTP.'); }
    finally { setLoading(false); }
  }

  async function handleVerifyOtp() {
    if (code.length !== 6) { setError('Enter the 6-digit OTP.'); return; }
    if (isNewUser && !profileName.trim()) { setError('Please enter your name to continue.'); return; }
    setLoading(true); setError(null);
    try {
      await auth.verifyOtp({
        phone: activePhone,
        code,
        ...(isNewUser && profileName.trim() ? { name: profileName.trim() } : {}),
      });
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not verify OTP.'); }
    finally { setLoading(false); }
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1 }}>
      <StatusBar style="light" />

      <LinearGradient
        colors={theme.gradients.signIn}
        end={{ x: 0.6, y: 1 }}
        start={{ x: 0.2, y: 0 }}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />

      {/* Brand violet glow — top right */}
      <View
        style={{
          position: 'absolute',
          top: -80,
          right: -60,
          width: 280,
          height: 280,
          borderRadius: 140,
          backgroundColor: theme.colors.brandGlow,
        }}
      />
      {/* Emerald glow — bottom left */}
      <View
        style={{
          position: 'absolute',
          bottom: -60,
          left: -80,
          width: 260,
          height: 260,
          borderRadius: 130,
          backgroundColor: theme.colors.actionGlow,
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}>
          <View style={{ flex: 1, paddingHorizontal: theme.spacing[5], paddingTop: theme.spacing[4], paddingBottom: theme.spacing[8] }}>

            {/* ── Brand mark ── */}
            <View style={{ alignItems: 'center', marginTop: theme.spacing[3], marginBottom: theme.spacing[4] }}>
              {/* Hero illustration */}
              <Image
                source={heroIcon}
                style={{ width: 130, height: 126, resizeMode: 'contain', marginBottom: theme.spacing[3] }}
              />

              {/* Wordmark */}
              <Text style={{ fontFamily: theme.fontFamily.headlineExtra, fontSize: theme.fontSize.display, letterSpacing: -0.8, lineHeight: 36, color: theme.colors.brandBright }}>
                VouchrEx
              </Text>

              {/* Tagline */}
              <Text
                style={{
                  marginTop: theme.spacing[2],
                  fontSize: theme.fontSize.label,
                  lineHeight: 19,
                  textAlign: 'center',
                  fontFamily: theme.fontFamily.body,
                  color: theme.colors.inkMuted,
                  letterSpacing: 0.1,
                }}>
                Buy &amp; sell vouchers.{' '}
                <Text style={{ color: theme.colors.inkSecondary }}>Payment protected.</Text>
              </Text>
            </View>

            {/* ── Form ── */}
            <View style={{ paddingTop: theme.spacing[2] }}>

              <Text
                style={{
                  fontFamily: theme.fontFamily.headlineExtra,
                  fontSize: theme.fontSize.title,
                  color: theme.colors.ink,
                  letterSpacing: -0.4,
                  marginBottom: 6,
                }}>
                {otpRequest ? (isNewUser ? 'Create account' : 'Welcome back') : 'Login or sign up'}
              </Text>

              {/* Purple underline bar — initial state only */}
              {!otpRequest && (
                <View style={{ height: 4, width: 48, backgroundColor: theme.colors.brand, borderRadius: 2, marginBottom: theme.spacing[3] }} />
              )}

              <Text
                style={{
                  fontSize: 14,
                  fontFamily: theme.fontFamily.body,
                  color: theme.colors.inkMuted,
                  marginBottom: theme.spacing[7],
                  lineHeight: 20,
                }}>
                {otpRequest
                  ? `Code sent to ${activePhone}${otpDeadline ? ` · expires ${otpDeadline}` : ''}`
                  : 'OTP is the only login step — no password needed.'}
              </Text>

              {/* Phone input */}
              {!otpRequest ? (
                <View style={{ marginBottom: theme.spacing[6] }}>
                  <View style={styles.underlineRow}>
                    <CountryFlag isoCode="IN" size={20} style={styles.flagIcon} />
                    <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 16, color: theme.colors.ink, marginRight: 10 }}>+91</Text>
                    <View style={[styles.prefixDivider, { backgroundColor: theme.colors.glassBorder }]} />
                    <TextInput
                      keyboardType="phone-pad"
                      maxLength={10}
                      onChangeText={(v) => { setPhoneDigits(normalizeDigits(v)); setError(null); }}
                      placeholder="Mobile number"
                      placeholderTextColor={theme.colors.inkMuted}
                      style={[styles.underlineInput, { fontFamily: theme.fontFamily.label, color: theme.colors.ink }]}
                      value={phoneDigits}
                    />
                  </View>
                  <View style={[styles.underlineLine, { backgroundColor: theme.colors.glassBorder }]} />
                </View>
              ) : (
                <View style={{ gap: theme.spacing[6], marginBottom: theme.spacing[6] }}>
                  {/* Locked phone — show masked number */}
                  <View>
                    <Text style={[styles.fieldLabel, { fontFamily: theme.fontFamily.labelSemi, color: theme.colors.inkMuted }]}>MOBILE</Text>
                    <Text style={{ fontSize: theme.fontSize.heading, fontFamily: theme.fontFamily.label, color: theme.colors.ink, paddingVertical: 10 }}>
                      {activePhone}
                    </Text>
                    <View style={[styles.underlineLine, { backgroundColor: theme.colors.glassBorder }]} />
                  </View>

                  {/* Name — new users only */}
                  {isNewUser ? (
                    <View>
                      <Text style={[styles.fieldLabel, { fontFamily: theme.fontFamily.labelSemi, color: theme.colors.inkMuted }]}>YOUR NAME</Text>
                      <TextInput
                        autoCapitalize="words"
                        autoFocus
                        onChangeText={(v) => { setProfileName(v); setError(null); }}
                        placeholder="Full name"
                        placeholderTextColor={theme.colors.inkMuted}
                        style={[styles.underlineInput, { fontFamily: theme.fontFamily.label, color: theme.colors.ink }]}
                        value={profileName}
                      />
                      <View style={[styles.underlineLine, { backgroundColor: theme.colors.glassBorder }]} />
                    </View>
                  ) : null}

                  {/* OTP */}
                  <View>
                    <Text style={[styles.fieldLabel, { fontFamily: theme.fontFamily.labelSemi, color: theme.colors.inkMuted }]}>OTP CODE</Text>
                    <TextInput
                      autoFocus={!isNewUser}
                      keyboardType="number-pad"
                      maxLength={6}
                      onChangeText={(v) => { setCode(v.replace(/\D/g, '').slice(0, 6)); setError(null); }}
                      placeholder="· · · · · ·"
                      placeholderTextColor={theme.colors.inkMuted}
                      style={[styles.underlineInput, { color: theme.colors.ink }, {
                        letterSpacing: 12,
                        fontSize: 24,
                        fontFamily: theme.fontFamily.mono,
                      }]}
                      value={code}
                    />
                    {/* Active underline turns brand violet */}
                    <View style={[styles.underlineLine, { backgroundColor: theme.colors.glassBorder }, code.length > 0 && { backgroundColor: theme.colors.brand }]} />
                  </View>
                </View>
              )}

              {/* Dev OTP hint */}
              {typeof __DEV__ !== 'undefined' && __DEV__ && otpRequest?.debugCode ? (
                <View
                  style={{
                    alignSelf: 'flex-start',
                    borderRadius: 10,
                    borderWidth: 1,
                    paddingHorizontal: theme.spacing[3],
                    paddingVertical: 6,
                    marginBottom: theme.spacing[4],
                    backgroundColor: theme.colors.glassSurface,
                    borderColor: theme.colors.glassBorder,
                  }}>
                  <Text style={{
                    color: theme.colors.brandBright,
                    fontSize: theme.fontSize.label,
                    fontFamily: theme.fontFamily.mono,
                  }}>
                    Dev OTP: {otpRequest.debugCode}
                  </Text>
                </View>
              ) : null}

              {/* Error */}
              {error ? (
                <View
                  style={{
                    borderRadius: theme.radius.sm,
                    borderWidth: 1,
                    padding: theme.spacing[3],
                    marginBottom: theme.spacing[2],
                    borderColor: theme.colors.dangerSoft,
                    backgroundColor: theme.colors.dangerSoft,
                  }}>
                  <Text style={{
                    color: theme.colors.danger,
                    fontSize: 14,
                    fontFamily: theme.fontFamily.label,
                    lineHeight: 20,
                  }}>
                    {error}
                  </Text>
                </View>
              ) : null}

              <View style={{ marginTop: theme.spacing[2] }}>
                <PrimaryButton
                  label={otpRequest ? 'Verify OTP' : 'Continue'}
                  loading={loading}
                  onPress={() => { void (otpRequest ? handleVerifyOtp() : handleRequestOtp()); }}
                  tone="brand"
                  variant="gradient"
                />
              </View>

              {otpRequest ? (
                <Pressable
                  style={{ alignSelf: 'center', paddingTop: theme.spacing[5] }}
                  onPress={() => { auth.clearOtpRequest(); setCode(''); setError(null); }}>
                  <Text style={{
                    fontSize: 14,
                    fontFamily: theme.fontFamily.labelSemi,
                    color: theme.colors.inkMuted,
                  }}>
                    Change number
                  </Text>
                </Pressable>
              ) : (
                <View style={{ alignItems: 'center', marginTop: theme.spacing[6] }}>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing[2],
                    paddingHorizontal: theme.spacing[4],
                    paddingVertical: 10,
                    borderRadius: theme.radius.pill,
                    backgroundColor: theme.colors.glassSurface,
                    borderWidth: 1,
                    borderColor: theme.colors.glassSurface,
                  }}>
                    <Ionicons name="shield-checkmark" size={14} color={theme.colors.brand} />
                    <Text style={{
                      fontFamily: theme.fontFamily.labelSemi,
                      fontSize: 10,
                      color: theme.colors.inkMuted,
                      letterSpacing: 2,
                      textTransform: 'uppercase',
                    }}>
                      Secure Verification
                    </Text>
                  </View>
                </View>
              )}
            </View>

          </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = {
  fieldLabel: {
    fontSize: 12,
    letterSpacing: 0.8,
    marginBottom: 10,
    textTransform: 'uppercase' as const,
  },
  underlineRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  flagIcon: {
    marginRight: 8,
    borderRadius: 3,
  },
  prefixDivider: {
    width: 1,
    height: 20,
    marginRight: 12,
  },
  underlineInput: {
    fontSize: 18,
    paddingVertical: 8,
    paddingLeft: 2,
    flex: 1,
  } as const,
  underlineLine: {
    height: 1,
    marginTop: 2,
  },
} as const;
