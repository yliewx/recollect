import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { usePhotoLibrary } from '../hooks/usePhotoLibrary';
import { PhotoGrid } from '../components/PhotoGrid';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';
import { registerPhotos } from '../api/photos';
import { getErrorMessage } from '../api/client';
import { colors, spacing, typography } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Import'>;

export function ImportScreen({ navigation }: Props) {
  const {
    permission,
    canAskAgain,
    assets,
    loadState,
    isFetchingMore,
    requestPermission,
    fetchNextPage,
    refresh,
    presentLimitedLibraryPicker,
  } = usePhotoLibrary();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleSelect = useCallback((assetId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
  }, []);

  const handleImport = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setIsSubmitting(true);
    try {
      await registerPhotos([...selectedIds].map((asset_id) => ({ asset_id })));
      navigation.goBack();
    } catch (err) {
      Alert.alert('Import failed', getErrorMessage(err, 'Could not import photos. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedIds, navigation]);

  if (permission === 'undetermined' || permission === 'denied') {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          title="Photo access required"
          message={
            permission === 'denied' && !canAskAgain
              ? 'Enable photo access for Recollect in Settings to import photos.'
              : 'Allow access to your photo library to choose photos to import.'
          }
        />
        {!(permission === 'denied' && !canAskAgain) && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Allow photo access"
            style={styles.primaryButton}
            onPress={requestPermission}
          >
            <Text style={styles.primaryButtonText}>Allow Photo Access</Text>
          </Pressable>
        )}
      </SafeAreaView>
    );
  }

  if (loadState.status === 'loading' && assets.length === 0) {
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
        <Pressable accessibilityRole="button" accessibilityLabel="Retry" style={styles.primaryButton} onPress={refresh}>
          <Text style={styles.primaryButtonText}>Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      {permission === 'limited' && (
        <View style={styles.limitedBanner}>
          <Text style={styles.limitedText}>You've given access to a limited selection of photos.</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Select more photos"
            onPress={presentLimitedLibraryPicker}
          >
            <Text style={styles.limitedAction}>Select More</Text>
          </Pressable>
        </View>
      )}
      <PhotoGrid
        assets={assets}
        isRefreshing={loadState.status === 'loading'}
        isFetchingMore={isFetchingMore}
        onRefresh={refresh}
        onLoadMore={fetchNextPage}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
      />
      <View style={styles.confirmBar}>
        <Text style={styles.confirmCount}>{selectedIds.size} selected</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Import ${selectedIds.size} photos`}
          style={[styles.primaryButton, (selectedIds.size === 0 || isSubmitting) && styles.primaryButtonDisabled]}
          disabled={selectedIds.size === 0 || isSubmitting}
          onPress={handleImport}
        >
          <Text style={styles.primaryButtonText}>{isSubmitting ? 'Importing…' : 'Import'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.sm,
    alignSelf: 'center',
    marginTop: spacing.md,
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  limitedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  limitedText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
    marginRight: spacing.sm,
  },
  limitedAction: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
  },
  confirmBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  confirmCount: {
    ...typography.body,
    color: colors.text,
  },
});
