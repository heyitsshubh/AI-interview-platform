import api from './api';

export interface Resume {
  id: string;
  user_id: string;
  original_filename: string;
  file_path: string;
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
  extracted_text: string | null;
  embedding_path: string | null;
  created_at: string;
}

export const ResumeService = {
  async uploadResume(fileUri: string, filename: string): Promise<Resume> {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      name: filename,
      type: 'application/pdf',
    } as any);

    const res = await api.post('/api/resumes/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  async getMyResumes(): Promise<Resume[]> {
    const res = await api.get('/api/resumes/me');
    return res.data;
  },

  async getResume(id: string): Promise<Resume> {
    const res = await api.get(`/api/resumes/${id}`);
    return res.data;
  },
};
