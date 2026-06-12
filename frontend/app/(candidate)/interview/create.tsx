import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAppDispatch, useAppSelector } from '../../../src/store';
import {
  createInterviewThunk,
  startInterviewThunk,
  setCurrentInterview,
} from '../../../src/store/slices/interviewSlice';
import { fetchResumesThunk } from '../../../src/store/slices/resumeSlice';
import { Colors } from '../../../src/theme/colors';

const QUESTION_COUNTS = [5, 8, 10, 15];

export default function CreateInterviewScreen() {
  const dispatch = useAppDispatch();
  const { loading, error, currentInterview } = useAppSelector((s) => s.interview);
  const { resumes } = useAppSelector((s) => s.resume);

  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState(8);
  const [step, setStep] = useState<'creating' | 'starting' | 'idle'>('idle');

  const doneResumes = resumes.filter((r) => r.status === 'DONE');

  useEffect(() => {
    dispatch(fetchResumesThunk());
  }, []);

  const handleGenerate = async () => {
    if (!jobTitle.trim()) {
      Alert.alert('Required', 'Please enter a job title.');
      return;
    }

    setStep('creating');
    const createResult = await dispatch(
      createInterviewThunk({
        job_title: jobTitle.trim(),
        job_description: jobDescription.trim() || undefined,
        resume_id: selectedResumeId || undefined,
        total_questions: questionCount,
      })
    );

    if (createInterviewThunk.fulfilled.match(createResult)) {
      const newInterview = createResult.payload;
      setStep('starting');
      dispatch(setCurrentInterview(newInterview));

      const startResult = await dispatch(startInterviewThunk(newInterview.id));
      if (startInterviewThunk.fulfilled.match(startResult)) {
        setStep('idle');
        router.push(`/(candidate)/interview/${newInterview.id}`);
      } else {
        setStep('idle');
        Alert.alert('Error', 'Failed to start interview. Please try again.');
      }
    } else {
      setStep('idle');
      Alert.alert('Error', error || 'Failed to create interview.');
    }
  };

  const isLoading = step !== 'idle' || loading;

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Interview</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Job Title */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            Job Title <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.inputContainer}>
            <Ionicons name="briefcase-outline" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="e.g. Senior React Developer"
              placeholderTextColor={Colors.textMuted}
              value={jobTitle}
              onChangeText={setJobTitle}
            />
          </View>
        </View>

        {/* Job Description */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Job Description <Text style={styles.optional}>(Optional)</Text></Text>
          <View style={[styles.inputContainer, styles.textAreaContainer]}>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Paste the job description here to get more relevant questions..."
              placeholderTextColor={Colors.textMuted}
              value={jobDescription}
              onChangeText={setJobDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Resume picker */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Select Resume <Text style={styles.optional}>(Optional)</Text></Text>
          {doneResumes.length === 0 ? (
            <View style={styles.noResumeCard}>
              <Ionicons name="document-outline" size={24} color={Colors.textMuted} />
              <Text style={styles.noResumeText}>No processed resumes available</Text>
              <TouchableOpacity onPress={() => router.push('/(candidate)/resume/upload')}>
                <Text style={styles.noResumeLink}>Upload a resume →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.resumeList}>
              {doneResumes.map((resume) => {
                const isSelected = selectedResumeId === resume.id;
                return (
                  <TouchableOpacity
                    key={resume.id}
                    style={[styles.resumeCard, isSelected && styles.resumeCardSelected]}
                    onPress={() => setSelectedResumeId(isSelected ? null : resume.id)}
                  >
                    {isSelected && (
                      <LinearGradient
                        colors={['rgba(233,69,96,0.1)', 'rgba(233,69,96,0.03)']}
                        style={StyleSheet.absoluteFill}
                        borderRadius={12}
                      />
                    )}
                    <Ionicons
                      name="document-text"
                      size={20}
                      color={isSelected ? Colors.accent : Colors.textSecondary}
                    />
                    <Text
                      style={[styles.resumeCardName, isSelected && { color: Colors.accent }]}
                      numberOfLines={1}
                    >
                      {resume.original_filename}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={Colors.accent} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Question count selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Number of Questions</Text>
          <View style={styles.countRow}>
            {QUESTION_COUNTS.map((count) => {
              const isSelected = questionCount === count;
              return (
                <TouchableOpacity
                  key={count}
                  style={[styles.countBtn, isSelected && styles.countBtnSelected]}
                  onPress={() => setQuestionCount(count)}
                >
                  {isSelected ? (
                    <LinearGradient
                      colors={['#e94560', '#c0392b']}
                      style={StyleSheet.absoluteFill}
                      borderRadius={10}
                    />
                  ) : null}
                  <Text style={[styles.countBtnText, isSelected && styles.countBtnTextSelected]}>
                    {count}
                  </Text>
                  <Text style={[styles.countBtnSub, isSelected && { color: 'rgba(255,255,255,0.7)' }]}>
                    {count <= 5 ? 'Quick' : count <= 8 ? 'Standard' : count <= 10 ? 'Thorough' : 'Deep Dive'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* AI Info card */}
        <View style={styles.aiInfoCard}>
          <LinearGradient colors={['rgba(100,255,218,0.08)', 'rgba(100,255,218,0.03)']} style={styles.aiInfoGradient}>
            <Ionicons name="sparkles" size={22} color={Colors.teal} />
            <View style={styles.aiInfoText}>
              <Text style={styles.aiInfoTitle}>AI-Powered Questions</Text>
              <Text style={styles.aiInfoSubtitle}>
                Our AI generates personalized questions based on your job title, description, and resume.
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* Generate button */}
        <TouchableOpacity
          style={[styles.generateBtn, isLoading && styles.generateBtnDisabled]}
          disabled={isLoading}
          onPress={handleGenerate}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#e94560', '#c0392b']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.generateBtnGradient}
          >
            {isLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.generateBtnText}>
                  {step === 'creating' ? 'Creating interview...' : 'Generating questions...'}
                </Text>
              </View>
            ) : (
              <>
                <Ionicons name="sparkles" size={20} color="#fff" />
                <Text style={styles.generateBtnText}>Generate Interview</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
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
  scrollContent: { padding: 20, paddingBottom: 48 },
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  required: { color: Colors.accent },
  optional: { color: Colors.textMuted, fontWeight: '400', textTransform: 'none' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    height: 52,
  },
  textAreaContainer: { height: 110, alignItems: 'flex-start', paddingTop: 12 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: Colors.textPrimary, fontSize: 15 },
  textArea: { height: 90, textAlignVertical: 'top' },
  noResumeCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  noResumeText: { fontSize: 14, color: Colors.textSecondary },
  noResumeLink: { fontSize: 14, color: Colors.teal, fontWeight: '600' },
  resumeList: { gap: 8 },
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  resumeCardSelected: {
    borderColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  resumeCardName: { flex: 1, fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
  countRow: { flexDirection: 'row', gap: 10 },
  countBtn: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  countBtnSelected: {
    borderColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,
  },
  countBtnText: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  countBtnTextSelected: { color: '#fff' },
  countBtnSub: { fontSize: 10, color: Colors.textMuted, fontWeight: '600', marginTop: 2 },
  aiInfoCard: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(100,255,218,0.2)',
    marginBottom: 24,
  },
  aiInfoGradient: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 16,
  },
  aiInfoText: { flex: 1 },
  aiInfoTitle: { fontSize: 14, fontWeight: '700', color: Colors.teal, marginBottom: 4 },
  aiInfoSubtitle: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  generateBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  generateBtnDisabled: { opacity: 0.7 },
  generateBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  generateBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
