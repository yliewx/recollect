import { Pressable, StyleSheet, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { useBootstrapUser } from './src/hooks/useBootstrapUser';
import { LoadingState } from './src/components/LoadingState';
import { EmptyState } from './src/components/EmptyState';
import { colors, spacing, typography } from './src/theme';

export default function App() {
  const bootstrap = useBootstrapUser();

  return (
    <SafeAreaProvider>
      {bootstrap.status === 'loading' && <LoadingState message="Setting up Recollect…" />}
      {bootstrap.status === 'error' && (
        <>
          <EmptyState title="Setup failed" message={bootstrap.message} />
          <Pressable accessibilityRole="button" accessibilityLabel="Retry setup" style={styles.button} onPress={bootstrap.retry}>
            <Text style={styles.buttonText}>Retry</Text>
          </Pressable>
        </>
      )}
      {bootstrap.status === 'ready' && <AppNavigator />}
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.sm,
    alignSelf: 'center',
  },
  buttonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
