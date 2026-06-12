import api from './api';

export interface SignupData {
  email: string;
  password: string;
  full_name: string;
  role: 'CANDIDATE' | 'RECRUITER';
}

export interface LoginData {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface UserResponse {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  roles: string[];
  created_at: string;
}

export const AuthService = {
  async signup(data: SignupData): Promise<TokenResponse> {
    const res = await api.post('/api/auth/signup', data);
    return res.data;
  },

  async login(data: LoginData): Promise<TokenResponse> {
    const res = await api.post('/api/auth/login', data);
    return res.data;
  },

  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const res = await api.post('/api/auth/refresh', { refresh_token: refreshToken });
    return res.data;
  },

  async logout(): Promise<void> {
    await api.post('/api/auth/logout');
  },

  async getMe(): Promise<UserResponse> {
    const res = await api.get('/api/auth/me');
    return res.data;
  },

  async updateProfile(data: { full_name?: string }): Promise<UserResponse> {
    const res = await api.patch('/api/users/me', data);
    return res.data;
  },
};
