import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, TextInput,
  ActivityIndicator, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { useAppDispatch, useAppSelector } from '../../src/store';
import { logoutThunk } from '../../src/store/slices/authSlice';
import { AuthService } from '../../src/services/authService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function RecruiterProfileScreen() {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.auth);

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [saving, setSaving] = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const initials = (user?.full_name || 'R')
    .split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleSave = async () => {
    if (!fullName.trim()) return;
    setSaving(true);
    try {
      await AuthService.updateProfile({ full_name: fullName.trim() });
      setEditing(false);
      Alert.alert('✅ Saved', 'Profile updated successfully.');
    } catch {
      Alert.alert('Error', 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive',
        onPress: async () => {
          await dispatch(logoutThunk());
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], alignItems: 'center' }}>
          {/* Avatar with teal gradient for recruiter */}
          <LinearGradient colors={['#64ffda', '#00b894']} style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </LinearGradient>
          <Text style={styles.name}>{user?.full_name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          {/* Recruiter badge */}
          <View style={styles.roleBadge}>
            <Ionicons name="briefcase" size={12} color="#0f0f1a" />
            <Text style={styles.roleText}>RECRUITER</Text>
          </View>
        </Animated.View>
      </LinearGradient>

      <View style={styles.body}>
        {/* Info Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Profile Details</Text>
            <TouchableOpacity onPress={() => setEditing(!editing)}>
              <Ionicons name={editing ? 'close' : 'pencil'} size={20} color={Colors.teal} />
            </TouchableOpacity>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Full Name</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholderTextColor={Colors.textSecondary}
                placeholder="Your full name"
              />
            ) : (
              <Text style={styles.fieldValue}>{user?.full_name}</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Email</Text>
            <Text style={styles.fieldValue}>{user?.email}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Role</Text>
            <View style={styles.rolePill}>
              <Ionicons name="briefcase-outline" size={14} color={Colors.teal} />
              <Text style={styles.rolePillText}>Recruiter</Text>
            </View>
          </View>

          {editing && (
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              disabled={saving}
            >
              <LinearGradient colors={['#64ffda', '#00b894']} style={styles.saveBtnGradient}>
                {saving
                  ? <ActivityIndicator color="#0f0f1a" size="small" />
                  : <Text style={styles.saveBtnText}>Save Changes</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        {/* Quick Links */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Navigation</Text>
          {[
            { label: 'View All Interviews', icon: 'document-text-outline', route: '/(recruiter)/interviews' },
            { label: 'View Candidates',     icon: 'people-outline',        route: '/(recruiter)/candidates' },
            { label: 'Dashboard',           icon: 'grid-outline',           route: '/(recruiter)/dashboard'  },
          ].map((link) => (
            <TouchableOpacity
              key={link.label}
              style={styles.quickLink}
              onPress={() => router.push(link.route as any)}
            >
              <Ionicons name={link.icon as any} size={20} color={Colors.teal} />
              <Text style={styles.quickLinkText}>{link.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: Colors.background },
  header:        { paddingBottom: 32, alignItems: 'center', paddingHorizontal: 20 },
  avatar:        { width: 90, height: 90, borderRadius: 45, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText:    { color: '#0f0f1a', fontSize: 32, fontWeight: '700' },
  name:          { color: Colors.textPrimary, fontSize: 22, fontWeight: '700' },
  email:         { color: Colors.textSecondary, fontSize: 14, marginTop: 4 },
  roleBadge:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.teal, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 100, marginTop: 10 },
  roleText:      { color: '#0f0f1a', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  body:          { padding: 20 },
  section:       { backgroundColor: Colors.surface, borderRadius: 14, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: Colors.border },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle:  { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  field:         { marginBottom: 16 },
  fieldLabel:    { color: Colors.textSecondary, fontSize: 12, marginBottom: 4 },
  fieldValue:    { color: Colors.textPrimary, fontSize: 15 },
  input:         { backgroundColor: Colors.card, borderRadius: 10, padding: 12, color: Colors.textPrimary, fontSize: 15, borderWidth: 1, borderColor: Colors.border },
  saveBtn:       { borderRadius: 10, overflow: 'hidden', marginTop: 8 },
  saveBtnGradient: { padding: 14, alignItems: 'center' },
  saveBtnText:   { color: '#0f0f1a', fontWeight: '800', fontSize: 15 },
  rolePill:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(100,255,218,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, alignSelf: 'flex-start', borderWidth: 1, borderColor: Colors.teal },
  rolePillText:  { color: Colors.teal, fontSize: 13, fontWeight: '600' },
  quickLink:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  quickLinkText: { flex: 1, color: Colors.textPrimary, fontSize: 15 },
  logoutBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'rgba(231,76,60,0.1)', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: Colors.danger },
  logoutText:    { color: Colors.danger, fontSize: 16, fontWeight: '700' },
});
