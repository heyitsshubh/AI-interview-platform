import React, { useEffect, useRef } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Badge from '../ui/Badge';

// ─── Types (mirror cheatingService) ─────────────────────────────────────────

export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

export interface CheatingCategory {
  category: string;
  count: number;
  severity: SeverityLevel;
}

export interface CheatingReport {
  totalEvents: number;
  integrityScore: number; // 0–100
  riskLevel: RiskLevel;
  categories: CheatingCategory[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const severityVariant: Record<
  SeverityLevel,
  'success' | 'warning' | 'danger' | 'info' | 'default'
> = {
  LOW: 'info',
  MEDIUM: 'warning',
  HIGH: 'danger',
  CRITICAL: 'danger',
};

const riskVariant: Record<
  RiskLevel,
  'success' | 'warning' | 'danger' | 'info' | 'default'
> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'danger',
  VERY_HIGH: 'danger',
};

const riskColor: Record<RiskLevel, string> = {
  LOW: '#2ecc71',
  MEDIUM: '#f39c12',
  HIGH: '#e74c3c',
  VERY_HIGH: '#c0392b',
};

const integrityBarColor = (score: number): string => {
  if (score >= 70) return '#2ecc71';
  if (score >= 40) return '#f39c12';
  return '#e74c3c';
};

// ─── Component ───────────────────────────────────────────────────────────────

interface CheatingTableProps {
  cheatingReport: CheatingReport;
}

const CheatingTable: React.FC<CheatingTableProps> = ({ cheatingReport }) => {
  const { totalEvents, integrityScore, riskLevel, categories } = cheatingReport;
  const hasEvents = totalEvents > 0;

  const barAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(barAnim, {
        toValue: integrityScore / 100,
        duration: 900,
        useNativeDriver: false,
      }),
    ]).start();
  }, [integrityScore]);

  const barColor = integrityBarColor(integrityScore);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* ── No Events Banner ─────────────────────────── */}
      {!hasEvents ? (
        <LinearGradient
          colors={['rgba(46,204,113,0.2)', 'rgba(46,204,113,0.06)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.banner, { borderColor: 'rgba(46,204,113,0.45)' }]}
        >
          <Ionicons name="shield-checkmark" size={22} color="#2ecc71" />
          <Text style={[styles.bannerText, { color: '#2ecc71' }]}>
            No integrity violations detected
          </Text>
        </LinearGradient>
      ) : (
        /* ── Warning Banner ──────────────────────────── */
        <LinearGradient
          colors={['rgba(231,76,60,0.2)', 'rgba(231,76,60,0.06)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.banner, { borderColor: 'rgba(231,76,60,0.45)' }]}
        >
          <Ionicons name="warning" size={22} color="#e74c3c" />
          <Text style={[styles.bannerText, { color: '#e74c3c' }]}>
            {totalEvents} integrity event{totalEvents !== 1 ? 's' : ''} detected
          </Text>
        </LinearGradient>
      )}

      {/* ── Integrity Score Bar ───────────────────────── */}
      <View style={styles.integritySection}>
        <View style={styles.integrityHeader}>
          <Text style={styles.sectionTitle}>Integrity Score</Text>
          <Text style={[styles.integrityValue, { color: barColor }]}>
            {integrityScore}
            <Text style={styles.integrityMax}>/100</Text>
          </Text>
        </View>

        <View style={styles.barTrack}>
          <Animated.View
            style={[
              styles.barFill,
              {
                flex: barAnim,
                backgroundColor: barColor,
                shadowColor: barColor,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.6,
                shadowRadius: 6,
              },
            ]}
          />
          <Animated.View
            style={{
              flex: barAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0],
              }),
            }}
          />
        </View>

        <View style={styles.barLabels}>
          <Text style={styles.barLabel}>0</Text>
          <Text style={styles.barLabel}>50</Text>
          <Text style={styles.barLabel}>100</Text>
        </View>
      </View>

      {/* ── Risk Level ───────────────────────────────── */}
      <View style={styles.riskRow}>
        <Text style={styles.sectionTitle}>Risk Level</Text>
        <Badge
          label={riskLevel.replace('_', ' ')}
          variant={riskVariant[riskLevel]}
          size="md"
        />
      </View>

      {/* ── Categories Table ─────────────────────────── */}
      {hasEvents && categories.length > 0 ? (
        <View style={styles.tableSection}>
          <Text style={styles.sectionTitle}>Detected Events</Text>

          {/* Table header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.colHeader, { flex: 3 }]}>Category</Text>
            <Text style={[styles.colHeader, styles.colCenter, { flex: 1 }]}>
              Count
            </Text>
            <Text style={[styles.colHeader, styles.colRight, { flex: 2 }]}>
              Severity
            </Text>
          </View>

          {/* Table rows */}
          {categories.map((cat, idx) => (
            <View
              key={`${cat.category}-${idx}`}
              style={[
                styles.tableRow,
                idx % 2 === 0 ? styles.rowEven : styles.rowOdd,
              ]}
            >
              {/* Category name */}
              <View style={{ flex: 3 }}>
                <Text style={styles.categoryName} numberOfLines={2}>
                  {cat.category
                    .replace(/_/g, ' ')
                    .toLowerCase()
                    .replace(/\b\w/g, (c) => c.toUpperCase())}
                </Text>
              </View>

              {/* Count bubble */}
              <View style={[styles.countBubble, { flex: 1 }]}>
                <Text style={styles.countText}>{cat.count}</Text>
              </View>

              {/* Severity badge */}
              <View style={[styles.colRight, { flex: 2 }]}>
                <Badge
                  label={cat.severity}
                  variant={severityVariant[cat.severity]}
                  size="sm"
                />
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  bannerText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
    flex: 1,
  },
  integritySection: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2d2d4e',
  },
  integrityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8892b0',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  integrityValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  integrityMax: {
    fontSize: 13,
    color: '#8892b0',
    fontWeight: '500',
  },
  barTrack: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2d2d4e',
    overflow: 'hidden',
  },
  barFill: {
    height: 10,
    borderRadius: 5,
  },
  barLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  barLabel: {
    fontSize: 11,
    color: '#4a4a6a',
    fontWeight: '500',
  },
  riskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2d2d4e',
  },
  tableSection: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2d2d4e',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d4e',
    marginBottom: 2,
    marginTop: 12,
    marginHorizontal: 8,
    borderRadius: 8,
  },
  colHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4a4a6a',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  colCenter: {
    textAlign: 'center',
  },
  colRight: {
    alignItems: 'flex-end',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 8,
    borderRadius: 8,
    marginBottom: 2,
  },
  rowEven: {
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  rowOdd: {
    backgroundColor: 'transparent',
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ccd6f6',
    lineHeight: 18,
  },
  countBubble: {
    alignItems: 'center',
  },
  countText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#e94560',
    backgroundColor: 'rgba(233,69,96,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
    textAlign: 'center',
    minWidth: 28,
  },
});

export default CheatingTable;
