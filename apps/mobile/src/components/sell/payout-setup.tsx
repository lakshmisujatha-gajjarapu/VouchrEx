import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { FieldLabel } from '@/components/field-label';
import { SubmergedInput } from '@/components/submerged-input';
import { api, type PayoutAccount } from '@/lib/api';
import { useTheme } from '@/theme/theme-context';

type Props = {
  readonly sessionToken: string;
  readonly onComplete: (account: PayoutAccount) => void;
};

export function PayoutSetup({ sessionToken, onComplete }: Props) {
  const theme = useTheme();
  const [upiInput, setUpiInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister() {
    if (!upiInput.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const account = await api.registerPayoutAccount(sessionToken, {
        type: 'UPI',
        upiId: upiInput.trim(),
      });
      onComplete(account);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not register UPI. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: theme.spacing[5],
        paddingBottom: 32,
        justifyContent: 'center',
      }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <View style={{ alignItems: 'center', marginBottom: 32 }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: theme.colors.brandSoft,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: theme.spacing[5],
          }}>
          <Ionicons name="wallet-outline" size={34} color={theme.colors.brand} />
        </View>
        <Text
          style={{
            fontFamily: theme.fontFamily.headlineExtra,
            fontSize: 26,
            fontWeight: '800',
            letterSpacing: -0.5,
            color: theme.colors.ink,
            textAlign: 'center',
            marginBottom: 10,
          }}>
          Where should we send your money?
        </Text>
        <Text
          style={{
            fontFamily: theme.fontFamily.body,
            fontSize: 15,
            color: theme.colors.inkSecondary,
            textAlign: 'center',
            lineHeight: 22,
            maxWidth: 300,
          }}>
          Add your UPI ID once. Every sale credits your account automatically — no hassle.
        </Text>
      </View>

      <View style={{ gap: theme.spacing[3] }}>
        <FieldLabel>Your UPI ID</FieldLabel>
        <SubmergedInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          onChangeText={setUpiInput}
          placeholder="9876543210@ybl or name@okaxis"
          rightIcon={<Ionicons name="at-outline" size={20} color={theme.colors.inkMuted} />}
          value={upiInput}
        />
        <Text
          style={{
            fontSize: 12,
            fontFamily: theme.fontFamily.label,
            color: theme.colors.inkMuted,
            fontStyle: 'italic',
          }}>
          Find your UPI ID in PhonePe, GPay, or Paytm under Profile → UPI ID.
        </Text>

        {error ? (
          <Text
            style={{
              fontSize: 13,
              fontFamily: theme.fontFamily.labelSemi,
              color: theme.colors.danger,
              textAlign: 'center',
            }}>
            {error}
          </Text>
        ) : null}

        <Pressable
          disabled={!upiInput.trim() || submitting}
          onPress={() => {
            void handleRegister();
          }}
          style={({ pressed }) => ({
            opacity: !upiInput.trim() || submitting ? 0.5 : pressed ? 0.88 : 1,
            borderRadius: 16,
            overflow: 'hidden',
            marginTop: theme.spacing[2],
            shadowColor: theme.colors.brand,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: upiInput.trim() ? 0.25 : 0,
            shadowRadius: 16,
          })}>
          <View
            style={{
              height: 56,
              borderRadius: 16,
              backgroundColor: theme.colors.brand,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.spacing[2],
            }}>
            {submitting ? (
              <ActivityIndicator color={theme.colors.surface} />
            ) : (
              <>
                <Text
                  style={{
                    color: theme.colors.surface,
                    fontSize: 16,
                    fontWeight: '700',
                    fontFamily: theme.fontFamily.labelSemi,
                  }}>
                  Save UPI & Continue
                </Text>
                <Ionicons name="arrow-forward" size={18} color={theme.colors.surface} />
              </>
            )}
          </View>
        </Pressable>
      </View>

      <View
        style={{
          marginTop: 28,
          flexDirection: 'row',
          gap: 10,
          backgroundColor: theme.colors.surfaceRaised,
          borderRadius: theme.radius.sm,
          padding: 14,
          alignItems: 'flex-start',
        }}>
        <Ionicons
          name="shield-checkmark-outline"
          size={16}
          color={theme.colors.brand}
          style={{ marginTop: 1 }}
        />
        <Text
          style={{
            flex: 1,
            fontSize: 13,
            fontFamily: theme.fontFamily.body,
            color: theme.colors.inkSecondary,
            lineHeight: 19,
          }}>
          Your UPI ID is stored securely and only used to credit your earnings. We never debit your
          account.
        </Text>
      </View>
    </ScrollView>
  );
}
