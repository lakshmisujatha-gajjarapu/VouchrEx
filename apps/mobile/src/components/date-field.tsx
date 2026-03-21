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
  const [showPicker, setShowPicker] = useState(false);
  const selectedDate = parseDate(value) ?? minimumDate ?? new Date();
  const hasValue = Boolean(value);

  function handleChange(_event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (date) {
      onChange(toIsoDateString(date));
    }
  }

  function handleIosDone() {
    setShowPicker(false);
  }

  return (
    <View className="gap-2">
      <Text
        className="font-label text-caption font-bold uppercase tracking-[0.6px]"
        style={{ color: theme.colors.inkMuted }}>
        {label}
      </Text>

      <Pressable
        onPress={() => { setShowPicker(true); }}
        className="flex-row items-center rounded-app-lg"
        style={({ pressed }) => ({
          backgroundColor: pressed ? theme.colors.brandSoft : theme.colors.surfaceTray,
          borderColor: showPicker ? theme.colors.brandBright : theme.colors.borderStrong,
          borderWidth: 1.5,
          minHeight: 52,
          paddingHorizontal: 14,
          gap: 10,
        })}>
        <Ionicons
          color={theme.colors.brand}
          name="calendar-outline"
          size={20}
        />
        <Text
          className="flex-1 font-label text-body"
          style={{ color: hasValue ? theme.colors.ink : theme.colors.inkMuted }}>
          {hasValue ? value : 'Select date'}
        </Text>
        <Ionicons
          color={theme.colors.inkMuted}
          name="chevron-down"
          size={16}
        />
      </Pressable>

      {/* Android: picker renders inline as a modal dialog */}
      {Platform.OS === 'android' && showPicker ? (
        <DateTimePicker
          display="default"
          minimumDate={minimumDate}
          mode="date"
          onChange={handleChange}
          value={selectedDate}
        />
      ) : null}

      {/* iOS: wrap in a modal with a Done button */}
      {Platform.OS === 'ios' ? (
        <Modal
          animationType="slide"
          transparent
          visible={showPicker}
          onRequestClose={() => { setShowPicker(false); }}>
          <Pressable
            className="flex-1"
            style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
            onPress={() => { setShowPicker(false); }}
          />
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingBottom: 34,
            }}>
            <View
              className="flex-row items-center justify-between px-5 py-3"
              style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
              <Text
                className="font-label text-body font-bold"
                style={{ color: theme.colors.inkMuted }}
                onPress={() => { setShowPicker(false); }}>
                Cancel
              </Text>
              <Text
                className="font-label text-[15px] font-bold"
                style={{ color: theme.colors.brand }}>
                {label}
              </Text>
              <Text
                className="font-label text-body font-bold"
                style={{ color: theme.colors.brand }}
                onPress={handleIosDone}>
                Done
              </Text>
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
    </View>
  );
}
