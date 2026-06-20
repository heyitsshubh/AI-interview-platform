import React, { useEffect, useRef, useCallback } from 'react';
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
import { Colors } from '../../src/theme/colors';
import { Interview } from '../../src/services/interviewService';

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function getStatusColor(status: Interview['status']): string {
  switch (status) {
    case 'COMPLETED': return Colors.success;
    case 'ACTIVE': return Colors.teal;
    case 'PENDING': return Colors.warning;
    case 'CANCELLED': return Colors.danger;
    default: return Colors.textSecondary;
  }
}

function getStatusIcon(status: Interview['status']): keyof typeof Ionicons.glyphMap {
  switch (status) {
    case 'COMPLETED': return 'checkmark-circle';
    case 'ACTIVE': return 'play-circle';
    case 'PENDING': return 'time';
    case 'CANCELLED': return 'close-circle';
    default: return 'ellipse'; 
  }
}

export default function CandidateDashboard() {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.auth);
  const { interviews, loading } = useAppSelector((s) => s.interview);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const cardsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    dispatch(fetchHistoryThunk());
    Animated.stagger(150, [
      Animated.timing(headerAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(cardsAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const onRefresh = useCallback(() => {
    dispatch(fetchHistoryThunk());
  }, [dispatch]);

  const totalInterviews = interviews.length;
  const completed = interviews.filter((i) => i.status === 'COMPLETED').length;
  const recentThree = interviews.slice(0, 3);

  const firstName = user?.full_name?.split(' ')[0] ?? 'there';

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
      >
        {/* Header gradient */}
        <Animated.View style={{ opacity: headerAnim }}>
          <LinearGradient
            colors={['#1a1a2e', '#16213e', '#0f3460']}
            style={styles.headerGradient}
          >
            {/* Decorative circles */}
            <View style={styles.decCircle1} />
            <View style={styles.decCircle2} />

            <View style={styles.headerContent}>
              <Text style={styles.greeting}>Good {getTimeOfDay()}, {firstName}! 👋</Text>
              <Text style={styles.greetingSubtitle}>Ready for your next interview?</Text>
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <StatCard icon="document-text" label="Total" value={String(totalInterviews)} color={Colors.teal} />
              <StatCard icon="checkmark-circle" label="Completed" value={String(completed)} color={Colors.success} />
              <StatCard icon="star" label="Pending" value={String(totalInterviews - completed)} color={Colors.warning} />
            </View>
          </LinearGradient>
        </Animated.View>

        <Animated.View style={[styles.body, { opacity: cardsAnim, transform: [{ translateY: cardsAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.actionCard}
                activeOpacity={0.8}
                onPress={() => router.push('/(candidate)/interview/create')}
              >
                <LinearGradient colors={['#e94560', '#c0392b']} style={styles.actionGradient}>
                  <Ionicons name="add-circle" size={28} color="#fff" />
                  <Text style={styles.actionLabel}>New Interview</Text>
                  <Text style={styles.actionSub}>AI-powered</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                activeOpacity={0.8}
                onPress={() => router.push('/(candidate)/resume/upload')}
              >
                <LinearGradient colors={['#1a6b52', '#64ffda22']} style={styles.actionGradient}>
                  <Ionicons name="cloud-upload" size={28} color={Colors.teal} />
                  <Text style={[styles.actionLabel, { color: Colors.teal }]}>Upload Resume</Text>
                  <Text style={styles.actionSub}>PDF format</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* Recent interviews */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Interviews</Text>
              <TouchableOpacity onPress={() => router.push('/(candidate)/interview/index')}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>

            {recentThree.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="document-text-outline" size={40} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No interviews yet</Text>
                <Text style={styles.emptySubtitle}>Start your first AI interview</Text>
              </View>
            ) : (
              recentThree.map((interview) => (
                <View key={interview.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <TouchableOpacity
                    style={[styles.interviewCard, { flex: 1, marginBottom: 0 }]}
                    activeOpacity={0.8}
                    onPress={() => router.push(`/(candidate)/interview/${interview.id}`)}
                  >
                    <View style={styles.interviewCardLeft}>
                      <Ionicons
                        name={getStatusIcon(interview.status)}
                        size={22}
                        color={getStatusColor(interview.status)}
                      />
                      <View style={styles.interviewCardInfo}>
                        <Text style={styles.interviewCardTitle} numberOfLines={1}>{interview.job_title}</Text>
                        <Text style={styles.interviewCardDate}>
                          {new Date(interview.created_at).toLocaleDateString()}
                          {' · '}
                          {interview.total_questions}Q
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(interview.status)}20` }]}>
                      <Text style={[styles.statusBadgeText, { color: getStatusColor(interview.status) }]}>
                        {interview.status}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ padding: 12, marginLeft: 8, backgroundColor: 'rgba(231, 76, 60, 0.1)', borderRadius: 12 }}
                    onPress={() => {
                      import('react-native').then(({ Alert }) => {
                        Alert.alert("Delete Interview", "Are you sure you want to delete this interview? This action cannot be undone.", [
                          { text: "Cancel", style: "cancel" },
                          { text: "Delete", style: "destructive", onPress: () => {
                              import('../../src/store/slices/interviewSlice').then(({ deleteInterviewThunk }) => {
                                dispatch(deleteInterviewThunk(interview.id));
                              });
                            }
                          }
                        ]);
                      });
                    }}
                  >
                    <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function StatCard({ icon, label, value, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; color: string }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  decCircle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(233,69,96,0.1)',
    top: -60,
    right: -40,
  },
  decCircle2: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(100,255,218,0.07)',
    bottom: -40,
    left: 20,
  },
  headerContent: { marginBottom: 24 },
  greeting: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textWhite,
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  greetingSubtitle: { fontSize: 14, color: Colors.textSecondary },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statValue: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  statLabel: { fontSize: 10, color: Colors.textSecondary, fontWeight: '600', marginTop: 2, textTransform: 'uppercase' },
  body: { paddingHorizontal: 20, paddingTop: 24 },
  section: { marginBottom: 28 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 14 },
  seeAll: { fontSize: 13, color: Colors.teal, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 14 },
  actionCard: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  actionGradient: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'flex-start',
    minHeight: 110,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionLabel: { color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 8 },
  actionSub: { color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 2 },
  interviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  interviewCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  interviewCardInfo: { flex: 1 },
  interviewCardTitle: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
  interviewCardDate: { fontSize: 12, color: Colors.textSecondary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  emptyCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary, marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
});
