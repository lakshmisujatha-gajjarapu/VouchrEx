import React from 'react';
import { Text, TextInput, View } from 'react-native';

import { useTheme } from '@/theme/theme-context';

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  secureTextEntry = false,
  helperText,
  errorText,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly placeholder?: string;
  readonly multiline?: boolean;
  readonly keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  readonly autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  readonly secureTextEntry?: boolean;
  readonly helperText?: string;
  readonly errorText?: string;
}) {
  const theme = useTheme();
  const [isFocused, setIsFocused] = React.useState(false);
  const hasError = Boolean(errorText);

  return (
    <View style={{ gap: 6 }}>
      {/* Stitch label: small uppercase Work Sans */}
      <Text
        style={{
          fontSize: 13,
          fontWeight: '600',
          fontFamily: theme.fontFamily.labelSemi,
          color: hasError ? theme.colors.danger : theme.colors.inkSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
        }}>
        {label}
      </Text>

      {/* Submerged input — Stitch style: surfaceHigh bg, no border, focus glow */}
      <View
        style={{
          borderRadius: 14,
          backgroundColor: isFocused
            ? theme.colors.surface
            : hasError
              ? theme.colors.dangerSoft
              : theme.colors.surfaceHigh,
          borderWidth: isFocused || hasError ? 1.5 : 0,
          borderColor: hasError
            ? theme.colors.danger
            : isFocused
              ? theme.colors.focusRing
              : theme.colors.transparent,
          shadowColor: hasError ? theme.colors.danger : theme.colors.brand,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: isFocused ? 0.15 : 0,
          shadowRadius: 8,
        }}>
        <TextInput
          autoCapitalize={autoCapitalize}
          cursorColor={hasError ? theme.colors.danger : theme.colors.brand}
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={multiline ? 4 : 1}
          onBlur={() => { setIsFocused(false); }}
          onChangeText={onChangeText}
          onFocus={() => { setIsFocused(true); }}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.inkMuted}
          secureTextEntry={secureTextEntry}
          style={[
            {
              minHeight: multiline ? 112 : 56,
              paddingHorizontal: 16,
              paddingVertical: 12,
              fontSize: 15,
              fontFamily: theme.fontFamily.body,
              color: theme.colors.ink,
              backgroundColor: theme.colors.transparent,
            },
            multiline ? { textAlignVertical: 'top' } : null,
          ]}
          value={value}
        />
      </View>

      {errorText ? (
        <Text style={{ fontSize: 12, fontFamily: theme.fontFamily.label, color: theme.colors.danger }}>
          {errorText}
        </Text>
      ) : null}
      {!errorText && helperText ? (
        <Text style={{ fontSize: 12, fontFamily: theme.fontFamily.label, color: theme.colors.inkMuted, fontStyle: 'italic' }}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}
