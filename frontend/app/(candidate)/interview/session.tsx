import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  TextInput,
  AppState,
  AppStateStatus,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAppDispatch, useAppSelector } from '../../../src/store';
import {
  nextQuestion,
  setRecording,
  setTranscript,
  setWsStatus,
  setSessionCompleted,
  resetSession,
} from '../../../src/store/slices/interviewSlice';
import { completeInterviewThunk } from '../../../src/store/slices/interviewSlice';
import { CheatingService } from '../../../src/services/cheatingService';
import { Colors } from '../../../src/theme/colors';

const WS_BASE = (process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:8000').replace('http', 'ws');

function WaveformBar({ index, isRecording }: { index: number; isRecording: boolean }) {
  const anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (isRecording) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 0.2 + Math.random() * 0.8,
            duration: 200 + index * 50,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.2 + Math.random() * 0.4,
            duration: 200 + index * 50,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      Animated.timing(anim, { toValue: 0.3, duration: 300, useNativeDriver: true }).start();
    }
  }, [isRecording]);

  return (
    <Animated.View
      style={[
        styles.waveBar,
        { transform: [{ scaleY: anim }], backgroundColor: isRecording ? Colors.accent : Colors.border },
      ]}
    />
  );
}

export default function InterviewSessionScreen() {
  const dispatch = useAppDispatch();
  const {
    currentInterview,
    questions,
    currentQuestionIndex,
    isRecording,
    transcript,
    wsStatus,
    sessionCompleted,
  } = useAppSelector((s) => s.interview);
  const { accessToken } = useAppSelector((s) => s.auth);

  const [answered, setAnswered] = useState(false);
  const [textAnswer, setTextAnswer] = useState('');
  const [useTextFallback, setUseTextFallback] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [completing, setCompleting] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const completionAnim = useRef(new Animated.Value(0)).current;
  const micScaleAnim = useRef(new Animated.Value(1)).current;

  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;

  // Connect WebSocket
  useEffect(() => {
    if (!currentInterview?.id || !accessToken) return;

    const wsUrl = `${WS_BASE}/api/interviews/ws/${currentInterview.id}/session?token=${accessToken}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      dispatch(setWsStatus('connected'));
      ws.send(JSON.stringify({ type: 'hello' }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'question' || data.type === 'next_question') {
          // Server confirming question delivery
        }
      } catch {
        // binary or non-JSON
      }
    };

    ws.onerror = () => dispatch(setWsStatus('error'));
    ws.onclose = () => dispatch(setWsStatus('disconnected'));

    dispatch(setWsStatus('connecting'));

    return () => {
      ws.close();
    };
  }, [currentInterview?.id, accessToken]);

  // Track app state (cheating monitor)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (
        appStateRef.current === 'active' &&
        (nextState === 'background' || nextState === 'inactive')
      ) {
        // Report cheating event
        if (currentInterview?.id) {
          CheatingService.reportEvent(
            currentInterview.id,
            'TAB_SWITCH',
            'MEDIUM',
            'User left app during interview'
          ).catch(() => {});
        }
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [currentInterview?.id]);

  // Progress animation
  useEffect(() => {
    const progress = totalQuestions > 0 ? (currentQuestionIndex + 1) / totalQuestions : 0;
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 500,
      useNativeDriver: false,
    }).start();
    setAnswered(false);
    setTextAnswer('');
  }, [currentQuestionIndex, totalQuestions]);

  // Completion animation
  useEffect(() => {
    if (sessionCompleted) {
      Animated.spring(completionAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }
  }, [sessionCompleted]);

  const startRecording = useCallback(() => {
    dispatch(setRecording(true));
    setRecordDuration(0);

    // Pulse mic animation
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(micScaleAnim, { toValue: 1.15, duration: 500, useNativeDriver: true }),
        Animated.timing(micScaleAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    pulse.start();

    recordTimerRef.current = setInterval(() => {
      setRecordDuration((d) => d + 1);
    }, 1000);
  }, []);

  const stopRecording = useCallback(() => {
    dispatch(setRecording(false));
    micScaleAnim.setValue(1);

    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }

    // Simulate getting transcript and submitting
    const mockTranscript = `[Voice answer recorded - ${recordDuration}s]`;
    dispatch(setTranscript(mockTranscript));
    submitAnswer(mockTranscript);
  }, [recordDuration, currentQuestion]);

  const submitAnswer = useCallback(
    (answerText: string) => {
      if (!currentQuestion || !answerText.trim()) return;

      setAnswered(true);

      // Send via WebSocket
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'answer',
            question_id: currentQuestion.id,
            text: answerText,
          })
        );
      } else {
        Alert.alert("Connection Error", "WebSocket is not connected. Your answer could not be sent.");
        console.error("WebSocket readyState:", wsRef.current?.readyState);
      }
    },
    [currentQuestion]
  );

  const handleTextSubmit = () => {
    if (!textAnswer.trim()) return;
    dispatch(setTranscript(textAnswer));
    submitAnswer(textAnswer);
  };

  const handleNext = () => {
    dispatch(nextQuestion());
    setTextAnswer('');
  };

  const handleComplete = async () => {
    if (!currentInterview?.id) return;
    setCompleting(true);
    await dispatch(completeInterviewThunk(currentInterview.id));
    setCompleting(false);
    dispatch(resetSession());
    router.replace(`/(candidate)/interview/report?interviewId=${currentInterview.id}`);
  };

  const handleExitConfirm = () => {
    Alert.alert(
      'Exit Interview?',
      'Your progress will be saved but the interview may remain incomplete.',
      [
        { text: 'Continue Interview', style: 'cancel' },
        {
          text: 'Exit',
          style: 'destructive',
          onPress: () => {
            wsRef.current?.close();
            dispatch(resetSession());
            router.back();
          },
        },
      ]
    );
  };

  const formatDuration = (secs: number): string => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  if (!currentQuestion && !sessionCompleted) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={styles.loadingText}>Loading questions...</Text>
      </View>
    );
  }

  // Completion screen
  if (sessionCompleted) {
    return (
      <View style={styles.root}>
        <LinearGradient colors={['#0f0f1a', '#1a1a2e', '#0f3460']} style={styles.completionScreen}>
          <Animated.View
            style={[
              styles.completionContent,
              {
                opacity: completionAnim,
                transform: [{ scale: completionAnim }],
              },
            ]}
          >
            <LinearGradient colors={['#2ecc71', '#27ae60']} style={styles.completionIcon}>
              <Ionicons name="checkmark" size={48} color="#fff" />
            </LinearGradient>
            <Text style={styles.completionTitle}>Interview Complete! 🎉</Text>
            <Text style={styles.completionSubtitle}>
              You've answered all {totalQuestions} questions. Your report is being generated.
            </Text>
            <TouchableOpacity
              style={styles.completeBtn}
              onPress={handleComplete}
              disabled={completing}
            >
              <LinearGradient colors={['#e94560', '#c0392b']} style={styles.completeBtnGradient}>
                {completing ? (
                  <Text style={styles.completeBtnText}>Finalizing...</Text>
                ) : (
                  <>
                    <Ionicons name="bar-chart" size={20} color="#fff" />
                    <Text style={styles.completeBtnText}>Complete & View Report</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </LinearGradient>
      </View>
    );
  }

  if (!currentQuestion) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: Colors.textSecondary }}>Loading questions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#0f0f1a', '#1a1a2e', '#16213e']} style={StyleSheet.absoluteFill} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleExitConfirm} style={styles.exitBtn}>
          <Ionicons name="close" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.progressInfo}>
          <Text style={styles.progressLabel}>
            Q{currentQuestionIndex + 1} / {totalQuestions}
          </Text>
          <View style={[styles.wsDot, { backgroundColor: wsStatus === 'connected' ? Colors.success : Colors.warning }]} />
        </View>

        <View style={{ width: 40 }} />
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]}>
          <LinearGradient colors={['#e94560', '#c0392b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Question type chip */}
        <View style={styles.questionTypeChipRow}>
          <View style={[styles.questionTypeChip, { backgroundColor: 'rgba(100,255,218,0.12)' }]}>
            <Ionicons name="help-circle" size={14} color={Colors.teal} />
            <Text style={[styles.questionTypeText, { color: Colors.teal }]}>
              {currentQuestion.question_type}
            </Text>
          </View>
        </View>

        {/* Question card */}
        <View style={styles.questionCard}>
          <LinearGradient colors={['#1e2a4a', '#16213e']} style={styles.questionCardGradient} borderRadius={20}>
            <Text style={styles.questionText}>{currentQuestion.text}</Text>
          </LinearGradient>
        </View>

        {/* Recording / Text input area */}
        {!answered ? (
          <View style={styles.answerArea}>
            {!useTextFallback ? (
              <>
                {/* Waveform */}
                <View style={styles.waveformContainer}>
                  {Array.from({ length: 20 }).map((_, i) => (
                    <WaveformBar key={i} index={i} isRecording={isRecording} />
                  ))}
                </View>

                {/* Mic button */}
                <TouchableOpacity
                  onPressIn={startRecording}
                  onPressOut={stopRecording}
                  activeOpacity={0.85}
                  style={styles.micBtnWrapper}
                >
                  <Animated.View style={[styles.micRipple, {
                    transform: [{ scale: micScaleAnim }],
                    opacity: isRecording ? 0.4 : 0,
                  }]} />
                  <LinearGradient
                    colors={isRecording ? ['#e74c3c', '#c0392b'] : ['#e94560', '#c0392b']}
                    style={styles.micBtn}
                  >
                    <Ionicons name={isRecording ? 'mic' : 'mic-outline'} size={36} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>

                {isRecording && (
                  <View style={styles.recordingInfo}>
                    <View style={styles.recordingDot} />
                    <Text style={styles.recordingText}>Recording... {formatDuration(recordDuration)}</Text>
                  </View>
                )}

                {!isRecording && (
                  <Text style={styles.holdToRecord}>Hold mic to record your answer</Text>
                )}

                <TouchableOpacity onPress={() => setUseTextFallback(true)} style={styles.fallbackBtn}>
                  <Ionicons name="create-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.fallbackText}>Type instead</Text>
                </TouchableOpacity>
              </>
            ) : (
              /* Text fallback */
              <View style={styles.textFallbackArea}>
                <TouchableOpacity onPress={() => setUseTextFallback(false)} style={styles.switchToMic}>
                  <Ionicons name="mic-outline" size={16} color={Colors.teal} />
                  <Text style={styles.switchToMicText}>Use voice instead</Text>
                </TouchableOpacity>
                <View style={styles.textInputContainer}>
                  <TextInput
                    style={styles.textAnswerInput}
                    placeholder="Type your answer here..."
                    placeholderTextColor={Colors.textMuted}
                    value={textAnswer}
                    onChangeText={setTextAnswer}
                    multiline
                    numberOfLines={5}
                    textAlignVertical="top"
                  />
                </View>
                <TouchableOpacity
                  style={[styles.submitTextBtn, !textAnswer.trim() && styles.submitTextBtnDisabled]}
                  disabled={!textAnswer.trim()}
                  onPress={handleTextSubmit}
                >
                  <LinearGradient colors={['#e94560', '#c0392b']} style={styles.submitTextBtnGradient}>
                    <Ionicons name="send" size={18} color="#fff" />
                    <Text style={styles.submitTextBtnText}>Submit Answer</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          /* Answer confirmed */
          <View style={styles.answeredArea}>
            <View style={styles.answeredBanner}>
              <Ionicons name="checkmark-circle" size={22} color={Colors.success} />
              <Text style={styles.answeredText}>Answer recorded!</Text>
            </View>
            {transcript ? (
              <View style={styles.transcriptCard}>
                <Text style={styles.transcriptLabel}>Your answer:</Text>
                <Text style={styles.transcriptText}>{transcript}</Text>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* Next button */}
      {answered && (
        <View style={styles.nextBtnWrapper}>
          <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
            <LinearGradient
              colors={currentQuestionIndex < totalQuestions - 1 ? ['#e94560', '#c0392b'] : ['#2ecc71', '#27ae60']}
              style={styles.nextBtnGradient}
            >
              <Text style={styles.nextBtnText}>
                {currentQuestionIndex < totalQuestions - 1 ? 'Next Question' : 'Finish Interview'}
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  exitBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  progressInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressLabel: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  wsDot: { width: 8, height: 8, borderRadius: 4 },
  progressBar: {
    height: 5,
    backgroundColor: Colors.border,
    marginHorizontal: 20,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100, paddingTop: 24 },
  questionTypeChipRow: { marginBottom: 16 },
  questionTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  questionTypeText: { fontSize: 12, fontWeight: '700' },
  questionCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  questionCardGradient: { padding: 24 },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textWhite,
    lineHeight: 28,
    textAlign: 'center',
  },
  answerArea: { alignItems: 'center', gap: 20 },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    gap: 3,
    paddingHorizontal: 10,
  },
  waveBar: { width: 4, height: 40, borderRadius: 2 },
  micBtnWrapper: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  micRipple: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.accent,
  },
  micBtn: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
  },
  recordingInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.danger },
  recordingText: { fontSize: 15, fontWeight: '600', color: Colors.danger },
  holdToRecord: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  fallbackBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  fallbackText: { fontSize: 13, color: Colors.textSecondary },
  textFallbackArea: { width: '100%', gap: 14 },
  switchToMic: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  switchToMicText: { fontSize: 13, color: Colors.teal, fontWeight: '600' },
  textInputContainer: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  textAnswerInput: { color: Colors.textPrimary, fontSize: 15, minHeight: 120 },
  submitTextBtn: { borderRadius: 12, overflow: 'hidden' },
  submitTextBtnDisabled: { opacity: 0.5 },
  submitTextBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  submitTextBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  answeredArea: { gap: 16 },
  answeredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(46,204,113,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.3)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  answeredText: { fontSize: 15, fontWeight: '700', color: Colors.success },
  transcriptCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  transcriptLabel: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6, textTransform: 'uppercase' },
  transcriptText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  nextBtnWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 36,
    backgroundColor: 'rgba(15,15,26,0.95)',
  },
  nextBtn: { borderRadius: 14, overflow: 'hidden' },
  nextBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  // Completion
  completionScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  completionContent: { alignItems: 'center', gap: 20 },
  completionIcon: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 14,
  },
  completionTitle: { fontSize: 28, fontWeight: '800', color: Colors.textWhite, textAlign: 'center' },
  completionSubtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  completeBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 8 },
  completeBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    gap: 10,
  },
  completeBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
