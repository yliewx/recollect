import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setCurrentUserId, getErrorMessage } from '../api/client';
import { createUser } from '../api/users';

const STORAGE_KEY = 'recollect.userId';

export type BootstrapState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; message: string };

// TODO: placeholder until a real signup/login flow exists. Resolves which user
// this device acts as: an explicit EXPO_PUBLIC_USER_ID env override (handy for
// pointing at a pre-seeded user), otherwise a previously-created id cached on
// this device, otherwise creates a brand new placeholder user on first launch.
export function useBootstrapUser() {
  const [state, setState] = useState<BootstrapState>({ status: 'loading' });

  const bootstrap = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const envUserId = process.env.EXPO_PUBLIC_USER_ID;
      if (envUserId) {
        setCurrentUserId(envUserId);
        setState({ status: 'ready' });
        return;
      }

      const storedUserId = await AsyncStorage.getItem(STORAGE_KEY);
      if (storedUserId) {
        setCurrentUserId(storedUserId);
        setState({ status: 'ready' });
        return;
      }

      const suffix = Math.random().toString(36).slice(2, 10);
      const user = await createUser(`device_${suffix}`, `device_${suffix}@recollect.local`);
      await AsyncStorage.setItem(STORAGE_KEY, user.id);
      setCurrentUserId(user.id);
      setState({ status: 'ready' });
    } catch (err) {
      setState({ status: 'error', message: getErrorMessage(err, 'Failed to set up a local user.') });
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  return { ...state, retry: bootstrap };
}
