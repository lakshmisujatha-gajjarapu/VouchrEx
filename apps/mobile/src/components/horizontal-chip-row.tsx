import React from 'react';
import { ScrollView, type StyleProp, type ViewStyle } from 'react-native';

import { FilterChip } from '@/components/filter-chip';
import { useTheme } from '@/theme/ThemeContext';

type HorizontalChipRowProps<T extends string> = {
  readonly options: readonly T[];
  readonly selected: T | undefined;
  readonly onSelect: (value: T) => void;
  readonly labelFor?: (option: T) => string;
  readonly style?: StyleProp<ViewStyle>;
};

export function HorizontalChipRow<T extends string>({
  options,
  selected,
  onSelect,
  labelFor,
  style,
}: HorizontalChipRowProps<T>) {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={style}
      contentContainerStyle={{
        paddingHorizontal: theme.spacing[3],
        gap: theme.spacing[2],
        flexDirection: 'row',
      }}
    >
      {options.map((option) => (
        <FilterChip
          key={option}
          label={labelFor ? labelFor(option) : option}
          selected={selected === option}
          onPress={() => { onSelect(option); }}
        />
      ))}
    </ScrollView>
  );
}
