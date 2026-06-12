import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface ScoreRingProps {
  score: number; // 0–10
  size?: number;
  label?: string;
  showLabel?: boolean;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function getScoreColor(score: number): string {
  if (score >= 7) return '#2ecc71';
  if (score >= 5) return '#f39c12';
  return '#e74c3c';
}

const ScoreRing: React.FC<ScoreRingProps> = ({
  score,
  size = 80,
  label,
  showLabel = true,
}) => {
  const clampedScore = Math.min(10, Math.max(0, score));
  const strokeWidth = size * 0.1;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const targetFraction = clampedScore / 10;

  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: targetFraction,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [targetFraction]);

  const strokeDashoffset = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, circumference * (1 - targetFraction)],
  });

  const color = getScoreColor(clampedScore);
  const cx = size / 2;
  const cy = size / 2;

  return (
    <View style={styles.wrapper}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          {/* Background track */}
          <Circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="#2d2d4e"
            strokeWidth={strokeWidth}
          />
          {/* Animated arc */}
          <AnimatedCircle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${cx}, ${cy}`}
          />
        </Svg>
        {/* Center text */}
        <View style={[StyleSheet.absoluteFill, styles.centerContent]}>
          <Text style={[styles.scoreText, { color, fontSize: size * 0.26 }]}>
            {clampedScore.toFixed(1)}
          </Text>
          <Text style={[styles.outOfText, { fontSize: size * 0.1 }]}>/10</Text>
        </View>
      </View>
      {showLabel && label ? (
        <Text style={styles.label} numberOfLines={2}>
          {label}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  outOfText: {
    color: '#8892b0',
    fontWeight: '600',
  },
  label: {
    marginTop: 8,
    fontSize: 11,
    color: '#8892b0',
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    maxWidth: 90,
  },
});

export default ScoreRing;
