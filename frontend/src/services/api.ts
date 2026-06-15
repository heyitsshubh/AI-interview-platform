import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { TokenStorage } from '../utils/tokenStorage';

const API_BASE_URL = 'https://ai-interview-platform-7m8j.onrender.com';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach Bearer token from SecureStore
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await TokenStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — on 401 try refresh, retry, then clear tokens
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = await TokenStorage.getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token available');
        const res = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
          refresh_token: refreshToken,
        });
        const { access_token, refresh_token } = res.data;
        await TokenStorage.saveTokens(access_token, refresh_token);
        original.headers.Authorization = `Bearer ${access_token}`;
        return api(original);
      } catch {
        await TokenStorage.clearTokens();
        // Navigation to login is handled by Redux auth middleware / app-level listener
      }
    }
    return Promise.reject(error);
  }
);

export const setAuthToken = (token: string): void => {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};

export const clearAuthToken = (): void => {
  delete api.defaults.headers.common['Authorization'];
};

export default api;
