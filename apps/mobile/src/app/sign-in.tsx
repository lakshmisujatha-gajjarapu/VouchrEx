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

import heroIcon from '../../assets/images/hero-icon.png';

import { PrimaryButton } from '@/components/primary-button';
import { useAuth } from '@/hooks/use-auth';

// Design system dark gradient: background → surfaceRaised → brandSoft
const GRADIENT = ['#0D0B1E', '#1A173D', '#2E1F6B'] as const;

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
        colors={GRADIENT}
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
          backgroundColor: 'rgba(167,139,250,0.15)',
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
          backgroundColor: 'rgba(52,211,153,0.08)',
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}>
          <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 }}>

            {/* ── Brand mark ── */}
            <View style={{ alignItems: 'center', marginTop: 12, marginBottom: 16 }}>
              {/* Hero illustration */}
              <Image
                source={heroIcon}
                style={{ width: 130, height: 126, resizeMode: 'contain', marginBottom: 12 }}
              />

              {/* Wordmark */}
              <Text style={{ fontFamily: 'Manrope_800ExtraBold', fontSize: 32, letterSpacing: -0.8, lineHeight: 36, color: '#D0BCFF' }}>
                VouchrEx
              </Text>

              {/* Tagline */}
              <Text
                style={{
                  marginTop: 8,
                  fontSize: 13,
                  lineHeight: 19,
                  textAlign: 'center',
                  fontFamily: 'WorkSans_400Regular',
                  color: 'rgba(255,255,255,0.52)',
                  letterSpacing: 0.1,
                }}>
                Buy &amp; sell vouchers.{' '}
                <Text style={{ color: 'rgba(255,255,255,0.72)' }}>Payment protected.</Text>
              </Text>
            </View>

            {/* ── Form ── */}
            <View style={{ paddingTop: 8 }}>

              <Text
                style={{
                  fontFamily: 'Manrope_800ExtraBold',
                  fontSize: 22,
                  color: '#F5F3FF',
                  letterSpacing: -0.4,
                  marginBottom: 6,
                }}>
                {otpRequest ? (isNewUser ? 'Create account' : 'Welcome back') : 'Login or sign up'}
              </Text>

              {/* Purple underline bar — initial state only */}
              {!otpRequest && (
                <View style={{ height: 4, width: 48, backgroundColor: '#A78BFA', borderRadius: 2, marginBottom: 12 }} />
              )}

              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'WorkSans_400Regular',
                  color: 'rgba(255,255,255,0.48)',
                  marginBottom: 28,
                  lineHeight: 20,
                }}>
                {otpRequest
                  ? `Code sent to ${activePhone}${otpDeadline ? ` · expires ${otpDeadline}` : ''}`
                  : 'OTP is the only login step — no password needed.'}
              </Text>

              {/* Phone input */}
              {!otpRequest ? (
                <View style={{ marginBottom: 24 }}>
                  <View style={styles.underlineRow}>
                    <CountryFlag isoCode="IN" size={20} style={styles.flagIcon} />
                    <Text style={{ fontFamily: 'WorkSans_600SemiBold', fontSize: 16, color: '#F5F3FF', marginRight: 10 }}>+91</Text>
                    <View style={styles.prefixDivider} />
                    <TextInput
                      keyboardType="phone-pad"
                      maxLength={10}
                      onChangeText={(v) => { setPhoneDigits(normalizeDigits(v)); setError(null); }}
                      placeholder="Mobile number"
                      placeholderTextColor="rgba(255,255,255,0.30)"
                      style={styles.underlineInput}
                      value={phoneDigits}
                    />
                  </View>
                  <View style={styles.underlineLine} />
                </View>
              ) : (
                <View style={{ gap: 24, marginBottom: 24 }}>
                  {/* Locked phone — show masked number */}
                  <View>
                    <Text style={styles.fieldLabel}>MOBILE</Text>
                    <Text style={{ fontSize: 18, fontFamily: 'WorkSans_500Medium', color: '#F5F3FF', paddingVertical: 10 }}>
                      {activePhone}
                    </Text>
                    <View style={styles.underlineLine} />
                  </View>

                  {/* Name — new users only */}
                  {isNewUser ? (
                    <View>
                      <Text style={styles.fieldLabel}>YOUR NAME</Text>
                      <TextInput
                        autoCapitalize="words"
                        autoFocus
                        onChangeText={(v) => { setProfileName(v); setError(null); }}
                        placeholder="Full name"
                        placeholderTextColor="rgba(255,255,255,0.22)"
                        style={styles.underlineInput}
                        value={profileName}
                      />
                      <View style={styles.underlineLine} />
                    </View>
                  ) : null}

                  {/* OTP */}
                  <View>
                    <Text style={styles.fieldLabel}>OTP CODE</Text>
                    <TextInput
                      autoFocus={!isNewUser}
                      keyboardType="number-pad"
                      maxLength={6}
                      onChangeText={(v) => { setCode(v.replace(/\D/g, '').slice(0, 6)); setError(null); }}
                      placeholder="· · · · · ·"
                      placeholderTextColor="rgba(255,255,255,0.22)"
                      style={[styles.underlineInput, {
                        letterSpacing: 12,
                        fontSize: 24,
                        fontFamily: 'JetBrainsMono_500Medium',
                      }]}
                      value={code}
                    />
                    {/* Active underline turns brand violet */}
                    <View style={[styles.underlineLine, code.length > 0 && { backgroundColor: '#A78BFA' }]} />
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
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    marginBottom: 16,
                    backgroundColor: 'rgba(167,139,250,0.12)',
                    borderColor: 'rgba(167,139,250,0.25)',
                  }}>
                  <Text style={{
                    color: '#C4B5FD',
                    fontSize: 13,
                    fontFamily: 'JetBrainsMono_500Medium',
                  }}>
                    Dev OTP: {otpRequest.debugCode}
                  </Text>
                </View>
              ) : null}

              {/* Error */}
              {error ? (
                <View
                  style={{
                    borderRadius: 12,
                    borderWidth: 1,
                    padding: 12,
                    marginBottom: 8,
                    borderColor: 'rgba(248,113,113,0.28)',
                    backgroundColor: 'rgba(147,0,10,0.30)',
                  }}>
                  <Text style={{
                    color: '#FFB4AB',
                    fontSize: 14,
                    fontFamily: 'WorkSans_500Medium',
                    lineHeight: 20,
                  }}>
                    {error}
                  </Text>
                </View>
              ) : null}

              <View style={{ marginTop: 8 }}>
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
                  style={{ alignSelf: 'center', paddingTop: 20 }}
                  onPress={() => { auth.clearOtpRequest(); setCode(''); setError(null); }}>
                  <Text style={{
                    fontSize: 14,
                    fontFamily: 'WorkSans_600SemiBold',
                    color: 'rgba(255,255,255,0.44)',
                  }}>
                    Change number
                  </Text>
                </Pressable>
              ) : (
                <View style={{ alignItems: 'center', marginTop: 24 }}>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 999,
                    backgroundColor: 'rgba(27,22,58,0.6)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.08)',
                  }}>
                    <Ionicons name="shield-checkmark" size={14} color="#A78BFA" />
                    <Text style={{
                      fontFamily: 'WorkSans_600SemiBold',
                      fontSize: 10,
                      color: 'rgba(255,255,255,0.5)',
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
    fontFamily: 'WorkSans_600SemiBold',
    color: 'rgba(255,255,255,0.38)',
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
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginRight: 12,
  },
  underlineInput: {
    fontSize: 18,
    fontFamily: 'WorkSans_500Medium',
    color: '#F5F3FF',
    paddingVertical: 8,
    paddingLeft: 2,
    flex: 1,
  } as const,
  underlineLine: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginTop: 2,
  },
} as const;
