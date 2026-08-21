import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';
import type { PhotoSortBy, SortOrder } from '../api/types';

type Props = {
  sortBy: PhotoSortBy;
  order: SortOrder;
  onChange: (sortBy: PhotoSortBy, order: SortOrder) => void;
};

const OPTIONS: { value: PhotoSortBy; label: string }[] = [
  { value: 'uploaded_at', label: 'Date' },
  { value: 'dimensions', label: 'Dimensions' },
  { value: 'size_bytes', label: 'Size' },
];

// tapping the active sort field flips its direction; tapping a different
// field switches to it at the default (descending) direction.
export function SortControl({ sortBy, order, onChange }: Props) {
  return (
    <View style={styles.row}>
      {OPTIONS.map((option) => {
        const isActive = option.value === sortBy;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={`Sort by ${option.label}${isActive ? `, currently ${order === 'desc' ? 'descending' : 'ascending'}` : ''}`}
            style={[styles.chip, isActive && styles.chipActive]}
            onPress={() => onChange(option.value, isActive ? (order === 'desc' ? 'asc' : 'desc') : 'desc')}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {option.label}
              {isActive ? (order === 'desc' ? ' ↓' : ' ↑') : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginRight: spacing.xs,
  },
  chipActive: {
    backgroundColor: colors.accent,
  },
  label: {
    ...typography.caption,
    color: colors.text,
  },
  labelActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
