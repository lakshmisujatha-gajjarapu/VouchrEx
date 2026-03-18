import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Redirect } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { StatusPill } from '@/components/status-pill';
import { useAuth } from '@/hooks/use-auth';

// Sign-in always uses dark gradient background regardless of system theme
const GRADIENT = ['#0D0B1E', '#1A1640', '#2E1F6B'] as const;

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
    return <Redirect href="/(tabs)/bazaar" />;
  }

  const fullPhone = `+91${phoneDigits}`;
  const activePhone = otpRequest?.phone ?? fullPhone;
  const isNewUser = otpRequest?.isNewUser ?? false;
  const otpDeadline = otpRequest
    ? new Date(otpRequest.expiresAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
    : null;
  const ctaLabel = otpRequest ? 'Verify OTP' : 'Continue';

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
        end={{ x: 0.8, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />
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
      <View
        style={{
          position: 'absolute',
          bottom: -60,
          left: -80,
          width: 260,
          height: 260,
          borderRadius: 130,
          backgroundColor: 'rgba(16,185,129,0.10)',
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1">
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View className="flex-1 px-5 pb-8 pt-2">
            <View className="flex-row items-center gap-3">
              <View
                className="h-[38px] w-[38px] items-center justify-center overflow-hidden rounded-[14px] border"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.14)',
                  borderColor: 'rgba(255,255,255,0.35)',
                }}>
                <View
                  className="h-[14px] w-[14px] rounded-full"
                  style={{ backgroundColor: '#A78BFA' }}
                />
              </View>
              <Text className="font-display text-2xl font-extrabold tracking-[-0.3px] text-white">
                CouponBazaar
              </Text>
            </View>

            <View className="mt-7 gap-2">
              <Text className="font-display text-[34px] font-extrabold leading-[38px] tracking-[-0.8px] text-white">
                {otpRequest ? 'Verify OTP' : 'Login or sign up'}
              </Text>
              <Text
                className="max-w-[320px] text-body leading-[22px]"
                style={{ color: 'rgba(255,255,255,0.72)' }}>
                {otpRequest
                  ? `Enter the 6-digit code sent to ${activePhone}${otpDeadline ? ` before ${otpDeadline}` : ''}.`
                  : 'Buy and sell vouchers with your payment held safely until delivery.'}
              </Text>
            </View>

            <View
              className="mt-7 gap-4 overflow-hidden rounded-[28px] border p-5"
              style={{
                borderColor: 'rgba(255,255,255,0.20)',
                shadowColor: 'rgba(0,0,0,0.50)',
                shadowOffset: { width: 0, height: 16 },
                shadowOpacity: 1,
                shadowRadius: 40,
                elevation: 10,
              }}>
              <BlurView
                intensity={50}
                style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
                tint="dark"
              />
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  bottom: 0,
                  left: 0,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                }}
              />

              <Text className="font-display text-title font-extrabold text-white">
                {!otpRequest ? 'Continue with mobile' : isNewUser ? 'Create your account' : 'Welcome back'}
              </Text>
              <Text
                className="text-[14px] leading-5"
                style={{ color: 'rgba(255,255,255,0.60)' }}>
                {!otpRequest
                  ? 'OTP is the only login step for buyers and sellers.'
                  : isNewUser
                    ? 'Enter the OTP and your name to get started.'
                    : `Enter the 6-digit code sent to ${activePhone}.`}
              </Text>

              {!otpRequest ? (
                <View
                  className="flex-row items-center overflow-hidden rounded-[22px] border"
                  style={{
                    borderColor: 'rgba(255,255,255,0.30)',
                    backgroundColor: 'rgba(255,255,255,0.10)',
                  }}>
                  <View
                    className="h-14 justify-center border-r px-4"
                    style={{ borderRightColor: 'rgba(255,255,255,0.16)' }}>
                    <Text className="text-[18px] font-bold text-white">+91</Text>
                  </View>
                  <TextInput
                    keyboardType="phone-pad"
                    maxLength={10}
                    onChangeText={(v) => { setPhoneDigits(normalizeDigits(v)); setError(null); }}
                    placeholder="Enter mobile number"
                    placeholderTextColor="rgba(255,255,255,0.38)"
                    className="h-14 flex-1 px-4 text-[18px] font-semibold text-white"
                    value={phoneDigits}
                  />
                </View>
              ) : (
                <View className="gap-3">
                  <View className="gap-1">
                    <Text
                      className="font-ui text-caption font-extrabold uppercase tracking-[0.6px]"
                      style={{ color: 'rgba(255,255,255,0.55)' }}>
                      Mobile
                    </Text>
                    <Text className="text-[17px] font-bold text-white">{activePhone}</Text>
                  </View>
                  {isNewUser ? (
                    <View
                      className="overflow-hidden rounded-[22px] border"
                      style={{
                        borderColor: 'rgba(255,255,255,0.30)',
                        backgroundColor: 'rgba(255,255,255,0.10)',
                      }}>
                      <TextInput
                        autoCapitalize="words"
                        autoFocus
                        onChangeText={(value) => { setProfileName(value); setError(null); }}
                        placeholder="Your full name"
                        placeholderTextColor="rgba(255,255,255,0.38)"
                        className="h-14 px-4 text-[18px] font-semibold text-white"
                        value={profileName}
                      />
                    </View>
                  ) : null}
                </View>
              )}

              {otpRequest ? (
                <TextInput
                  keyboardType="number-pad"
                  maxLength={6}
                  onChangeText={(v) => { setCode(v.replace(/\D/g, '').slice(0, 6)); setError(null); }}
                  placeholder="123456"
                  placeholderTextColor="rgba(255,255,255,0.38)"
                  className="h-[58px] rounded-[22px] border text-center text-[26px] font-bold tracking-[8px] text-white"
                  style={{
                    borderColor: 'rgba(255,255,255,0.30)',
                    backgroundColor: 'rgba(255,255,255,0.10)',
                  }}
                  value={code}
                />
              ) : null}

              {typeof __DEV__ !== 'undefined' && __DEV__ && otpRequest?.debugCode ? (
                <View
                  className="self-start rounded-[14px] border px-3 py-2"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.10)',
                    borderColor: 'rgba(255,255,255,0.20)',
                  }}>
                  <Text
                    className="text-caption font-bold"
                    style={{ color: 'rgba(255,255,255,0.70)' }}>
                    Dev OTP: {otpRequest.debugCode}
                  </Text>
                </View>
              ) : null}

              {error ? (
                <View
                  className="rounded-[14px] border p-3"
                  style={{
                    borderColor: 'rgba(248,113,113,0.30)',
                    backgroundColor: 'rgba(239,68,68,0.15)',
                  }}>
                  <Text
                    className="text-[14px] font-semibold leading-5"
                    style={{ color: '#FCA5A5' }}>
                    {error}
                  </Text>
                </View>
              ) : null}

              <PrimaryButton
                label={ctaLabel}
                loading={loading}
                onPress={() => { void (otpRequest ? handleVerifyOtp() : handleRequestOtp()); }}
                tone="brand"
              />

              {otpRequest ? (
                <Pressable
                  className="self-center pt-1"
                  onPress={() => { auth.clearOtpRequest(); setCode(''); setError(null); }}>
                  <Text
                    className="text-[14px] font-bold"
                    style={{ color: 'rgba(255,255,255,0.65)' }}>
                    Change number
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <View className="mt-5 flex-row flex-wrap gap-2">
              <StatusPill label="Payment protected" tone="glass" />
              <StatusPill label="Watermarked reveal" tone="glass" />
              <StatusPill label="2h verification" tone="glass" />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
