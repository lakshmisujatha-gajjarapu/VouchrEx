import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';

export function SubmergedInput({
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoCorrect = true,
  rightIcon,
  prefix,
  fontMono = false,
}: {
  readonly value: string;
  readonly onChangeText: (v: string) => void;
  readonly placeholder?: string;
  readonly keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  readonly autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  readonly autoCorrect?: boolean;
  readonly rightIcon?: React.ReactNode;
  readonly prefix?: string;
  readonly fontMono?: boolean;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  // spec: bg-surface-container-high (#231f4a dark), focused → bg-surface-container-highest + ring-primary/20
  const inputBg = focused ? theme.colors.surfaceHighest : theme.colors.surfaceHigh;

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      height: 56,
      borderRadius: 14,
      backgroundColor: inputBg,
      borderWidth: focused ? 1.5 : 0,
      borderColor: focused ? theme.colors.focusRing : theme.colors.transparent,
      shadowColor: theme.colors.brand,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: focused ? 0.12 : 0,
      shadowRadius: 8,
    }}>
      {prefix ? (
        <Text style={{
          paddingLeft: 16,
          fontSize: 16,
          fontWeight: '600',
          fontFamily: theme.fontFamily.labelSemi,
          color: theme.colors.inkSecondary,
        }}>
          {prefix}
        </Text>
      ) : null}
      <TextInput
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        spellCheck={autoCorrect}
        textContentType="none"
        cursorColor={theme.colors.brand}
        keyboardType={keyboardType}
        onBlur={() => { setFocused(false); }}
        onChangeText={onChangeText}
        onFocus={() => { setFocused(true); }}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.inkMuted}
        style={{
          flex: 1,
          height: '100%',
          paddingHorizontal: prefix ? 8 : 16,
          fontSize: fontMono ? 17 : 15,
          fontFamily: fontMono ? theme.fontFamily.mono : theme.fontFamily.body,
          color: theme.colors.ink,
        }}
        value={value}
      />
      {rightIcon ? (
        <View style={{ paddingRight: 16 }}>
          {rightIcon}
        </View>
      ) : null}
    </View>
  );
}
