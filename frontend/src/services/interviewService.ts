import api from './api';

export interface Interview {
  id: string;
  user_id: string;
  job_title: string;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  total_questions: number;
  created_at: string;
}

export interface Question {
  id: string;
  text: string;
  order_index: number;
  question_type: 'TECHNICAL' | 'BEHAVIORAL' | 'SITUATIONAL';
}

export interface CreateInterviewData {
  job_title: string;
  job_description?: string;
  resume_id?: string;
  total_questions: number;
}

export const InterviewService = {
  async createInterview(data: CreateInterviewData): Promise<Interview> {
    const res = await api.post('/api/interviews/', data);
    return res.data;
  },

  async getHistory(): Promise<Interview[]> {
    const res = await api.get('/api/interviews/history');
    return res.data;
  },

  async getInterview(id: string): Promise<Interview> {
    const res = await api.get(`/api/interviews/${id}`);
    return res.data;
  },

  async startInterview(id: string): Promise<{ status: string; questions_generated: number }> {
    const res = await api.post(`/api/interviews/${id}/start`);
    return res.data;
  },

  async completeInterview(id: string): Promise<{ status: string; report_job_id: string }> {
    const res = await api.post(`/api/interviews/${id}/complete`);
    return res.data;
  },

  async getQuestions(id: string): Promise<Question[]> {
    const res = await api.get(`/api/interviews/${id}/questions`);
    return res.data;
  },

  // Recruiter endpoints
  async getAllInterviews(): Promise<Interview[]> {
    const res = await api.get('/api/interviews/history');
    return res.data;
  },

  async getCandidates(): Promise<any[]> {
    const res = await api.get('/api/users');
    return res.data;
  },

  async deleteInterview(id: string): Promise<void> {
    await api.delete(`/api/interviews/${id}`);
  },
};
