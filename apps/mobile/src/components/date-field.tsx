import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';

import { useTheme } from '@/theme/theme-context';

type AppTheme = ReturnType<typeof useTheme>;

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

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function buildMonthGrid(viewMonth: Date): Date[] {
  const firstOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  // Monday-start week: convert getDay() (0=Sun..6=Sat) → 0=Mon..6=Sun
  const leadOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - leadOffset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

function CalendarPopover({
  theme,
  value,
  onSelect,
  onClose,
  minimumDate,
  anchor,
}: {
  readonly theme: AppTheme;
  readonly value: string;
  readonly onSelect: (isoDate: string) => void;
  readonly onClose: () => void;
  readonly minimumDate?: Date;
  readonly anchor: { top: number; left: number };
}) {
  const selected = parseDate(value);
  const today = startOfDay(new Date());
  const minDay = minimumDate ? startOfDay(minimumDate) : null;
  const [viewMonth, setViewMonth] = useState(() => {
    const base = selected ?? minimumDate ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const days = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);

  function shiftMonth(delta: number) {
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  return (
    <View
      style={{
        position: 'fixed' as unknown as 'absolute',
        top: anchor.top,
        left: anchor.left,
        zIndex: 10000,
        width: 296,
        backgroundColor: theme.colors.surfaceRaised,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: theme.spacing[3],
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.35,
        shadowRadius: 24,
      }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: theme.spacing[2],
        paddingHorizontal: theme.spacing[1],
      }}>
        <Text style={{
          fontFamily: theme.fontFamily.labelSemi,
          fontSize: 14,
          fontWeight: '600',
          color: theme.colors.ink,
        }}>
          {MONTH_NAMES[viewMonth.getMonth()]} {String(viewMonth.getFullYear())}
        </Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <Pressable
            accessibilityLabel="Previous month"
            accessibilityRole="button"
            onPress={() => { shiftMonth(-1); }}
            style={({ pressed }) => ({
              width: 28, height: 28, borderRadius: 6,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: pressed ? theme.colors.surfaceHigh : 'transparent',
            })}>
            <Ionicons name="chevron-back" size={16} color={theme.colors.inkSecondary} />
          </Pressable>
          <Pressable
            accessibilityLabel="Next month"
            accessibilityRole="button"
            onPress={() => { shiftMonth(1); }}
            style={({ pressed }) => ({
              width: 28, height: 28, borderRadius: 6,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: pressed ? theme.colors.surfaceHigh : 'transparent',
            })}>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.inkSecondary} />
          </Pressable>
        </View>
      </View>

      {/* Weekday header */}
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAYS.map((wd, i) => (
          <View key={String(i)} style={{ width: 36, alignItems: 'center', paddingVertical: 4 }}>
            <Text style={{
              fontFamily: theme.fontFamily.label,
              fontSize: 10,
              fontWeight: '600',
              color: theme.colors.inkMuted,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}>
              {wd}
            </Text>
          </View>
        ))}
      </View>

      {/* Day grid */}
      {Array.from({ length: 6 }, (_, row) => (
        <View key={String(row)} style={{ flexDirection: 'row' }}>
          {days.slice(row * 7, row * 7 + 7).map((day) => {
            const dayStart = startOfDay(day);
            const inMonth = day.getMonth() === viewMonth.getMonth();
            const isSelected = selected ? dayStart.getTime() === startOfDay(selected).getTime() : false;
            const isToday = dayStart.getTime() === today.getTime();
            const disabled = minDay ? dayStart.getTime() < minDay.getTime() : false;
            const iso = toIsoDateString(day);

            let textColor: string = theme.colors.ink;
            if (disabled || !inMonth) textColor = theme.colors.inkMuted;
            if (isSelected) textColor = '#FFFFFF';

            return (
              <Pressable
                key={iso}
                accessibilityLabel={day.toDateString()}
                accessibilityRole="button"
                disabled={disabled}
                onPress={() => { onSelect(iso); }}
                style={({ pressed }) => ({
                  width: 36,
                  height: 32,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                  backgroundColor: isSelected
                    ? theme.colors.brand
                    : pressed && !disabled
                      ? theme.colors.surfaceHigh
                      : 'transparent',
                  borderWidth: isToday && !isSelected ? 1 : 0,
                  borderColor: theme.colors.brand,
                  opacity: disabled ? 0.35 : 1,
                })}>
                <Text style={{
                  fontFamily: theme.fontFamily.body,
                  fontSize: 12,
                  fontWeight: isSelected || isToday ? '700' : '500',
                  color: textColor,
                }}>
                  {String(day.getDate())}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}

      {/* Footer */}
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: theme.spacing[2],
        paddingTop: theme.spacing[2],
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
      }}>
        <Pressable
          onPress={() => {
            const base = minDay && today.getTime() < minDay.getTime() ? minDay : today;
            onSelect(toIsoDateString(base));
          }}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: theme.spacing[1] })}>
          <Text style={{
            fontFamily: theme.fontFamily.labelSemi,
            fontSize: 12,
            fontWeight: '600',
            color: theme.colors.brand,
          }}>
            Today
          </Text>
        </Pressable>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: theme.spacing[1] })}>
          <Text style={{
            fontFamily: theme.fontFamily.labelSemi,
            fontSize: 12,
            fontWeight: '600',
            color: theme.colors.inkSecondary,
          }}>
            Close
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function WebDateField({
  label,
  value,
  onChange,
  minimumDate,
  setFocused,
  trigger,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (isoDate: string) => void;
  readonly minimumDate?: Date;
  readonly focused: boolean;
  readonly setFocused: (v: boolean) => void;
  readonly trigger: React.ReactElement;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<View | null>(null);

  function openPicker() {
    const node = triggerRef.current as unknown as HTMLElement | null;
    if (node && typeof node.getBoundingClientRect === 'function') {
      const r = node.getBoundingClientRect();
      const popoverWidth = 296;
      const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : r.right;
      const left = Math.max(8, Math.min(r.left, viewportWidth - popoverWidth - 8));
      setAnchor({ top: r.bottom + 6, left });
    }
    setFocused(true);
    setOpen(true);
  }

  function closePicker() {
    setFocused(false);
    setOpen(false);
  }

  function handleSelect(iso: string) {
    onChange(iso);
    closePicker();
  }

  const popover = open && anchor ? (
    <>
      <Pressable
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onPress={closePicker}
        style={{
          position: 'fixed' as unknown as 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 9999,
        }}
      />
      <CalendarPopover
        anchor={anchor}
        minimumDate={minimumDate}
        onClose={closePicker}
        onSelect={handleSelect}
        theme={theme}
        value={value}
      />
    </>
  ) : null;

  // Lazy-load createPortal so non-web builds don't pull react-dom.
  let portal: React.ReactNode = null;
  if (popover && typeof document !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const reactDom = require('react-dom') as { createPortal: (n: React.ReactNode, c: Element) => React.ReactNode };
    portal = reactDom.createPortal(popover, document.body);
  }

  return (
    <View ref={triggerRef}>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        onPress={openPicker}>
        <View pointerEvents="none">{trigger}</View>
      </Pressable>
      {portal}
    </View>
  );
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

  const trigger = (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={Platform.OS === 'web' ? undefined : handleOpen}
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
  );

  if (Platform.OS === 'web') {
    return <WebDateField {...{ label, value, onChange, minimumDate, focused, setFocused, trigger }} />;
  }

  return (
    <>
      {trigger}

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
