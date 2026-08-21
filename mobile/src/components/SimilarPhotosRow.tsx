import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SyncedPhotoCard } from './SyncedPhotoCard';
import { colors, spacing, typography } from '../theme';
import type { Photo } from '../api/types';
import type { SimilarPhotosLoadState } from '../hooks/useSimilarPhotos';

const ITEM_SIZE = 96;
const GUTTER = spacing.xs;

type Props = {
  photos: Photo[];
  loadState: SimilarPhotosLoadState;
  onRetry: () => void;
  onPressPhoto: (photo: Photo) => void;
};

export function SimilarPhotosRow({ photos, loadState, onRetry, onPressPhoto }: Props) {
  // a quiet, secondary section: hide entirely rather than show empty-state
  // chrome when there's simply nothing to compare against (no matches, or
  // this photo has no on-device embedding yet).
  if (loadState.status === 'loaded' && photos.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Similar Photos</Text>

      {loadState.status === 'loading' && (
        <ActivityIndicator style={styles.stateRow} color={colors.accent} accessibilityRole="progressbar" />
      )}

      {loadState.status === 'error' && (
        <View style={styles.stateRow}>
          <Text style={styles.errorText}>{loadState.message}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Retry loading similar photos" onPress={onRetry}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {loadState.status === 'loaded' && photos.length > 0 && (
        <FlatList
          horizontal
          data={photos}
          keyExtractor={(photo) => photo.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
          renderItem={({ item }) => (
            <SyncedPhotoCard photo={item} size={ITEM_SIZE} onPress={() => onPressPhoto(item)} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingVertical: spacing.md,
  },
  sectionTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  row: {
    gap: GUTTER,
    paddingHorizontal: spacing.md,
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  retryText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
  },
});
