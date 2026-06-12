import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAppDispatch, useAppSelector } from '../../src/store';
import { fetchHistoryThunk } from '../../src/store/slices/interviewSlice';
import { InterviewService } from '../../src/services/interviewService';
import { Colors } from '../../src/theme/colors';
import { Interview } from '../../src/services/interviewService';

function getStatusColor(status: Interview['status']): string {
  switch (status) {
    case 'COMPLETED': return Colors.success;
    case 'ACTIVE': return Colors.teal;
    case 'PENDING': return Colors.warning;
    case 'CANCELLED': return Colors.danger;
    default: return Colors.textSecondary;
  }
}

const REC_CONFIG: Record<string, { color: string; label: string }> = {
  STRONG_HIRE: { color: Colors.strongHire, label: 'Strong Hire' },
  HIRE: { color: Colors.hire, label: 'Hire' },
  MAYBE: { color: Colors.maybe, label: 'Maybe' },
  REJECT: { color: Colors.reject, label: 'Reject' },
};

export default function RecruiterDashboard() {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.auth);
  const { interviews, loading } = useAppSelector((s) => s.interview);

  const [candidates, setCandidates] = useState<any[]>([]);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const bodyAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    dispatch(fetchHistoryThunk());
    loadCandidates();

    Animated.stagger(200, [
      Animated.timing(headerAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(bodyAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const loadCandidates = async () => {
    try {
      const data = await InterviewService.getCandidates();
      setCandidates(data);
    } catch {
      // silently fail
    }
  };

  const onRefresh = useCallback(() => {
    dispatch(fetchHistoryThunk());
    loadCandidates();
  }, [dispatch]);

  const total = interviews.length;
  const completed = interviews.filter((i) => i.status === 'COMPLETED').length;
  const active = interviews.filter((i) => i.status === 'ACTIVE').length;
  const recentFive = [...interviews]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
      >
        {/* Header */}
        <Animated.View style={{ opacity: headerAnim }}>
          <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.headerGradient}>
            <View style={styles.blob1} />
            <View style={styles.blob2} />

            <View style={styles.headerTop}>
              <View>
                <Text style={styles.headerTitle}>Recruiter Dashboard</Text>
                <Text style={styles.headerSubtitle}>Welcome back, {user?.full_name?.split(' ')[0] ?? 'Recruiter'} 👋</Text>
              </View>
              <View style={styles.recruiterBadge}>
                <Ionicons name="briefcase" size={12} color="#0f0f1a" />
                <Text style={styles.recruiterBadgeText}>RECRUITER</Text>
              </View>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              <StatBox label="Total" value={String(total)} color={Colors.teal} icon="document-text" />
              <StatBox label="Completed" value={String(completed)} color={Colors.success} icon="checkmark-circle" />
              <StatBox label="Active" value={String(active)} color={Colors.warning} icon="play-circle" />
              <StatBox label="Candidates" value={String(candidates.length)} color="#a29bfe" icon="people" />
            </View>
          </LinearGradient>
        </Animated.View>

        <Animated.View
          style={[
            styles.body,
            {
              opacity: bodyAnim,
              transform: [{ translateY: bodyAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
            },
          ]}
        >
          {/* Quick access */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Access</Text>
            <View style={styles.quickRow}>
              <TouchableOpacity
                style={styles.quickCard}
                onPress={() => router.push('/(recruiter)/interviews')}
              >
                <LinearGradient colors={['rgba(233,69,96,0.15)', 'rgba(233,69,96,0.05)']} style={styles.quickCardGradient}>
                  <Ionicons name="list" size={26} color={Colors.accent} />
                  <Text style={styles.quickCardLabel}>All Interviews</Text>
                  <Text style={styles.quickCardCount}>{total}</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickCard}
                onPress={() => router.push('/(recruiter)/candidates')}
              >
                <LinearGradient colors={['rgba(100,255,218,0.12)', 'rgba(100,255,218,0.04)']} style={styles.quickCardGradient}>
                  <Ionicons name="people" size={26} color={Colors.teal} />
                  <Text style={[styles.quickCardLabel, { color: Colors.teal }]}>Candidates</Text>
                  <Text style={[styles.quickCardCount, { color: Colors.teal }]}>{candidates.length}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* Recent interviews */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Interviews</Text>
              <TouchableOpacity onPress={() => router.push('/(recruiter)/interviews')}>
                <Text style={styles.seeAll}>View all →</Text>
              </TouchableOpacity>
            </View>

            {recentFive.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="document-text-outline" size={36} color={Colors.textMuted} />
                <Text style={styles.emptyText}>No interviews yet</Text>
              </View>
            ) : (
              recentFive.map((interview) => (
                <TouchableOpacity
                  key={interview.id}
                  style={styles.interviewCard}
                  activeOpacity={0.8}
                  onPress={() => router.push(`/(recruiter)/cheating/${interview.id}`)}
                >
                  <View style={styles.cardLeft}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(interview.status) }]} />
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{interview.job_title}</Text>
                      <Text style={styles.cardDate}>
                        {new Date(interview.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {' · '}{interview.total_questions}Q
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cardRight}>
                    <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(interview.status)}20` }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(interview.status) }]}>
                        {interview.status}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function StatBox({ label, value, color, icon }: {
  label: string; value: string; color: string; icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.statBox}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 24 },
  headerGradient: {
    paddingTop: 56,
    paddingBottom: 28,
    paddingHorizontal: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  blob1: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(233,69,96,0.1)', top: -50, right: -40,
  },
  blob2: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(100,255,218,0.07)', bottom: -40, left: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.textWhite, marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: Colors.textSecondary },
  recruiterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.teal,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  recruiterBadgeText: { fontSize: 10, fontWeight: '800', color: '#0f0f1a' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 3,
  },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 9, color: Colors.textSecondary, fontWeight: '600', textTransform: 'uppercase' },
  body: { padding: 20 },
  section: { marginBottom: 28 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 14 },
  seeAll: { fontSize: 13, color: Colors.teal, fontWeight: '600' },
  quickRow: { flexDirection: 'row', gap: 14 },
  quickCard: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickCardGradient: { padding: 18, gap: 6 },
  quickCardLabel: { fontSize: 13, fontWeight: '700', color: Colors.accent },
  quickCardCount: { fontSize: 28, fontWeight: '800', color: Colors.accent },
  interviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 3 },
  cardDate: { fontSize: 12, color: Colors.textSecondary },
  cardRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '700' },
  emptyCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 32,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: { fontSize: 15, color: Colors.textSecondary },
});
