import api from './api';

export interface ReportSummary {
  interview_id: string;
  status: string;
  overall_score: number | null;
  technical_score: number | null;
  communication_score: number | null;
  integrity_score: number | null;
  recommendation: 'STRONG_HIRE' | 'HIRE' | 'MAYBE' | 'REJECT' | null;
  feedback: any;
  report_available: boolean;
  created_at: string | null;
}

export const ReportService = {
  async getSummary(interviewId: string): Promise<ReportSummary> {
    const res = await api.get(`/api/reports/${interviewId}/summary`);
    return res.data;
  },

  getDownloadUrl(interviewId: string): string {
    const base = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:8000';
    return `${base}/api/reports/${interviewId}/download`;
  },
};
