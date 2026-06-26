import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LibraryScreen } from '../screens/LibraryScreen';
import { ImportScreen } from '../screens/ImportScreen';
import { PhotoDetailScreen } from '../screens/PhotoDetailScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Library" component={LibraryScreen} options={{ title: 'Library' }} />
        <Stack.Screen
          name="Import"
          component={ImportScreen}
          options={{ title: 'Import Photos', presentation: 'modal' }}
        />
        <Stack.Screen name="PhotoDetail" component={PhotoDetailScreen} options={{ title: 'Photo' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
