import { ActivityIndicator, Dimensions, FlatList, RefreshControl, StyleSheet } from 'react-native';
import type * as MediaLibrary from 'expo-media-library/legacy';
import { PhotoCard } from './PhotoCard';
import { EmptyState } from './EmptyState';
import { colors, spacing } from '../theme';

const NUM_COLUMNS = 3;
const GUTTER = spacing.xs;
const ITEM_SIZE = (Dimensions.get('window').width - GUTTER * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

type Props = {
  assets: MediaLibrary.Asset[];
  isRefreshing: boolean;
  isFetchingMore: boolean;
  onRefresh: () => void;
  onLoadMore: () => void;
};

export function PhotoGrid({ assets, isRefreshing, isFetchingMore, onRefresh, onLoadMore }: Props) {
  return (
    <FlatList
      data={assets}
      keyExtractor={(asset) => asset.id}
      numColumns={NUM_COLUMNS}
      contentContainerStyle={styles.content}
      columnWrapperStyle={styles.row}
      renderItem={({ item }) => <PhotoCard asset={item} size={ITEM_SIZE} />}
      onEndReachedThreshold={0.5}
      onEndReached={onLoadMore}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      ListEmptyComponent={<EmptyState title="No photos found" message="Photos from your library will appear here." />}
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
