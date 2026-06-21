import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useAppDispatch, useAppSelector } from '../../../src/store';
import { startInterviewThunk, setCurrentInterview, setQuestions as setReduxQuestions } from '../../../src/store/slices/interviewSlice';
import { InterviewService, Question } from '../../../src/services/interviewService';
import { Colors } from '../../../src/theme/colors';

function getStatusConfig(status: string): { color: string; bg: string; label: string; icon: keyof typeof Ionicons.glyphMap } {
  switch (status) {
    case 'COMPLETED': return { color: Colors.success, bg: `${Colors.success}20`, label: 'Completed', icon: 'checkmark-circle' };
    case 'ACTIVE': return { color: Colors.teal, bg: 'rgba(100,255,218,0.15)', label: 'Active', icon: 'play-circle' };
    case 'PENDING': return { color: Colors.warning, bg: `${Colors.warning}20`, label: 'Pending', icon: 'time' };
    case 'CANCELLED': return { color: Colors.danger, bg: `${Colors.danger}20`, label: 'Cancelled', icon: 'close-circle' };
    default: return { color: Colors.textSecondary, bg: Colors.card, label: status, icon: 'ellipse' };
  }
}

function getQTypeColor(type: string): string {
  switch (type) {
    case 'TECHNICAL': return Colors.teal;
    case 'BEHAVIORAL': return '#a29bfe';
    case 'SITUATIONAL': return Colors.warning;
    default: return Colors.textSecondary;
  }
}

export default function InterviewDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const { interviews, loading } = useAppSelector((s) => s.interview);
  const { accessToken } = useAppSelector((s) => s.auth);

  const interview = interviews.find((i) => i.id === id);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [expandedQ, setExpandedQ] = useState<string | null>(null);
  const [fetchingQuestions, setFetchingQuestions] = useState(false);
  const [startingInterview, setStartingInterview] = useState(false);
  const [isWaitingForGeneration, setIsWaitingForGeneration] = useState(false);

  useEffect(() => {
    if (interview?.status === 'ACTIVE' || interview?.status === 'COMPLETED') {
      loadQuestions();
    }
    
    // Automatically navigate if we were waiting for generation and it finished
    if (isWaitingForGeneration && interview?.status === 'ACTIVE') {
      setIsWaitingForGeneration(false);
      handleContinue();
    }
    
    let interval: NodeJS.Timeout;
    if (interview?.status === 'GENERATING') {
      interval = setInterval(() => {
        dispatch(fetchHistoryThunk());
      }, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [interview?.status, dispatch, isWaitingForGeneration]);

  const loadQuestions = async () => {
    if (!id) return;
    setFetchingQuestions(true);
    try {
      const qs = await InterviewService.getQuestions(id);
      setQuestions(qs);
    } catch {
      // silently fail
    } finally {
      setFetchingQuestions(false);
    }
  };

  const handleStartInterview = async () => {
    if (!interview || !id) return;
    setStartingInterview(true);
    dispatch(setCurrentInterview(interview));
    const result = await dispatch(startInterviewThunk(id));
    setStartingInterview(false);
    
    // If the status is ACTIVE, we can navigate immediately. If GENERATING, we stay and let the polling take over.
    if (startInterviewThunk.fulfilled.match(result)) {
      if (result.payload.status === 'ACTIVE') {
        router.push('/(candidate)/interview/session');
      } else if (result.payload.status === 'GENERATING') {
        setIsWaitingForGeneration(true);
        // Just trigger a re-fetch of history to update the local object
        dispatch(fetchHistoryThunk());
      }
    }
  };

  const handleContinue = () => {
    if (!interview) return;
    dispatch(setCurrentInterview(interview));
    if (questions.length > 0) {
      dispatch(setReduxQuestions(questions));
    }
    router.push('/(candidate)/interview/session');
  };

  const handleViewReport = () => {
    router.push(`/(candidate)/interview/report?interviewId=${id}`);
  };

  if (!interview) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={styles.loadingText}>Loading interview...</Text>
      </View>
    );
  }

  const statusConfig = getStatusConfig(interview.status);

  return (
    <View style={styles.root}>
      {/* Header */}
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{interview.job_title}</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Status banner */}
        <View style={[styles.statusBanner, { backgroundColor: statusConfig.bg, borderColor: `${statusConfig.color}40` }]}>
          <Ionicons name={statusConfig.icon} size={20} color={statusConfig.color} />
          <Text style={[styles.statusBannerText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>

        {/* Interview info card */}
        <View style={styles.infoCard}>
          <LinearGradient colors={['#1e2a4a', '#16213e']} style={styles.infoCardGradient}>
            <InfoRow icon="briefcase-outline" label="Job Title" value={interview.job_title} />
            <View style={styles.divider} />
            <InfoRow icon="help-circle-outline" label="Questions" value={String(interview.total_questions)} />
            <View style={styles.divider} />
            <InfoRow
              icon="calendar-outline"
              label="Created"
              value={new Date(interview.created_at).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric',
              })}
            />
          </LinearGradient>
        </View>

        {/* Action button */}
        {interview.status === 'PENDING' && (
          <TouchableOpacity
            style={styles.actionBtn}
            disabled={startingInterview}
            onPress={handleStartInterview}
          >
            <LinearGradient colors={['#e94560', '#c0392b']} style={styles.actionBtnGradient}>
              {startingInterview ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="play" size={22} color="#fff" />
              )}
              <Text style={styles.actionBtnText}>
                {startingInterview ? 'Starting...' : 'Start Interview'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {interview.status === 'GENERATING' && (
          <View style={[styles.actionBtn, { backgroundColor: '#1e2a4a', borderColor: '#e94560', borderWidth: 1 }]}>
            <ActivityIndicator size="small" color="#e94560" style={{ marginRight: 10 }} />
            <Text style={[styles.actionBtnText, { color: '#e94560' }]}>
              AI is tailoring your questions...
            </Text>
          </View>
        )}

        {interview.status === 'ACTIVE' && (
          <TouchableOpacity style={styles.actionBtn} onPress={handleContinue}>
            <LinearGradient colors={['#64ffda', '#00b894']} style={styles.actionBtnGradient}>
              <Ionicons name="play-circle" size={22} color="#0f0f1a" />
              <Text style={[styles.actionBtnText, { color: '#0f0f1a' }]}>Continue Interview</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {interview.status === 'COMPLETED' && (
          <TouchableOpacity style={styles.actionBtn} onPress={handleViewReport}>
            <LinearGradient colors={['#2ecc71', '#27ae60']} style={styles.actionBtnGradient}>
              <Ionicons name="bar-chart" size={22} color="#fff" />
              <Text style={styles.actionBtnText}>View Report</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Questions accordion */}
        {(interview.status === 'ACTIVE' || interview.status === 'COMPLETED') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Questions</Text>
            {fetchingQuestions ? (
              <ActivityIndicator size="small" color={Colors.accent} style={{ marginTop: 12 }} />
            ) : (
              questions.map((q, index) => (
                <TouchableOpacity
                  key={q.id}
                  style={styles.questionCard}
                  onPress={() => setExpandedQ(expandedQ === q.id ? null : q.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.questionHeader}>
                    <View style={styles.questionNumCircle}>
                      <Text style={styles.questionNum}>{index + 1}</Text>
                    </View>
                    <View style={styles.questionHeaderRight}>
                      <View style={[styles.qTypeBadge, { backgroundColor: `${getQTypeColor(q.question_type)}20` }]}>
                        <Text style={[styles.qTypeText, { color: getQTypeColor(q.question_type) }]}>
                          {q.question_type}
                        </Text>
                      </View>
                    </View>
                    <Ionicons
                      name={expandedQ === q.id ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={Colors.textSecondary}
                    />
                  </View>
                  {expandedQ === q.id && (
                    <Text style={styles.questionText}>{q.text}</Text>
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoRowLeft}>
        <Ionicons name={icon} size={16} color={Colors.textSecondary} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  loadingRoot: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { color: Colors.textSecondary, fontSize: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.textWhite, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  scrollContent: { padding: 20, paddingBottom: 48, gap: 16 },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  statusBannerText: { fontSize: 15, fontWeight: '700' },
  infoCard: { borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  infoCardGradient: { padding: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  infoRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoLabel: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
  infoValue: { fontSize: 14, color: Colors.textPrimary, fontWeight: '600', maxWidth: '55%', textAlign: 'right' },
  divider: { height: 1, backgroundColor: Colors.border },
  actionBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  actionBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  actionBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  section: { marginTop: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  questionCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  questionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  questionNumCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionNum: { fontSize: 12, fontWeight: '700', color: Colors.accent },
  questionHeaderRight: { flex: 1 },
  qTypeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
  qTypeText: { fontSize: 10, fontWeight: '700' },
  questionText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20, marginTop: 12, paddingLeft: 40 },
});
