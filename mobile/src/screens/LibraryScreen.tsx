import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePhotoLibrary } from '../hooks/usePhotoLibrary';
import { PhotoGrid } from '../components/PhotoGrid';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';
import { colors, spacing, typography } from '../theme';

export function LibraryScreen() {
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
        <Pressable accessibilityRole="button" accessibilityLabel="Retry" style={styles.button} onPress={refresh}>
          <Text style={styles.buttonText}>Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
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
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
});
