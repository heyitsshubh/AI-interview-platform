/**
 * API Service — Axios wrapper for calling FastAPI internal endpoints.
 * All requests include the X-Internal-Key header for authentication.
 */
import axios from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'http://backend:8000';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'internal-secret-key-change-in-production';
const REQUEST_TIMEOUT = 60000; // 60 seconds for AI operations

// ─── Axios Instance ───────────────────────────────────────────────────────────

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'X-Internal-Key': INTERNAL_API_KEY,
  },
});

// Request interceptor — log all outgoing requests
apiClient.interceptors.request.use(
  (config) => {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — log errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    const status = response?.status;
    const url = config?.url;

    // Retry on 5xx errors (up to 3 times)
    config.__retryCount = config.__retryCount || 0;
    if (status >= 500 && config.__retryCount < 3) {
      config.__retryCount += 1;
      const delay = Math.pow(2, config.__retryCount) * 1000;
      console.warn(`[API] Retrying ${url} in ${delay}ms (attempt ${config.__retryCount})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return apiClient(config);
    }

    console.error(`[API] Error ${status} on ${url}: ${response?.data?.detail || error.message}`);
    return Promise.reject(error);
  }
);

// ─── API Service Methods ──────────────────────────────────────────────────────

export const ApiService = {
  /**
   * Update resume processing status.
   */
  async updateResumeStatus(resumeId, status, extractedText = null, embeddingPath = null) {
    const payload = { status };
    if (extractedText !== null) payload.extracted_text = extractedText;
    if (embeddingPath !== null) payload.embedding_path = embeddingPath;

    const { data } = await apiClient.patch(`/api/internal/resumes/${resumeId}/status`, payload);
    return data;
  },

  /**
   * Trigger PDF text extraction for a resume.
   */
  async extractResumeText(resumeId) {
    const { data } = await apiClient.post(`/api/internal/resumes/${resumeId}/extract-text`);
    return data;
  },

  /**
   * Trigger FAISS embedding generation for a resume.
   */
  async generateResumeEmbeddings(resumeId) {
    const { data } = await apiClient.post(`/api/internal/resumes/${resumeId}/generate-embeddings`);
    return data;
  },

  /**
   * Get full interview data (questions, answers, resume text).
   */
  async getInterviewData(interviewId) {
    const { data } = await apiClient.get(`/api/internal/interviews/${interviewId}/full-data`);
    return data;
  },

  /**
   * Run the full AI evaluation pipeline for an interview.
   * Returns { report_path, overall_score, recommendation }
   */
  async runEvaluationPipeline(interviewId) {
    const { data } = await apiClient.post(
      `/api/internal/interviews/${interviewId}/run-evaluation`,
      {},
      { timeout: 300000 } // 5 minute timeout for AI evaluation
    );
    return data;
  },

  /**
   * Save report data to the database.
   */
  async saveReportData(interviewId, reportData) {
    const { data } = await apiClient.post(`/api/internal/reports/${interviewId}`, reportData);
    return data;
  },

  /**
   * Get user email and name for notification.
   */
  async getUserEmail(userId) {
    const { data } = await apiClient.get(`/api/internal/users/${userId}/email`);
    return data;
  },

  /**
   * Get cheating report for an interview.
   */
  async getCheatingReport(interviewId) {
    const { data } = await apiClient.get(`/api/internal/cheating/${interviewId}/report`);
    return data;
  },
};

export default ApiService;
