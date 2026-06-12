import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAppDispatch, useAppSelector } from '../src/store';
import { loadUserThunk } from '../src/store/slices/authSlice';
import { Colors } from '../src/theme/colors';
import { LinearGradient } from 'expo-linear-gradient';

export default function IndexScreen() {
  const dispatch = useAppDispatch();
  const { isAuthenticated, role, user } = useAppSelector((s) => s.auth);

  useEffect(() => {
    const bootstrap = async () => {
      await dispatch(loadUserThunk());
    };
    bootstrap();
  }, []);

  useEffect(() => {
    if (user && isAuthenticated) {
      if (role === 'RECRUITER') {
        router.replace('/(recruiter)/dashboard');
      } else {
        router.replace('/(candidate)/dashboard');
      }
    } else if (user === null && !isAuthenticated) {
      // Give it a moment for persist rehydration
      const timer = setTimeout(() => {
        router.replace('/(auth)/login');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, role, user]);

  return (
    <LinearGradient colors={Colors.gradientPrimary} style={styles.container}>
      <ActivityIndicator color={Colors.teal} size="large" />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
