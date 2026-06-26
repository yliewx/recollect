import { ActivityIndicator, Dimensions, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { SyncedPhotoCard } from './SyncedPhotoCard';
import { EmptyState } from './EmptyState';
import { colors, spacing } from '../theme';
import type { Photo } from '../api/types';

const NUM_COLUMNS = 3;
const GUTTER = spacing.xs;
const ITEM_SIZE = (Dimensions.get('window').width - GUTTER * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

type Props = {
  photos: Photo[];
  isRefreshing: boolean;
  isFetchingMore: boolean;
  onRefresh: () => void;
  onLoadMore: () => void;
  onPressPhoto?: (photo: Photo) => void;
};

export function SyncedPhotoGrid({
  photos,
  isRefreshing,
  isFetchingMore,
  onRefresh,
  onLoadMore,
  onPressPhoto,
}: Props) {
  return (
    <FlatList
      data={photos}
      keyExtractor={(photo) => photo.id}
      numColumns={NUM_COLUMNS}
      contentContainerStyle={styles.content}
      columnWrapperStyle={styles.row}
      renderItem={({ item }) => (
        <SyncedPhotoCard photo={item} size={ITEM_SIZE} onPress={onPressPhoto ? () => onPressPhoto(item) : undefined} />
      )}
      onEndReachedThreshold={0.5}
      onEndReached={onLoadMore}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      ListEmptyComponent={<EmptyState title="No photos yet" message="Import photos to get started." />}
      ListFooterComponent={isFetchingMore ? <ActivityIndicator style={styles.footer} color={colors.accent} /> : null}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    padding: GUTTER,
    flexGrow: 1,
  },
  row: {
    gap: GUTTER,
    marginBottom: GUTTER,
  },
  footer: {
    marginVertical: spacing.md,
  },
});
