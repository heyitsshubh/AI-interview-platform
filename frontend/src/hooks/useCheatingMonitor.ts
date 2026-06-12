import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { CheatingService, CheatingCategory, SeverityLevel } from '../services/cheatingService';

interface UseCheatingMonitorReturn {
  reportCheat: (category: CheatingCategory, description: string) => Promise<void>;
}

/** Maps each cheating category to a default severity level. */
const SEVERITY_MAP: Record<CheatingCategory, SeverityLevel> = {
  TAB_SWITCH: 'MEDIUM',
  WINDOW_BLUR: 'LOW',
  COPY_PASTE: 'MEDIUM',
  MULTIPLE_FACES: 'HIGH',
  NO_FACE: 'MEDIUM',
  LOOKING_AWAY: 'LOW',
  EXTERNAL_VOICE: 'MEDIUM',
  SCREEN_SHARE: 'HIGH',
  DEVTOOLS_OPEN: 'HIGH',
  KEYBOARD_MISMATCH: 'HIGH',
};

/**
 * useCheatingMonitor
 *
 * Monitors device/app events that could indicate dishonest behaviour during an
 * interview session and reports them to the backend via CheatingService.
 *
 * Currently detects:
 *   - App going to background (WINDOW_BLUR / TAB_SWITCH)
 *
 * Additional detectors (face, voice, clipboard) can be wired in by
 * calling `reportCheat` from camera/audio callbacks in the parent screen.
 *
 * @param interviewId  Active interview ID. Pass `null` when outside a session.
 * @param enabled      Set to `false` to fully disable monitoring.
 */
export function useCheatingMonitor(
  interviewId: string | null,
  enabled: boolean = true
): UseCheatingMonitorReturn {
  const appStateRef = useRef<AppStateStatus>('active');
  const tabSwitchCountRef = useRef<number>(0);

  const reportCheat = useCallback(
    async (category: CheatingCategory, description: string): Promise<void> => {
      if (!interviewId || !enabled) return;

      try {
        const severity = SEVERITY_MAP[category];
        await CheatingService.reportEvent(interviewId, category, severity, description);
        console.warn(`[CheatingMonitor] ${category} (${severity}): ${description}`);
      } catch (err) {
        // Silently swallow — a reporting failure must never crash the interview
        console.error('[CheatingMonitor] Failed to report event:', err);
      }
    },
    [interviewId, enabled]
  );

  // ── App background / foreground detection ─────────────────────────────────
  useEffect(() => {
    if (!enabled || !interviewId) return;

    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        const wasActive = appStateRef.current === 'active';
        const isNowBackground = nextState !== 'active';

        if (wasActive && isNowBackground) {
          tabSwitchCountRef.current += 1;
          const count = tabSwitchCountRef.current;

          // First occurrence → WINDOW_BLUR; repeated → TAB_SWITCH (higher intent)
          const category: CheatingCategory =
            count === 1 ? 'WINDOW_BLUR' : 'TAB_SWITCH';

          reportCheat(
            category,
            `App moved to background (occurrence #${count})`
          );
        }

        appStateRef.current = nextState;
      }
    );

    return () => {
      subscription.remove();
    };
  }, [enabled, interviewId, reportCheat]);

  return { reportCheat };
}
