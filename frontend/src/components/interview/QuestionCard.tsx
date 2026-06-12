import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Badge from '../ui/Badge';

type QuestionType = 'TECHNICAL' | 'BEHAVIORAL' | 'SITUATIONAL';

interface QuestionCardProps {
  question: string;
  questionType: QuestionType;
  orderIndex: number;
  totalQuestions: number;
  isActive: boolean;
}

const questionTypeConfig: Record<
  QuestionType,
  { label: string; color: string; gradient: [string, string] }
> = {
  TECHNICAL: {
    label: 'Technical',
    color: '#64ffda',
    gradient: ['rgba(100,255,218,0.15)', 'rgba(100,255,218,0.05)'],
  },
  BEHAVIORAL: {
    label: 'Behavioral',
    color: '#e94560',
    gradient: ['rgba(233,69,96,0.15)', 'rgba(233,69,96,0.05)'],
  },
  SITUATIONAL: {
    label: 'Situational',
    color: '#f39c12',
    gradient: ['rgba(243,156,18,0.15)', 'rgba(243,156,18,0.05)'],
  },
};

const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  questionType,
  orderIndex,
  totalQuestions,
  isActive,
}) => {
  const config = questionTypeConfig[questionType];

  const slideAnim = useRef(new Animated.Value(60)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 60,
        friction: 10,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();
  }, [question]);

  useEffect(() => {
    if (isActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: false,
          }),
        ])
      ).start();
    } else {
      glowAnim.setValue(0);
    }
  }, [isActive]);

  const borderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#2d2d4e', config.color],
  });

  const shadowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.0, 0.6],
  });

  const badgeVariantMap: Record<QuestionType, 'info' | 'danger' | 'warning'> = {
    TECHNICAL: 'info',
    BEHAVIORAL: 'danger',
    SITUATIONAL: 'warning',
  };

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          transform: [{ translateX: slideAnim }],
          opacity: opacityAnim,
          borderColor,
          shadowColor: config.color,
          shadowOpacity,
          shadowOffset: { width: 0, height: 0 },
          shadowRadius: 16,
          elevation: 10,
        },
      ]}
    >
      <LinearGradient
        colors={['#1a1a2e', '#16213e']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientInner}
      >
        {/* Top row: number badge + type chip */}
        <View style={styles.topRow}>
          <View style={styles.numberBadge}>
            <Text style={styles.numberText}>
              {orderIndex + 1}
              <Text style={styles.totalText}> / {totalQuestions}</Text>
            </Text>
          </View>
          <Badge
            label={config.label}
            variant={badgeVariantMap[questionType]}
            size="sm"
          />
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: config.color + '33' }]} />

        {/* Question text */}
        <Text style={styles.questionText}>{question}</Text>

        {/* Bottom accent line */}
        <LinearGradient
          colors={[config.color + '88', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.accentLine}
        />
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: 'hidden',
    marginHorizontal: 4,
  },
  gradientInner: {
    padding: 22,
    borderRadius: 18,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  numberBadge: {
    backgroundColor: 'rgba(204, 214, 246, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2d2d4e',
  },
  numberText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ccd6f6',
  },
  totalText: {
    fontWeight: '500',
    color: '#8892b0',
  },
  divider: {
    height: 1,
    marginBottom: 18,
    borderRadius: 1,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ccd6f6',
    lineHeight: 28,
    letterSpacing: 0.2,
  },
  accentLine: {
    height: 3,
    borderRadius: 2,
    marginTop: 20,
    width: '40%',
  },
});

export default QuestionCard;
