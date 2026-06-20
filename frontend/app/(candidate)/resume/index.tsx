import React, { useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAppDispatch, useAppSelector } from '../../../src/store';
import { fetchResumesThunk, deleteResumeThunk } from '../../../src/store/slices/resumeSlice';
import { Resume } from '../../../src/services/resumeService';
import { Colors } from '../../../src/theme/colors';
import { Alert } from 'react-native';

function getStatusConfig(status: Resume['status']): { color: string; bg: string; label: string; icon: keyof typeof Ionicons.glyphMap } {
  switch (status) {
    case 'DONE':
      return { color: Colors.success, bg: `${Colors.success}20`, label: 'Ready', icon: 'checkmark-circle' };
    case 'PROCESSING':
      return { color: Colors.info, bg: `${Colors.info}20`, label: 'Processing', icon: 'sync' };
    case 'PENDING':
      return { color: Colors.warning, bg: `${Colors.warning}20`, label: 'Pending', icon: 'time' };
    case 'FAILED':
      return { color: Colors.danger, bg: `${Colors.danger}20`, label: 'Failed', icon: 'close-circle' };
    default:
      return { color: Colors.textSecondary, bg: Colors.card, label: status, icon: 'document' };
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ResumeCard({ resume, index, onDelete }: { resume: Resume; index: number; onDelete: (id: string) => void }) {
  const config = getStatusConfig(resume.status);
  const anim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 400,
      delay: index * 80,
      useNativeDriver: true,
    }).start();

    if (resume.status === 'PROCESSING') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [resume.status]);

  return (
    <Animated.View
      style={[
        styles.resumeCard,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        },
      ]}
    >
      <View style={styles.resumeCardLeft}>
        <View style={styles.fileIconWrapper}>
          <LinearGradient colors={['#e94560', '#c0392b']} style={styles.fileIconGradient}>
            <Ionicons name="document-text" size={22} color="#fff" />
          </LinearGradient>
        </View>
        <View style={styles.resumeInfo}>
          <Text style={styles.resumeFileName} numberOfLines={1}>
            {resume.original_filename}
          </Text>
          <Text style={styles.resumeDate}>
            {new Date(resume.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </Text>
          {resume.status === 'DONE' && (
            <Text style={styles.readyText}>✅ Ready for interviews</Text>
          )}
          {resume.status === 'PROCESSING' && (
            <View style={styles.processingRow}>
              <Animated.View style={{ opacity: pulseAnim }}>
                <ActivityIndicator size="small" color={Colors.info} />
              </Animated.View>
              <Text style={styles.processingText}>Processing...</Text>
            </View>
          )}
        </View>
      </View>
      
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Animated.View style={[styles.statusBadge, { backgroundColor: config.bg, opacity: resume.status === 'PROCESSING' ? pulseAnim : 1 }]}>
          <Ionicons name={config.icon} size={14} color={config.color} />
          <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
        </Animated.View>
        
        <TouchableOpacity onPress={() => onDelete(resume.id)} style={{ padding: 4 }}>
          <Ionicons name="trash-outline" size={20} color={Colors.danger} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

export default function ResumeListScreen() {
  const dispatch = useAppDispatch();
  const { resumes, loading } = useAppSelector((s) => s.resume);

  useEffect(() => {
    dispatch(fetchResumesThunk());
  }, []);

  const onRefresh = useCallback(() => {
    dispatch(fetchResumesThunk());
  }, [dispatch]);

  const handleDelete = useCallback((id: string) => {
    Alert.alert(
      "Delete Resume",
      "Are you sure you want to delete this resume? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: () => dispatch(deleteResumeThunk(id))
        }
      ]
    );
  }, [dispatch]);

  return (
    <View style={styles.root}>
      {/* Header */}
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>My Resumes</Text>
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={() => router.push('/(candidate)/resume/upload')}
          >
            <LinearGradient colors={['#e94560', '#c0392b']} style={styles.uploadBtnGradient}>
              <Ionicons name="cloud-upload" size={18} color="#fff" />
              <Text style={styles.uploadBtnText}>Upload</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <FlatList
        data={resumes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, resumes.length === 0 && styles.emptyList]}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
        renderItem={({ item, index }) => <ResumeCard resume={item} index={index} onDelete={handleDelete} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrapper}>
                <Ionicons name="cloud-upload-outline" size={52} color={Colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No resumes yet</Text>
              <Text style={styles.emptySubtitle}>Upload your PDF resume to get started with AI interviews</Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => router.push('/(candidate)/resume/upload')}
              >
                <LinearGradient colors={['#e94560', '#c0392b']} style={styles.emptyButtonGradient}>
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={styles.emptyButtonText}>Upload Resume</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingTop: 56,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.textWhite },
  uploadBtn: {
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  uploadBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 6,
  },
  uploadBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  listContent: { padding: 20, gap: 12 },
  emptyList: { flex: 1, justifyContent: 'center' },
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  resumeCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1, marginRight: 12 },
  fileIconWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  fileIconGradient: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  resumeInfo: { flex: 1 },
  resumeFileName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
  resumeDate: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  readyText: { fontSize: 12, color: Colors.success, fontWeight: '500' },
  processingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  processingText: { fontSize: 12, color: Colors.info, fontWeight: '500' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  emptyButton: { borderRadius: 12, overflow: 'hidden' },
  emptyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 28,
    gap: 8,
  },
  emptyButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
