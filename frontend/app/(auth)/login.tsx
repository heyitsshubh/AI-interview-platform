import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Pressable,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAppDispatch, useAppSelector } from '../../src/store';
import { loginThunk, clearError } from '../../src/store/slices/authSlice';
import { Colors } from '../../src/theme/colors';

export default function LoginScreen() {
  const dispatch = useAppDispatch();
  const { loading, error, isAuthenticated, role } = useAppSelector((s) => s.auth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Entrance animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (error) {
      // Shake animation on error
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();
    }
  }, [error]);

  useEffect(() => {
    if (isAuthenticated && role) {
      if (role === 'RECRUITER') {
        router.replace('/(recruiter)/dashboard');
      } else {
        router.replace('/(candidate)/dashboard');
      }
    }
  }, [isAuthenticated, role]);

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) return;
    dispatch(clearError());
    dispatch(loginThunk({ email: email.trim().toLowerCase(), password }));
  };

  return (
    <LinearGradient colors={['#0f0f1a', '#1a1a2e', '#16213e']} style={styles.gradient}>
      {/* Decorative blobs */}
      <View style={styles.blob1} />
      <View style={styles.blob2} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.container,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            {/* Logo */}
            <View style={styles.logoWrapper}>
              <LinearGradient
                colors={['#e94560', '#c0392b']}
                style={styles.logoCircle}
              >
                <Text style={styles.logoEmoji}>🎯</Text>
              </LinearGradient>
            </View>

            <Text style={styles.title}>AI Interview Platform</Text>
            <Text style={styles.subtitle}>Sign in to continue</Text>

            {/* Error box */}
            {error ? (
              <Animated.View
                style={[styles.errorBox, { transform: [{ translateX: shakeAnim }] }]}
              >
                <Ionicons name="alert-circle" size={16} color={Colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </Animated.View>
            ) : null}

            {/* Email input */}
            <View style={styles.inputWrapper}>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email address"
                  placeholderTextColor={Colors.textMuted}
                  value={email}
                  onChangeText={(t) => { setEmail(t); dispatch(clearError()); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>
            </View>

            {/* Password input */}
            <View style={styles.inputWrapper}>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={Colors.textMuted}
                  value={password}
                  onChangeText={(t) => { setPassword(t); dispatch(clearError()); }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeButton}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={Colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Login Button */}
            <Pressable onPress={handleLogin} disabled={loading} style={({ pressed }) => [styles.loginBtn, pressed && styles.loginBtnPressed]}>
              <LinearGradient colors={['#e94560', '#c0392b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.loginGradient}>
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.loginBtnText}>Login</Text>
                )}
              </LinearGradient>
            </Pressable>

            {/* Sign up link */}
            <View style={styles.signupRow}>
              <Text style={styles.signupText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
                <Text style={styles.signupLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

// TextInput imported separately to avoid naming conflicts
import { TextInput } from 'react-native';

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gradient: { flex: 1 },
  blob1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(233,69,96,0.08)',
    top: -80,
    right: -80,
  },
  blob2: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(100,255,218,0.05)',
    bottom: 100,
    left: -80,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 60,
  },
  container: { alignItems: 'center' },
  logoWrapper: {
    marginBottom: 24,
    shadowColor: '#e94560',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  logoCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmoji: { fontSize: 42 },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textWhite,
    letterSpacing: 0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 32,
    textAlign: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(231,76,60,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(231,76,60,0.4)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    width: '100%',
    gap: 8,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  inputWrapper: { width: '100%', marginBottom: 14 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    height: '100%',
  },
  eyeButton: { padding: 4 },
  loginBtn: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: '#e94560',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  loginBtnPressed: { opacity: 0.85 },
  loginGradient: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  signupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
  },
  signupText: { color: Colors.textSecondary, fontSize: 14 },
  signupLink: { color: Colors.teal, fontSize: 14, fontWeight: '700' },
});
