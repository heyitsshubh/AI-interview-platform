import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface VoiceWaveformProps {
  isRecording: boolean;
  duration: number; // seconds
  onStartRecording: () => void;
  onStopRecording: () => void;
}

const BAR_COUNT = 7;

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const VoiceWaveform: React.FC<VoiceWaveformProps> = ({
  isRecording,
  duration,
  onStartRecording,
  onStopRecording,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const barAnims = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(0.3))
  ).current;

  // Pulse ring when recording
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Animate bars
      const barLoops = barAnims.map((anim, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(i * 80),
            Animated.timing(anim, {
              toValue: 0.4 + Math.random() * 0.6,
              duration: 300 + i * 60,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.15 + Math.random() * 0.3,
              duration: 300 + i * 60,
              useNativeDriver: true,
            }),
          ])
        )
      );
      barLoops.forEach((l) => l.start());

      return () => {
        pulseAnim.stopAnimation();
        barAnims.forEach((a) => {
          a.stopAnimation();
          a.setValue(0.3);
        });
      };
    } else {
      pulseAnim.setValue(1);
      barAnims.forEach((a) => a.setValue(0.3));
    }
  }, [isRecording]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
    if (isRecording) {
      onStopRecording();
    } else {
      onStartRecording();
    }
  };

  return (
    <View style={styles.container}>
      {/* Waveform bars (visible when recording) */}
      <View style={styles.barsContainer}>
        {barAnims.map((anim, idx) => (
          <Animated.View
            key={idx}
            style={[
              styles.bar,
              {
                scaleY: anim,
                opacity: isRecording ? 1 : 0,
                backgroundColor: isRecording ? '#e94560' : '#2d2d4e',
              },
            ]}
          />
        ))}
      </View>

      {/* Pulse ring */}
      {isRecording && (
        <Animated.View
          style={[
            styles.pulseRing,
            { transform: [{ scale: pulseAnim }], opacity: 0.35 },
          ]}
        />
      )}

      {/* Mic button */}
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          accessibilityRole="button"
          accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording'}
        >
          <LinearGradient
            colors={
              isRecording
                ? ['#e94560', '#c0392b']
                : ['#1a1a2e', '#16213e']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.micButton,
              isRecording
                ? {
                    shadowColor: '#e94560',
                    shadowOpacity: 0.7,
                    shadowRadius: 16,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: 14,
                  }
                : {
                    shadowColor: '#64ffda',
                    shadowOpacity: 0.3,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 8,
                    borderWidth: 1.5,
                    borderColor: '#64ffda',
                  },
            ]}
          >
            <Ionicons
              name={isRecording ? 'stop' : 'mic'}
              size={36}
              color={isRecording ? '#ffffff' : '#64ffda'}
            />
          </LinearGradient>
        </Pressable>
      </Animated.View>

      {/* Timer */}
      <View style={styles.timerRow}>
        {isRecording && (
          <View style={styles.recordingDot} />
        )}
        <Text style={[styles.timerText, isRecording && styles.timerTextActive]}>
          {formatDuration(duration)}
        </Text>
      </View>

      {/* Instruction */}
      <Text style={styles.instruction}>
        {isRecording
          ? 'Recording… tap to stop'
          : 'Tap the microphone to answer'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    marginBottom: 20,
    gap: 5,
  },
  bar: {
    width: 5,
    height: 40,
    borderRadius: 3,
  },
  pulseRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#e94560',
    top: '50%',
    left: '50%',
    marginLeft: -60,
    marginTop: -10,
  },
  micButton: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    gap: 6,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e94560',
  },
  timerText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#8892b0',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  timerTextActive: {
    color: '#e94560',
  },
  instruction: {
    marginTop: 10,
    fontSize: 13,
    color: '#8892b0',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
});

export default VoiceWaveform;
