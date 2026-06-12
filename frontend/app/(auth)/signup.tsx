import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
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
import { signupThunk, clearError } from '../../src/store/slices/authSlice';
import { Colors } from '../../src/theme/colors';

type Role = 'CANDIDATE' | 'RECRUITER';

function getPasswordStrength(password: string): { strength: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return { strength: score, label: 'Weak', color: Colors.danger };
  if (score === 2) return { strength: score, label: 'Fair', color: Colors.warning };
  if (score === 3) return { strength: score, label: 'Good', color: Colors.teal };
  return { strength: score, label: 'Strong', color: Colors.success };
}

export default function SignupScreen() {
  const dispatch = useAppDispatch();
  const { loading, error, isAuthenticated, role: authRole } = useAppSelector((s) => s.auth);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role>('CANDIDATE');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  const pwdStrength = getPasswordStrength(password);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (isAuthenticated && authRole) {
      if (authRole === 'RECRUITER') {
        router.replace('/(recruiter)/dashboard');
      } else {
        router.replace('/(candidate)/dashboard');
      }
    }
  }, [isAuthenticated, authRole]);

  const handleSignup = () => {
    if (!fullName.trim() || !email.trim() || !password.trim()) return;
    dispatch(clearError());
    dispatch(
      signupThunk({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        role: selectedRole,
      })
    );
  };

  const RoleCard = ({
    role,
    icon,
    label,
    description,
  }: {
    role: Role;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    description: string;
  }) => {
    const isSelected = selectedRole === role;
    const cardAnim = useRef(new Animated.Value(1)).current;

    const handlePress = () => {
      Animated.sequence([
        Animated.timing(cardAnim, { toValue: 0.95, duration: 80, useNativeDriver: true }),
        Animated.timing(cardAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      ]).start();
      setSelectedRole(role);
    };

    return (
      <Animated.View style={[styles.roleCardWrapper, { transform: [{ scale: cardAnim }] }]}>
        <Pressable
          onPress={handlePress}
          style={[
            styles.roleCard,
            isSelected && styles.roleCardSelected,
          ]}
        >
          {isSelected && (
            <LinearGradient
              colors={['rgba(233,69,96,0.12)', 'rgba(233,69,96,0.04)']}
              style={StyleSheet.absoluteFill}
              borderRadius={14}
            />
          )}
          <View style={[styles.roleIconCircle, isSelected && styles.roleIconCircleSelected]}>
            <Ionicons name={icon} size={26} color={isSelected ? Colors.accent : Colors.textSecondary} />
          </View>
          <Text style={[styles.roleLabel, isSelected && styles.roleLabelSelected]}>{label}</Text>
          <Text style={styles.roleDescription}>{description}</Text>
          {isSelected && (
            <View style={styles.roleCheckBadge}>
              <Ionicons name="checkmark" size={12} color="#fff" />
            </View>
          )}
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <LinearGradient colors={['#0f0f1a', '#1a1a2e', '#16213e']} style={styles.gradient}>
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
            style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
          >
            {/* Logo */}
            <View style={styles.logoWrapper}>
              <LinearGradient colors={['#64ffda', '#00b894']} style={styles.logoCircle}>
                <Text style={styles.logoEmoji}>✨</Text>
              </LinearGradient>
            </View>

            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join the AI Interview Platform</Text>

            {/* Error box */}
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={Colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Full Name */}
            <View style={styles.inputWrapper}>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  placeholderTextColor={Colors.textMuted}
                  value={fullName}
                  onChangeText={(t) => { setFullName(t); dispatch(clearError()); }}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Email */}
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
                />
              </View>
            </View>

            {/* Password + strength */}
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
              {password.length > 0 && (
                <View style={styles.strengthWrapper}>
                  <View style={styles.strengthBar}>
                    {[1, 2, 3, 4].map((i) => (
                      <View
                        key={i}
                        style={[
                          styles.strengthSegment,
                          { backgroundColor: i <= pwdStrength.strength ? pwdStrength.color : Colors.border },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={[styles.strengthLabel, { color: pwdStrength.color }]}>{pwdStrength.label}</Text>
                </View>
              )}
            </View>

            {/* Role selector */}
            <View style={styles.roleSectionWrapper}>
              <Text style={styles.roleSectionTitle}>I am a...</Text>
              <View style={styles.roleCardsRow}>
                <RoleCard
                  role="CANDIDATE"
                  icon="person-outline"
                  label="Job Seeker"
                  description="Attend AI interviews"
                />
                <RoleCard
                  role="RECRUITER"
                  icon="briefcase-outline"
                  label="Recruiter"
                  description="Create & review interviews"
                />
              </View>
            </View>

            {/* Register button */}
            <Pressable onPress={handleSignup} disabled={loading} style={({ pressed }) => [styles.registerBtn, pressed && styles.registerBtnPressed]}>
              <LinearGradient colors={['#e94560', '#c0392b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.registerGradient}>
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.registerBtnText}>Create Account</Text>
                )}
              </LinearGradient>
            </Pressable>

            {/* Login link */}
            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                <Text style={styles.loginLink}>Login</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gradient: { flex: 1 },
  blob1: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(100,255,218,0.06)',
    top: -60,
    left: -60,
  },
  blob2: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(233,69,96,0.06)',
    bottom: 80,
    right: -60,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 60,
  },
  container: { alignItems: 'center' },
  logoWrapper: {
    marginBottom: 20,
    shadowColor: '#64ffda',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmoji: { fontSize: 38 },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textWhite,
    letterSpacing: 0.5,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 28,
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
    marginBottom: 14,
    width: '100%',
    gap: 8,
  },
  errorText: { color: Colors.danger, fontSize: 13, fontWeight: '500', flex: 1 },
  inputWrapper: { width: '100%', marginBottom: 12 },
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
  input: { flex: 1, color: Colors.textPrimary, fontSize: 15, height: '100%' },
  eyeButton: { padding: 4 },
  strengthWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 10,
  },
  strengthBar: { flex: 1, flexDirection: 'row', gap: 4 },
  strengthSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: { fontSize: 12, fontWeight: '600', width: 50 },
  roleSectionWrapper: { width: '100%', marginBottom: 20 },
  roleSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  roleCardsRow: { flexDirection: 'row', gap: 12 },
  roleCardWrapper: { flex: 1 },
  roleCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    minHeight: 120,
  },
  roleCardSelected: {
    borderColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  roleIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  roleIconCircleSelected: { backgroundColor: 'rgba(233,69,96,0.15)' },
  roleLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
    textAlign: 'center',
  },
  roleLabelSelected: { color: Colors.accent },
  roleDescription: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  roleCheckBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerBtn: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 4,
    shadowColor: '#e94560',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  registerBtnPressed: { opacity: 0.85 },
  registerGradient: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  loginRow: { flexDirection: 'row', alignItems: 'center', marginTop: 24 },
  loginText: { color: Colors.textSecondary, fontSize: 14 },
  loginLink: { color: Colors.teal, fontSize: 14, fontWeight: '700' },
});
