import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ScoreRing from '../ui/ScoreRing';
import GradientCard from '../ui/GradientCard';

type Recommendation = 'STRONG_HIRE' | 'HIRE' | 'MAYBE' | 'REJECT';

interface ScoreSummaryProps {
  overallScore: number;
  technicalScore: number;
  communicationScore: number;
  integrityScore: number;
  recommendation: Recommendation;
}

const recommendationConfig: Record<
  Recommendation,
  {
    label: string;
    gradient: [string, string];
    textColor: string;
    borderColor: string;
  }
> = {
  STRONG_HIRE: {
    label: '⭐ Strong Hire',
    gradient: ['rgba(46,204,113,0.25)', 'rgba(46,204,113,0.08)'],
    textColor: '#2ecc71',
    borderColor: 'rgba(46,204,113,0.5)',
  },
  HIRE: {
    label: '✓ Hire',
    gradient: ['rgba(46,204,113,0.18)', 'rgba(46,204,113,0.05)'],
    textColor: '#2ecc71',
    borderColor: 'rgba(46,204,113,0.35)',
  },
  MAYBE: {
    label: '⚠ Maybe',
    gradient: ['rgba(243,156,18,0.2)', 'rgba(243,156,18,0.05)'],
    textColor: '#f39c12',
    borderColor: 'rgba(243,156,18,0.4)',
  },
  REJECT: {
    label: '✗ Reject',
    gradient: ['rgba(231,76,60,0.2)', 'rgba(231,76,60,0.05)'],
    textColor: '#e74c3c',
    borderColor: 'rgba(231,76,60,0.4)',
  },
};

const ScoreSummary: React.FC<ScoreSummaryProps> = ({
  overallScore,
  technicalScore,
  communicationScore,
  integrityScore,
  recommendation,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 10,
      }),
    ]).start();
  }, []);

  const cfg = recommendationConfig[recommendation];

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      {/* Recommendation Banner */}
      <LinearGradient
        colors={cfg.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.recommendationBanner, { borderColor: cfg.borderColor }]}
      >
        <Text style={styles.recLabel}>Recommendation</Text>
        <Text style={[styles.recValue, { color: cfg.textColor }]}>
          {cfg.label}
        </Text>
      </LinearGradient>

      {/* Overall score */}
      <GradientCard style={styles.overallCard} glowColor="#e94560">
        <View style={styles.overallContent}>
          <ScoreRing score={overallScore} size={110} label="Overall Score" showLabel />
          <View style={styles.overallMeta}>
            <Text style={styles.overallTitle}>Overall Performance</Text>
            <Text style={styles.overallSub}>
              Based on technical ability, communication clarity, and integrity metrics.
            </Text>
          </View>
        </View>
      </GradientCard>

      {/* Sub-scores grid */}
      <View style={styles.grid}>
        <GradientCard style={styles.gridCell}>
          <View style={styles.cellInner}>
            <ScoreRing
              score={technicalScore}
              size={70}
              label="Technical"
              showLabel
            />
          </View>
        </GradientCard>

        <GradientCard style={styles.gridCell}>
          <View style={styles.cellInner}>
            <ScoreRing
              score={communicationScore}
              size={70}
              label="Communication"
              showLabel
            />
          </View>
        </GradientCard>

        <GradientCard style={styles.gridCell}>
          <View style={styles.cellInner}>
            <ScoreRing
              score={integrityScore}
              size={70}
              label="Integrity"
              showLabel
            />
          </View>
        </GradientCard>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  recommendationBanner: {
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8892b0',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  overallCard: {
    padding: 20,
  },
  overallContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    padding: 4,
  },
  overallMeta: {
    flex: 1,
  },
  overallTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ccd6f6',
    marginBottom: 8,
  },
  overallSub: {
    fontSize: 13,
    color: '#8892b0',
    lineHeight: 20,
  },
  grid: {
    flexDirection: 'row',
    gap: 10,
  },
  gridCell: {
    flex: 1,
    padding: 14,
  },
  cellInner: {
    alignItems: 'center',
    paddingVertical: 8,
  },
});

export default ScoreSummary;
