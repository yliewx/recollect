import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LibraryScreen } from './src/screens/LibraryScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <LibraryScreen />
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
