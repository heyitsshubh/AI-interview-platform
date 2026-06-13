import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { Colors } from '../../../src/theme/colors';
import { CheatingService, CheatingReport, CheatingEvent } from '../../../src/services/cheatingService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SEVERITY_COLOR = { LOW: Colors.success, MEDIUM: Colors.warning, HIGH: Colors.danger };
const RISK_CONFIG = {
  LOW:      { color: Colors.success, bg: 'rgba(46,204,113,0.15)',  label: 'LOW RISK' },
  MEDIUM:   { color: Colors.warning, bg: 'rgba(243,156,18,0.15)',  label: 'MEDIUM RISK' },
  HIGH:     { color: Colors.danger,  bg: 'rgba(231,76,60,0.15)',   label: 'HIGH RISK' },
  CRITICAL: { color: '#c0392b',      bg: 'rgba(192,57,43,0.2)',    label: 'CRITICAL' },
};

const CATEGORY_ICONS: Record<string, string> = {
  TAB_SWITCH:       'browsers-outline',
  WINDOW_BLUR:      'eye-off-outline',
  COPY_PASTE:       'copy-outline',
  MULTIPLE_FACES:   'people-outline',
  NO_FACE:          'person-remove-outline',
  LOOKING_AWAY:     'eye-outline',
  EXTERNAL_VOICE:   'mic-off-outline',
  SCREEN_SHARE:     'desktop-outline',
  DEVTOOLS_OPEN:    'code-slash-outline',
  KEYBOARD_MISMATCH:'keypad-outline',
};

function IntegrityBar({ score }: { score: number }) {
  const animWidth = useRef(new Animated.Value(0)).current;
  const color = score >= 80 ? Colors.success : score >= 50 ? Colors.warning : Colors.danger;

  useEffect(() => {
    Animated.timing(animWidth, { toValue: score, duration: 900, useNativeDriver: false }).start();
  }, [score]);

  return (
    <View>
      <View style={styles.barRow}>
        <Text style={styles.barLabel}>Integrity Score</Text>
        <Text style={[styles.barValue, { color }]}>{score.toFixed(1)}%</Text>
      </View>
      <View style={styles.barTrack}>
        <Animated.View
          style={[
            styles.barFill,
            {
              backgroundColor: color,
              width: animWidth.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
            },
          ]}
        />
      </View>
    </View>
  );
}

function EventRow({ event, index }: { event: CheatingEvent; index: number }) {
  const fade = useRef(new Animated.Value(0)).current;
  const sevColor = SEVERITY_COLOR[event.severity] || Colors.textSecondary;
  const icon = CATEGORY_ICONS[event.category] || 'warning-outline';
  const time = new Date(event.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 300, delay: index * 50, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={[styles.eventRow, { opacity: fade, backgroundColor: index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }]}>
      <View style={[styles.eventIcon, { backgroundColor: `${sevColor}20` }]}>
        <Ionicons name={icon as any} size={16} color={sevColor} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.eventCategory}>{event.category.replace(/_/g, ' ')}</Text>
        {event.description ? <Text style={styles.eventDesc} numberOfLines={1}>{event.description}</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <View style={[styles.sevBadge, { backgroundColor: `${sevColor}20` }]}>
          <Text style={[styles.sevText, { color: sevColor }]}>{event.severity}</Text>
        </View>
        <Text style={styles.eventTime}>{time}</Text>
      </View>
    </Animated.View>
  );
}

export default function CheatingReportScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [report, setReport] = useState<CheatingReport | null>(null);
  const [events, setEvents] = useState<CheatingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!id) return;
    Promise.all([
      CheatingService.getReport(id),
      CheatingService.getEvents(id),
    ]).then(([rep, evts]) => {
      setReport(rep);
      setEvents(evts);
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.accent} size="large" />
        <Text style={styles.loadingText}>Loading cheating report...</Text>
      </View>
    );
  }

  const riskCfg = RISK_CONFIG[report?.risk_level as keyof typeof RISK_CONFIG] || RISK_CONFIG.LOW;

  return (
    <Animated.ScrollView
      style={[styles.container, { opacity: fadeAnim }]}
      contentContainerStyle={{ paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Integrity Report</Text>
        <Text style={styles.headerSub}>Interview ID: {id?.slice(0, 8)}...</Text>
      </LinearGradient>

      <View style={styles.body}>
        {/* No violations */}
        {report?.total_events === 0 && (
          <View style={styles.cleanBanner}>
            <Ionicons name="shield-checkmark" size={32} color={Colors.success} />
            <Text style={styles.cleanTitle}>No Violations Detected</Text>
            <Text style={styles.cleanSub}>The candidate completed the interview with full integrity.</Text>
          </View>
        )}

        {/* Risk level banner */}
        {(report?.total_events ?? 0) > 0 && (
          <View style={[styles.riskBanner, { backgroundColor: riskCfg.bg, borderColor: riskCfg.color }]}>
            <Ionicons name="warning" size={22} color={riskCfg.color} />
            <View style={{ marginLeft: 12 }}>
              <Text style={[styles.riskLabel, { color: riskCfg.color }]}>{riskCfg.label}</Text>
              <Text style={styles.riskSub}>{report?.total_events} violation{(report?.total_events ?? 0) > 1 ? 's' : ''} detected</Text>
            </View>
          </View>
        )}

        {/* Integrity score bar */}
        <View style={styles.card}>
          <IntegrityBar score={report?.integrity_score ?? 100} />
        </View>

        {/* By category table */}
        {report && Object.keys(report.by_category).length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>By Category</Text>
            {Object.entries(report.by_category).map(([cat, count]) => {
              const sev = (report.by_severity as any)[cat] || 'MEDIUM';
              const sevColor = SEVERITY_COLOR[sev as keyof typeof SEVERITY_COLOR] || Colors.textSecondary;
              return (
                <View key={cat} style={styles.catRow}>
                  <Ionicons name={CATEGORY_ICONS[cat] as any || 'warning-outline'} size={16} color={Colors.textSecondary} />
                  <Text style={styles.catName}>{cat.replace(/_/g, ' ')}</Text>
                  <View style={styles.catRight}>
                    <View style={[styles.countBubble, { backgroundColor: `${Colors.accent}25` }]}>
                      <Text style={[styles.countText, { color: Colors.accent }]}>{count}×</Text>
                    </View>
                    <View style={[styles.sevBadge, { backgroundColor: `${sevColor}20` }]}>
                      <Text style={[styles.sevText, { color: sevColor }]}>{sev}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Event timeline */}
        {events.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Event Timeline ({events.length})</Text>
            {events.map((event, i) => (
              <EventRow key={event.id} event={event} index={i} />
            ))}
          </View>
        )}
      </View>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.background },
  centered:     { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText:  { color: Colors.textSecondary, fontSize: 15 },
  header:       { paddingHorizontal: 20, paddingBottom: 24 },
  backBtn:      { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backText:     { color: Colors.textPrimary, fontSize: 16, marginLeft: 4 },
  headerTitle:  { color: Colors.textPrimary, fontSize: 24, fontWeight: '700' },
  headerSub:    { color: Colors.textSecondary, fontSize: 13, marginTop: 4 },
  body:         { padding: 16 },
  cleanBanner:  { backgroundColor: 'rgba(46,204,113,0.1)', borderRadius: 14, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: Colors.success, marginBottom: 16, gap: 8 },
  cleanTitle:   { color: Colors.success, fontSize: 18, fontWeight: '700' },
  cleanSub:     { color: Colors.textSecondary, fontSize: 13, textAlign: 'center' },
  riskBanner:   { borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 16, borderWidth: 1 },
  riskLabel:    { fontSize: 16, fontWeight: '700' },
  riskSub:      { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  card:         { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  barRow:       { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  barLabel:     { color: Colors.textSecondary, fontSize: 14 },
  barValue:     { fontSize: 14, fontWeight: '700' },
  barTrack:     { height: 10, backgroundColor: Colors.border, borderRadius: 100, overflow: 'hidden' },
  barFill:      { height: 10, borderRadius: 100 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 14 },
  catRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 },
  catName:      { flex: 1, color: Colors.textPrimary, fontSize: 13 },
  catRight:     { flexDirection: 'row', gap: 8, alignItems: 'center' },
  countBubble:  { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 100 },
  countText:    { fontSize: 12, fontWeight: '700' },
  sevBadge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  sevText:      { fontSize: 11, fontWeight: '700' },
  eventRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, borderRadius: 8 },
  eventIcon:    { width: 34, height: 34, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  eventCategory:{ color: Colors.textPrimary, fontSize: 13, fontWeight: '600' },
  eventDesc:    { color: Colors.textSecondary, fontSize: 11, marginTop: 2 },
  eventTime:    { color: Colors.textMuted, fontSize: 11 },
});
