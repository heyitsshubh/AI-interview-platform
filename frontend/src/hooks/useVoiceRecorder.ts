import { useState, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import { useAppDispatch } from '../store';
import { setRecording } from '../store/slices/interviewSlice';

interface UseVoiceRecorderReturn {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>;
  isRecording: boolean;
  audioUri: string | null;
  duration: number;
  formatDuration: (secs: number) => string;
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const dispatch = useAppDispatch();
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [isRecording, setIsRecordingLocal] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async (): Promise<void> => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Microphone permission denied');
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      setIsRecordingLocal(true);
      setDuration(0);
      dispatch(setRecording(true));

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
      throw err;
    }
  }, [dispatch]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (!recordingRef.current) return null;

    try {
      await recordingRef.current.stopAndUnloadAsync();

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      const uri = recordingRef.current.getURI() ?? null;
      recordingRef.current = null;
      setIsRecordingLocal(false);
      setDuration(0);
      dispatch(setRecording(false));

      if (uri) setAudioUri(uri);
      return uri;
    } catch (err) {
      console.error('Failed to stop recording:', err);
      dispatch(setRecording(false));
      return null;
    }
  }, [dispatch]);

  const formatDuration = useCallback((secs: number): string => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }, []);

  return {
    startRecording,
    stopRecording,
    isRecording,
    audioUri,
    duration,
    formatDuration,
  };
}
