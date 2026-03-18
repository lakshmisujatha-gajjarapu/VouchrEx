import React from 'react';
import { Text, TextInput, View } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';

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
  const labelColor = hasError
    ? theme.colors.danger
    : isFocused
      ? theme.colors.inkSecondary
      : theme.colors.inkMuted;
  const shellBorderColor = hasError
    ? theme.colors.danger
    : isFocused
      ? theme.colors.borderStrong
      : theme.colors.border;

  return (
    <View className="gap-2">
      <Text
        className="font-ui text-caption font-bold uppercase tracking-[0.6px]"
        style={{ color: labelColor }}>
        {label}
      </Text>
      <View
        className="rounded-app-lg border"
        style={{
          borderColor: shellBorderColor,
          borderWidth: isFocused || hasError ? 1.5 : 1,
          backgroundColor: hasError ? theme.colors.dangerSoft : theme.colors.surfaceTray,
          shadowColor: hasError ? theme.colors.danger : theme.colors.borderStrong,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: isFocused ? 0.2 : 0,
          shadowRadius: 6,
          elevation: isFocused ? 2 : 0,
        }}>
        <TextInput
          autoCapitalize={autoCapitalize}
          cursorColor={hasError ? theme.colors.danger : theme.colors.brand}
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={multiline ? 4 : 1}
          onBlur={() => {
            setIsFocused(false);
          }}
          onChangeText={onChangeText}
          onFocus={() => {
            setIsFocused(true);
          }}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.inkMuted}
          secureTextEntry={secureTextEntry}
          className={multiline ? 'min-h-28 px-4 pb-3 pt-3 font-ui text-body' : 'min-h-[52px] px-4 py-3 font-ui text-body'}
          style={[
            { color: theme.colors.ink, backgroundColor: 'transparent' },
            multiline ? { textAlignVertical: 'top' } : null,
          ]}
          value={value}
        />
      </View>
      {errorText ? (
        <Text
          className="text-caption font-semibold leading-4"
          style={{ color: theme.colors.danger }}>
          {errorText}
        </Text>
      ) : null}
      {!errorText && helperText ? (
        <Text
          className="text-caption leading-4"
          style={{ color: theme.colors.inkMuted }}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}
