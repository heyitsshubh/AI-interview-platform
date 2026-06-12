import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useAppDispatch, useAppSelector } from '../../../src/store';
import { uploadResumeThunk, resetUploadStatus } from '../../../src/store/slices/resumeSlice';
import { Colors } from '../../../src/theme/colors';

export default function ResumeUploadScreen() {
  const dispatch = useAppDispatch();
  const { uploadStatus, error } = useAppSelector((s) => s.resume);

  const [selectedFile, setSelectedFile] = useState<{
    uri: string;
    name: string;
    size?: number;
  } | null>(null);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    return () => {
      dispatch(resetUploadStatus());
    };
  }, []);

  useEffect(() => {
    if (uploadStatus === 'uploading') {
      progressAnim.setValue(0);
      Animated.timing(progressAnim, {
        toValue: 0.9,
        duration: 2500,
        useNativeDriver: false,
      }).start();

      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }

    if (uploadStatus === 'success') {
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start(() => {
        setTimeout(() => {
          Alert.alert('✅ Success', 'Resume uploaded successfully! We\'re processing it now.', [
            { text: 'OK', onPress: () => router.back() },
          ]);
        }, 400);
      });
    }
  }, [uploadStatus]);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      setSelectedFile({
        uri: asset.uri,
        name: asset.name,
        size: asset.size,
      });
      dispatch(resetUploadStatus());
    } catch {
      Alert.alert('Error', 'Failed to pick document. Please try again.');
    }
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    dispatch(uploadResumeThunk({ fileUri: selectedFile.uri, filename: selectedFile.name }));
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isUploading = uploadStatus === 'uploading';

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upload Resume</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          {/* Upload zone */}
          <TouchableOpacity
            style={[styles.dropZone, selectedFile && styles.dropZoneSelected]}
            activeOpacity={0.8}
            onPress={pickDocument}
            disabled={isUploading}
          >
            <Animated.View style={{ transform: [{ scale: isUploading ? pulseAnim : 1 }] }}>
              <LinearGradient
                colors={selectedFile ? ['#e94560', '#c0392b'] : ['#1e2a4a', '#16213e']}
                style={styles.dropZoneIcon}
              >
                <Ionicons
                  name={selectedFile ? 'document-text' : 'cloud-upload-outline'}
                  size={44}
                  color={selectedFile ? '#fff' : Colors.textSecondary}
                />
              </LinearGradient>
            </Animated.View>

            {selectedFile ? (
              <View style={styles.fileInfo}>
                <Text style={styles.fileName} numberOfLines={2}>{selectedFile.name}</Text>
                {selectedFile.size && (
                  <Text style={styles.fileSize}>{formatFileSize(selectedFile.size)}</Text>
                )}
              </View>
            ) : (
              <View style={styles.dropZoneText}>
                <Text style={styles.dropTitle}>Tap to select PDF</Text>
                <Text style={styles.dropSubtitle}>Maximum file size: 10 MB</Text>
              </View>
            )}

            {!isUploading && (
              <View style={styles.dropZoneBorderDash} />
            )}
          </TouchableOpacity>

          {/* Change file button */}
          {selectedFile && !isUploading && (
            <TouchableOpacity style={styles.changeFileBtn} onPress={pickDocument}>
              <Ionicons name="swap-horizontal" size={16} color={Colors.teal} />
              <Text style={styles.changeFileBtnText}>Change file</Text>
            </TouchableOpacity>
          )}

          {/* Progress bar */}
          {(isUploading || uploadStatus === 'success') && (
            <View style={styles.progressWrapper}>
              <View style={styles.progressBar}>
                <Animated.View style={[styles.progressFill, { width: progressWidth }]}>
                  <LinearGradient
                    colors={['#e94560', '#c0392b']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                </Animated.View>
              </View>
              <Text style={styles.progressLabel}>
                {uploadStatus === 'success' ? '100%' : 'Uploading...'}
              </Text>
            </View>
          )}

          {/* Error */}
          {error && uploadStatus === 'error' && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={Colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Success */}
          {uploadStatus === 'success' && (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
              <Text style={styles.successText}>Resume uploaded! Processing in background...</Text>
            </View>
          )}

          {/* Upload button */}
          {selectedFile && uploadStatus !== 'success' && (
            <TouchableOpacity
              style={[styles.uploadButton, isUploading && styles.uploadButtonDisabled]}
              disabled={isUploading}
              onPress={handleUpload}
              activeOpacity={0.85}
            >
              <LinearGradient colors={['#e94560', '#c0392b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.uploadButtonGradient}>
                {isUploading ? (
                  <Text style={styles.uploadButtonText}>Uploading...</Text>
                ) : (
                  <>
                    <Ionicons name="cloud-upload" size={20} color="#fff" />
                    <Text style={styles.uploadButtonText}>Upload Resume</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Info card */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={20} color={Colors.teal} />
            <View style={styles.infoCardText}>
              <Text style={styles.infoTitle}>What happens next?</Text>
              <Text style={styles.infoSubtitle}>We'll extract your skills, experience, and create personalized interview questions tailored to your background.</Text>
            </View>
          </View>
        </Animated.View>
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
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textWhite },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 32, paddingBottom: 40 },
  content: { gap: 16 },
  dropZone: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  dropZoneSelected: {
    borderColor: Colors.accent,
    borderStyle: 'solid',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  dropZoneBorderDash: { position: 'absolute', inset: 0 },
  dropZoneIcon: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  dropZoneText: { alignItems: 'center' },
  dropTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  dropSubtitle: { fontSize: 13, color: Colors.textSecondary },
  fileInfo: { alignItems: 'center' },
  fileName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center', marginBottom: 4 },
  fileSize: { fontSize: 13, color: Colors.textSecondary },
  changeFileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  changeFileBtnText: { color: Colors.teal, fontSize: 14, fontWeight: '600' },
  progressWrapper: { gap: 8 },
  progressBar: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressLabel: { fontSize: 12, color: Colors.textSecondary, textAlign: 'right' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(231,76,60,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(231,76,60,0.3)',
    borderRadius: 12,
    padding: 14,
  },
  errorText: { color: Colors.danger, fontSize: 13, fontWeight: '500', flex: 1 },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(46,204,113,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.3)',
    borderRadius: 12,
    padding: 14,
  },
  successText: { color: Colors.success, fontSize: 13, fontWeight: '500', flex: 1 },
  uploadButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  uploadButtonDisabled: { opacity: 0.7 },
  uploadButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  uploadButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  infoCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(100,255,218,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(100,255,218,0.2)',
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
  },
  infoCardText: { flex: 1 },
  infoTitle: { fontSize: 13, fontWeight: '700', color: Colors.teal, marginBottom: 4 },
  infoSubtitle: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
});
