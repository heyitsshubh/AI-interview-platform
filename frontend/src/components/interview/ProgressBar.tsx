import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface ProgressBarProps {
  current: number; // 1-based current question index
  total: number;
  label?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ current, total, label }) => {
  const fraction = total > 0 ? Math.min(current / total, 1) : 0;
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: fraction,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [fraction]);

  return (
    <View style={styles.container}>
      {/* Label row */}
      <View style={styles.labelRow}>
        <Text style={styles.labelText}>
          {label ?? `Q${current} of ${total}`}
        </Text>
        <Text style={styles.percentText}>
          {Math.round(fraction * 100)}%
        </Text>
      </View>

      {/* Track */}
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fillWrapper,
            {
              flex: widthAnim,
            },
          ]}
        >
          <LinearGradient
            colors={['#e94560', '#64ffda']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.fill}
          />
        </Animated.View>
        {/* Remaining */}
        <Animated.View
          style={{
            flex: widthAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0],
            }),
          }}
        />
      </View>

      {/* Step dots */}
      <View style={styles.dotsRow}>
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < current
                ? styles.dotActive
                : i === current - 1
                ? styles.dotCurrent
                : styles.dotInactive,
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 4,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  labelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ccd6f6',
    letterSpacing: 0.5,
  },
  percentText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8892b0',
  },
  track: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2d2d4e',
    overflow: 'hidden',
  },
  fillWrapper: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: '#64ffda',
  },
  dotCurrent: {
    backgroundColor: '#e94560',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotInactive: {
    backgroundColor: '#2d2d4e',
  },
});

export default ProgressBar;
