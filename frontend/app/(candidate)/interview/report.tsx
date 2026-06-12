import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { ReportService, ReportSummary } from '../../../src/services/reportService';
import ScoreRing from '../../../src/components/ui/ScoreRing';
import { Colors } from '../../../src/theme/colors';

const RECOMMENDATION_CONFIG = {
  STRONG_HIRE: { color: Colors.strongHire, label: 'Strong Hire', icon: '🚀', bg: `${Colors.strongHire}18` },
  HIRE: { color: Colors.hire, label: 'Hire', icon: '✅', bg: `${Colors.hire}18` },
  MAYBE: { color: Colors.maybe, label: 'Maybe', icon: '🤔', bg: `${Colors.maybe}18` },
  REJECT: { color: Colors.reject, label: 'Reject', icon: '❌', bg: `${Colors.reject}18` },
};

export default function ReportScreen() {
  const { interviewId } = useLocalSearchParams<{ interviewId: string }>();
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchReport = async () => {
    if (!interviewId) return;
    try {
      const data = await ReportService.getSummary(interviewId);
      setReport(data);
      setLoading(false);

      if (data.status === 'GENERATING') {
        setIsPolling(true);
      } else {
        setIsPolling(false);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load report');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();

    // Start pulse for pending state
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.5, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();

    return () => {
      pulse.stop();
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [interviewId]);

  // Auto-poll every 5 seconds if generating
  useEffect(() => {
    if (isPolling && !pollIntervalRef.current) {
      pollIntervalRef.current = setInterval(fetchReport, 5000);
    }
  }, [isPolling]);

  const handleDownload = async () => {
    if (!interviewId) return;
    const url = ReportService.getDownloadUrl(interviewId);
    await Linking.openURL(url);
  };

  if (loading) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={styles.loadingText}>Loading report...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerScreen}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.danger} />
        <Text style={styles.errorTitle}>Failed to load report</Text>
        <Text style={styles.errorSubtitle}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchReport}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!report || report.status === 'GENERATING') {
    return (
      <View style={styles.root}>
        <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Interview Report</Text>
          <View style={{ width: 40 }} />
        </LinearGradient>

        <View style={styles.generatingContainer}>
          <Animated.View style={{ opacity: pulseAnim }}>
            <LinearGradient colors={['#e94560', '#c0392b']} style={styles.generatingIcon}>
              <Ionicons name="analytics" size={48} color="#fff" />
            </LinearGradient>
          </Animated.View>
          <Text style={styles.generatingTitle}>Generating Your Report</Text>
          <Text style={styles.generatingSubtitle}>
            Our AI is analyzing your responses. This usually takes 30-60 seconds.
          </Text>
          <ActivityIndicator size="small" color={Colors.accent} style={{ marginTop: 16 }} />
          <Text style={styles.generatingHint}>Auto-refreshing every 5 seconds...</Text>
        </View>
      </View>
    );
  }

  const recConfig = report.recommendation ? RECOMMENDATION_CONFIG[report.recommendation] : null;
  const feedback = report.feedback;
  const narrativeText =
    typeof feedback === 'string'
      ? feedback
      : feedback?.narrative || feedback?.summary || JSON.stringify(feedback, null, 2);

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Interview Report</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Recommendation banner */}
          {recConfig && (
            <View style={[styles.recommendationBanner, { backgroundColor: recConfig.bg, borderColor: `${recConfig.color}40` }]}>
              <Text style={styles.recEmoji}>{recConfig.icon}</Text>
              <View>
                <Text style={styles.recLabel}>Recommendation</Text>
                <Text style={[styles.recValue, { color: recConfig.color }]}>{recConfig.label}</Text>
              </View>
            </View>
          )}

          {/* Score rings */}
          <View style={styles.scoresCard}>
            <Text style={styles.sectionTitle}>Performance Scores</Text>
            <View style={styles.scoresGrid}>
              <ScoreRing score={report.overall_score ?? 0} size={90} label="Overall" />
              <ScoreRing score={report.technical_score ?? 0} size={90} label="Technical" />
              <ScoreRing score={report.communication_score ?? 0} size={90} label="Communication" />
              <ScoreRing score={report.integrity_score ?? 0} size={90} label="Integrity" />
            </View>
          </View>

          {/* Feedback narrative */}
          {narrativeText ? (
            <View style={styles.feedbackCard}>
              <View style={styles.feedbackHeader}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={Colors.teal} />
                <Text style={styles.sectionTitle}>AI Feedback</Text>
              </View>
              <Text style={styles.feedbackText}>{narrativeText}</Text>
            </View>
          ) : null}

          {/* Download button */}
          <TouchableOpacity style={styles.downloadBtn} onPress={handleDownload}>
            <LinearGradient
              colors={['#1e2a4a', '#16213e']}
              style={styles.downloadBtnGradient}
            >
              <Ionicons name="download-outline" size={20} color={Colors.teal} />
              <Text style={styles.downloadBtnText}>Download PDF Report</Text>
              <Ionicons name="open-outline" size={16} color={Colors.textSecondary} />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  centerScreen: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  loadingText: { fontSize: 15, color: Colors.textSecondary },
  errorTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  errorSubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  retryBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  retryText: { color: '#fff', fontWeight: '700' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textWhite },
  generatingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  generatingIcon: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  generatingTitle: { fontSize: 22, fontWeight: '800', color: Colors.textWhite, textAlign: 'center' },
  generatingSubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  generatingHint: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  scrollContent: { padding: 20, paddingBottom: 48, gap: 16 },
  recommendationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  recEmoji: { fontSize: 32 },
  recLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600', textTransform: 'uppercase' },
  recValue: { fontSize: 20, fontWeight: '800', marginTop: 2 },
  scoresCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 16 },
  scoresGrid: { flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap', gap: 20 },
  feedbackCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
  },
  feedbackHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  feedbackText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
  downloadBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  downloadBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  downloadBtnText: { fontSize: 15, fontWeight: '700', color: Colors.teal, flex: 1, textAlign: 'center' },
});
