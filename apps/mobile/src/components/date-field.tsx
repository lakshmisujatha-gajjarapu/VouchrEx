import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';

function toIsoDateString(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${String(y)}-${m}-${d}`;
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDisplayDate(isoDate: string): string {
  const date = parseDate(isoDate);
  if (!date) return '';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function DateField({
  label,
  value,
  onChange,
  minimumDate,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (isoDate: string) => void;
  readonly minimumDate?: Date;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const selectedDate = parseDate(value) ?? minimumDate ?? new Date();
  const hasValue = Boolean(value);

  function handleChange(_event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      setFocused(false);
    }
    if (date) {
      onChange(toIsoDateString(date));
    }
  }

  function handleOpen() {
    setShowPicker(true);
    setFocused(true);
  }

  function handleClose() {
    setShowPicker(false);
    setFocused(false);
  }

  // Match SubmergedInput exactly
  const inputBg = focused ? theme.colors.surfaceHighest : theme.colors.surfaceHigh;

  return (
    <>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        onPress={handleOpen}
        style={{
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
          paddingHorizontal: 16,
          gap: 10,
        }}>
        <Ionicons
          name="calendar-clear-outline"
          size={18}
          color={hasValue ? theme.colors.brand : theme.colors.inkMuted}
        />
        <Text
          style={{
            flex: 1,
            fontFamily: theme.fontFamily.body,
            fontSize: 15,
            color: hasValue ? theme.colors.ink : theme.colors.inkMuted,
            letterSpacing: 0,
          }}>
          {hasValue ? formatDisplayDate(value) : 'Select date'}
        </Text>
        <Ionicons
          name={focused ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={theme.colors.inkMuted}
        />
      </Pressable>

      {/* Android — system dialog */}
      {Platform.OS === 'android' && showPicker ? (
        <DateTimePicker
          display="default"
          minimumDate={minimumDate}
          mode="date"
          onChange={handleChange}
          value={selectedDate}
        />
      ) : null}

      {/* iOS — bottom sheet spinner */}
      {Platform.OS === 'ios' ? (
        <Modal
          animationType="slide"
          onRequestClose={handleClose}
          transparent
          visible={showPicker}>
          <Pressable
            onPress={handleClose}
            style={{ flex: 1, backgroundColor: theme.colors.shadowStrong }}
          />
          <View style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingBottom: 34,
          }}>
            {/* Sheet header */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border,
            }}>
              <Pressable
                onPress={handleClose}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: theme.spacing[1] })}>
                <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 15, color: theme.colors.inkMuted }}>
                  Cancel
                </Text>
              </Pressable>
              <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 15, color: theme.colors.ink }}>
                {label}
              </Text>
              <Pressable
                onPress={handleClose}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: theme.spacing[1] })}>
                <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 15, color: theme.colors.brand }}>
                  Done
                </Text>
              </Pressable>
            </View>

            <DateTimePicker
              display="spinner"
              minimumDate={minimumDate}
              mode="date"
              onChange={handleChange}
              style={{ height: 200 }}
              value={selectedDate}
            />
          </View>
        </Modal>
      ) : null}
    </>
  );
}
