import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect, useRootNavigationState } from 'expo-router';
import { useAppDispatch, useAppSelector } from '../src/store';
import { loadUserThunk } from '../src/store/slices/authSlice';
import { Colors } from '../src/theme/colors';
import { LinearGradient } from 'expo-linear-gradient';

export default function IndexScreen() {
  const dispatch = useAppDispatch();
  const { isAuthenticated, role, user, loading } = useAppSelector((s) => s.auth);
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    dispatch(loadUserThunk());
  }, []);

  // Wait for the Root Layout to be fully mounted before rendering Redirects
  if (!rootNavigationState?.key) {
    return (
      <LinearGradient colors={Colors.gradientPrimary} style={styles.container}>
        <ActivityIndicator color={Colors.teal} size="large" />
      </LinearGradient>
    );
  }

  if (loading) {
    return (
      <LinearGradient colors={Colors.gradientPrimary} style={styles.container}>
        <ActivityIndicator color={Colors.teal} size="large" />
      </LinearGradient>
    );
  }

  if (user && isAuthenticated) {
    if (role === 'RECRUITER') {
      return <Redirect href="/(recruiter)/dashboard" />;
    } else {
      return <Redirect href="/(candidate)/dashboard" />;
    }
  }

  if (user === null && !isAuthenticated && !loading) {
    return <Redirect href="/(auth)/login" />;
  }

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
