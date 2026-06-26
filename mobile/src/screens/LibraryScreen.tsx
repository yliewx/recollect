import { useCallback, useLayoutEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { usePhotoLibrary } from '../hooks/usePhotoLibrary';
import { usePhotos } from '../hooks/usePhotos';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { SyncedPhotoGrid } from '../components/SyncedPhotoGrid';
import { SearchBar } from '../components/SearchBar';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';
import { colors, spacing, typography } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Library'>;

const DEBOUNCE_MS = 300;

export function LibraryScreen({ navigation }: Props) {
  const { permission, canAskAgain, requestPermission } = usePhotoLibrary();

  const [captionQuery, setCaptionQuery] = useState('');
  const [tagQuery, setTagQuery] = useState('');
  const debouncedCaption = useDebouncedValue(captionQuery, DEBOUNCE_MS);
  const debouncedTag = useDebouncedValue(tagQuery, DEBOUNCE_MS);
  const hasActiveFilters = captionQuery.trim() !== '' || tagQuery.trim() !== '';

  const { photos, loadState, isFetchingMore, fetchNextPage, refresh } = usePhotos({
    caption: debouncedCaption,
    tag: debouncedTag,
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable accessibilityRole="button" accessibilityLabel="Add photos" onPress={() => navigation.navigate('Import')}>
          <Text style={styles.headerAction}>Add Photos</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

  // refetch the registered photo list whenever this screen regains focus
  // (e.g. after returning from the import picker)
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  if (permission === 'undetermined') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionPrompt}>
          <Text style={styles.title}>Access your photos</Text>
          <Text style={styles.message}>
            Recollect needs permission to view your photo library so you can browse, tag, and organise your photos.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Allow photo access"
            style={styles.button}
            onPress={requestPermission}
          >
            <Text style={styles.buttonText}>Allow Photo Access</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (permission === 'denied') {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          title="Photo access denied"
          message={
            canAskAgain
              ? 'Allow access to your photos to continue.'
              : 'Enable photo access for Recollect in Settings to continue.'
          }
        />
        {!canAskAgain && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Settings"
            style={[styles.button, styles.settingsButton]}
            onPress={() => Linking.openSettings()}
          >
            <Text style={styles.buttonText}>Open Settings</Text>
          </Pressable>
        )}
      </SafeAreaView>
    );
  }

  if (loadState.status === 'loading' && photos.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingState message="Loading your photos…" />
      </SafeAreaView>
    );
  }

  if (loadState.status === 'error') {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState title="Couldn't load photos" message={loadState.message} />
        <Pressable accessibilityRole="button" accessibilityLabel="Retry" style={styles.button} onPress={refresh}>
          <Text style={styles.buttonText}>Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (photos.length === 0 && !hasActiveFilters) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState title="No photos yet" message="Import photos from your library to get started." />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Import photos"
          style={styles.button}
          onPress={() => navigation.navigate('Import')}
        >
          <Text style={styles.buttonText}>Import Photos</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const filterBar = (
    <View style={styles.filterBar}>
      <SearchBar value={captionQuery} onChangeText={setCaptionQuery} />
      <TextInput
        style={styles.tagInput}
        value={tagQuery}
        onChangeText={setTagQuery}
        placeholder="Filter by tags (comma-separated)…"
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        accessibilityLabel="Filter by tags"
      />
    </View>
  );

  if (photos.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
        {filterBar}
        <EmptyState title="No matches" message="Try a different search or tag filter." />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear filters"
          style={styles.button}
          onPress={() => {
            setCaptionQuery('');
            setTagQuery('');
          }}
        >
          <Text style={styles.buttonText}>Clear Filters</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      {filterBar}
      <SyncedPhotoGrid
        photos={photos}
        isRefreshing={loadState.status === 'loading'}
        isFetchingMore={isFetchingMore}
        onRefresh={refresh}
        onLoadMore={fetchNextPage}
        onPressPhoto={(photo) => navigation.navigate('PhotoDetail', { photo })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  filterBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  tagInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  permissionPrompt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  title: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.sm,
    alignSelf: 'center',
  },
  settingsButton: {
    marginTop: spacing.md,
  },
  buttonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  headerAction: {
    ...typography.body,
    color: colors.accent,
    fontWeight: '600',
  },
});
