import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAppDispatch, useAppSelector } from '../../../src/store';
import { fetchHistoryThunk, deleteInterviewThunk } from '../../../src/store/slices/interviewSlice';
import { Interview } from '../../../src/services/interviewService';
import { Colors } from '../../../src/theme/colors';
import { Alert } from 'react-native';

function getStatusConfig(status: Interview['status']): { color: string; bg: string; label: string } {
  switch (status) {
    case 'COMPLETED': return { color: Colors.success, bg: `${Colors.success}20`, label: 'Completed' };
    case 'ACTIVE': return { color: Colors.teal, bg: 'rgba(100,255,218,0.15)', label: 'Active' };
    case 'PENDING': return { color: Colors.warning, bg: `${Colors.warning}20`, label: 'Pending' };
    case 'CANCELLED': return { color: Colors.danger, bg: `${Colors.danger}20`, label: 'Cancelled' };
    default: return { color: Colors.textSecondary, bg: Colors.card, label: status };
  }
}

function InterviewListCard({ interview, onDelete }: { interview: Interview; onDelete: (id: string) => void }) {
  const config = getStatusConfig(interview.status);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <TouchableOpacity
        style={[styles.card, { flex: 1, paddingVertical: 12 }]}
        activeOpacity={0.8}
        onPress={() => router.push(`/(candidate)/interview/${interview.id}`)}
      >
        <View style={styles.cardLeft}>
          <View style={[styles.statusDot, { backgroundColor: config.color }]} />
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle} numberOfLines={1}>{interview.job_title}</Text>
            <View style={styles.cardMeta}>
              <Ionicons name="calendar-outline" size={12} color={Colors.textSecondary} />
              <Text style={styles.cardDate}>
                {new Date(interview.created_at).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                })}
              </Text>
              <View style={styles.metaDot} />
              <Ionicons name="help-circle-outline" size={12} color={Colors.textSecondary} />
              <Text style={styles.cardDate}>{interview.total_questions}Q</Text>
            </View>
          </View>
        </View>

        <View style={styles.cardRight}>
          <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
            <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} style={{ marginTop: 8 }} />
        </View>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={{ padding: 12, marginLeft: 8, backgroundColor: 'rgba(231, 76, 60, 0.1)', borderRadius: 12 }}
        onPress={() => onDelete(interview.id)}
      >
        <Ionicons name="trash-outline" size={20} color={Colors.danger} />
      </TouchableOpacity>
    </View>
  );
}

export default function InterviewHistoryScreen() {
  const dispatch = useAppDispatch();
  const { interviews, loading } = useAppSelector((s) => s.interview);

  useEffect(() => {
    dispatch(fetchHistoryThunk());
  }, []);

  const onRefresh = useCallback(() => {
    dispatch(fetchHistoryThunk());
  }, [dispatch]);

  const handleDelete = useCallback((id: string) => {
    Alert.alert(
      "Delete Interview",
      "Are you sure you want to delete this interview? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: () => dispatch(deleteInterviewThunk(id))
        }
      ]
    );
  }, [dispatch]);

  const sorted = [...interviews].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <View style={styles.root}>
      {/* Header */}
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>My Interviews</Text>
          <TouchableOpacity
            style={styles.newBtn}
            onPress={() => router.push('/(candidate)/interview/create')}
          >
            <LinearGradient colors={['#e94560', '#c0392b']} style={styles.newBtnGradient}>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.newBtnText}>New</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Summary chips */}
        {interviews.length > 0 && (
          <View style={styles.summaryRow}>
            <View style={styles.summaryChip}>
              <Text style={styles.summaryValue}>{interviews.length}</Text>
              <Text style={styles.summaryLabel}>Total</Text>
            </View>
            <View style={styles.summaryChip}>
              <Text style={[styles.summaryValue, { color: Colors.success }]}>
                {interviews.filter((i) => i.status === 'COMPLETED').length}
              </Text>
              <Text style={styles.summaryLabel}>Done</Text>
            </View>
            <View style={styles.summaryChip}>
              <Text style={[styles.summaryValue, { color: Colors.teal }]}>
                {interviews.filter((i) => i.status === 'ACTIVE').length}
              </Text>
              <Text style={styles.summaryLabel}>Active</Text>
            </View>
          </View>
        )}
      </LinearGradient>

      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, sorted.length === 0 && styles.emptyList]}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
        renderItem={({ item }) => <InterviewListCard interview={item} onDelete={handleDelete} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="document-text-outline" size={48} color={Colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No interviews yet</Text>
              <Text style={styles.emptySubtitle}>
                Start your first AI-powered interview to practice your skills
              </Text>
              <TouchableOpacity
                style={styles.startButton}
                onPress={() => router.push('/(candidate)/interview/create')}
              >
                <LinearGradient colors={['#e94560', '#c0392b']} style={styles.startButtonGradient}>
                  <Ionicons name="add-circle" size={22} color="#fff" />
                  <Text style={styles.startButtonText}>Start your first interview</Text>
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
    marginBottom: 16,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.textWhite },
  newBtn: {
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  newBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 4,
  },
  newBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  summaryRow: { flexDirection: 'row', gap: 12 },
  summaryChip: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  summaryValue: { fontSize: 20, fontWeight: '800', color: Colors.textWhite },
  summaryLabel: { fontSize: 10, color: Colors.textSecondary, fontWeight: '600', textTransform: 'uppercase' },
  listContent: { padding: 16, gap: 10 },
  emptyList: { flex: 1, justifyContent: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, marginBottom: 5 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardDate: { fontSize: 12, color: Colors.textSecondary },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: Colors.textMuted, marginHorizontal: 4 },
  cardRight: { alignItems: 'flex-end' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingHorizontal: 32 },
  emptyIconCircle: {
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
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  startButton: { borderRadius: 14, overflow: 'hidden' },
  startButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 10,
  },
  startButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
