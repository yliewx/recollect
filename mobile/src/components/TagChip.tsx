import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

type Props = {
  label: string;
  onRemove?: () => void;
};

export function TagChip({ label, onRemove }: Props) {
  return (
    <View style={styles.chip}>
      <Text style={styles.label}>{label}</Text>
      {onRemove && (
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove tag ${label}`} onPress={onRemove} hitSlop={8}>
          <Text style={styles.remove}>×</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  label: {
    ...typography.caption,
    color: colors.text,
  },
  remove: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
    fontWeight: '700',
  },
});
