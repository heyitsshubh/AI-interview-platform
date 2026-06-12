import api from './api';

export type CheatingCategory =
  | 'TAB_SWITCH'
  | 'WINDOW_BLUR'
  | 'COPY_PASTE'
  | 'MULTIPLE_FACES'
  | 'NO_FACE'
  | 'LOOKING_AWAY'
  | 'EXTERNAL_VOICE'
  | 'SCREEN_SHARE'
  | 'DEVTOOLS_OPEN'
  | 'KEYBOARD_MISMATCH';

export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface CheatingEvent {
  id: string;
  interview_id: string;
  user_id: string;
  category: CheatingCategory;
  severity: SeverityLevel;
  description: string | null;
  created_at: string;
}

export interface CheatingReport {
  interview_id: string;
  total_events: number;
  by_category: Record<string, number>;
  by_severity: Record<string, number>;
  integrity_score: number;
  events: CheatingEvent[];
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export const CheatingService = {
  async reportEvent(
    interviewId: string,
    category: CheatingCategory,
    severity: SeverityLevel,
    description?: string
  ): Promise<CheatingEvent> {
    const res = await api.post(`/api/cheating/${interviewId}/event`, {
      interview_id: interviewId,
      category,
      severity,
      description: description ?? null,
      metadata: null,
    });
    return res.data;
  },

  async getReport(interviewId: string): Promise<CheatingReport> {
    const res = await api.get(`/api/cheating/${interviewId}/report`);
    return res.data;
  },

  async getEvents(interviewId: string): Promise<CheatingEvent[]> {
    const res = await api.get(`/api/cheating/${interviewId}/events`);
    return res.data;
  },
};
