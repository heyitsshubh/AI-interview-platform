import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../src/store';
import { logoutThunk } from '../../src/store/slices/authSlice';
import { fetchHistoryThunk } from '../../src/store/slices/interviewSlice';
import { AuthService } from '../../src/services/authService';
import { Colors } from '../../src/theme/colors';
import { router } from 'expo-router';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function CandidateProfileScreen() {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.auth);
  const { interviews } = useAppSelector((s) => s.interview);

  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    dispatch(fetchHistoryThunk());
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const totalInterviews = interviews.length;
  const completed = interviews.filter((i) => i.status === 'COMPLETED').length;

  const handleSave = async () => {
    if (!fullName.trim() || fullName === user?.full_name) return;
    setSaving(true);
    try {
      await AuthService.updateProfile({ full_name: fullName.trim() });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch {
      Alert.alert('Error', 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            dispatch(logoutThunk()).then(() => {
              router.replace('/(auth)/login');
            });
          },
        },
      ]
    );
  };

  const initials = user?.full_name ? getInitials(user.full_name) : 'U';

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Header gradient */}
          <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.headerGradient}>
            <View style={styles.decCircle} />

            {/* Avatar */}
            <View style={styles.avatarWrapper}>
              <LinearGradient colors={['#e94560', '#c0392b']} style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </LinearGradient>
            </View>

            <Text style={styles.userName}>{user?.full_name ?? 'User'}</Text>
            <Text style={styles.userEmail}>{user?.email ?? ''}</Text>

            {/* Role badge */}
            <View style={styles.roleBadge}>
              <Ionicons name="person" size={12} color={Colors.teal} />
              <Text style={styles.roleBadgeText}>CANDIDATE</Text>
            </View>
          </LinearGradient>

          {/* Stats */}
          <View style={styles.statsRow}>
            <StatChip icon="document-text" label="Total" value={String(totalInterviews)} color={Colors.teal} />
            <StatChip icon="checkmark-circle" label="Completed" value={String(completed)} color={Colors.success} />
            <StatChip icon="time" label="Pending" value={String(totalInterviews - completed)} color={Colors.warning} />
          </View>

          {/* Edit profile */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="create-outline" size={18} color={Colors.teal} />
              <Text style={styles.cardTitle}>Edit Profile</Text>
            </View>

            <Text style={styles.fieldLabel}>Full Name</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your full name"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            <Text style={styles.fieldLabel}>Email</Text>
            <View style={[styles.inputContainer, styles.disabledInput]}>
              <Ionicons name="mail-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
              <Text style={styles.disabledText}>{user?.email}</Text>
            </View>

            {saveSuccess && (
              <View style={styles.successBanner}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                <Text style={styles.successText}>Profile updated successfully!</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.saveBtn, (saving || fullName === user?.full_name || !fullName.trim()) && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving || fullName === user?.full_name || !fullName.trim()}
            >
              <LinearGradient colors={['#64ffda', '#00b894']} style={styles.saveBtnGradient}>
                {saving ? (
                  <ActivityIndicator size="small" color="#0f0f1a" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={18} color="#0f0f1a" />
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Logout */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
            <LinearGradient
              colors={['rgba(231,76,60,0.15)', 'rgba(231,76,60,0.08)']}
              style={styles.logoutBtnGradient}
            >
              <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
              <Text style={styles.logoutBtnText}>Logout</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.versionText}>AI Interview Platform v1.0.0</Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function StatChip({ icon, label, value, color }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.statChip}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 48 },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  decCircle: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(233,69,96,0.08)',
    top: -80,
    right: -60,
  },
  avatarWrapper: {
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#fff' },
  userName: { fontSize: 22, fontWeight: '800', color: Colors.textWhite, marginBottom: 4 },
  userEmail: { fontSize: 14, color: Colors.textSecondary, marginBottom: 12 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(100,255,218,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(100,255,218,0.3)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  roleBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.teal, letterSpacing: 1 },
  statsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: 20, marginBottom: 20 },
  statChip: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 10, color: Colors.textSecondary, fontWeight: '600', textTransform: 'uppercase' },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    gap: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    height: 50,
  },
  disabledInput: { opacity: 0.6 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: Colors.textPrimary, fontSize: 15 },
  disabledText: { flex: 1, color: Colors.textSecondary, fontSize: 15 },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(46,204,113,0.12)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.3)',
  },
  successText: { color: Colors.success, fontSize: 13, fontWeight: '500' },
  saveBtn: { borderRadius: 12, overflow: 'hidden' },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  saveBtnText: { color: '#0f0f1a', fontSize: 15, fontWeight: '700' },
  logoutBtn: {
    marginHorizontal: 20,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(231,76,60,0.3)',
    marginBottom: 24,
  },
  logoutBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  logoutBtnText: { fontSize: 15, fontWeight: '700', color: Colors.danger },
  versionText: { textAlign: 'center', fontSize: 12, color: Colors.textMuted },
});
