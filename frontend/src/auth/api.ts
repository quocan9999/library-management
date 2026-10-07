import axios from 'axios';
import type { ApiEnvelope, LoginCredentials, LoginData } from './types';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8081',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

export const authApi = {
  async login(credentials: LoginCredentials): Promise<LoginData> {
    const response = await apiClient.post<ApiEnvelope<LoginData>>('/api/v1/auth/login', credentials);
    const data = response.data.data;

    if (!response.data.success || !data?.accessToken) {
      throw new Error('The sign-in response was incomplete.');
    }

    return data;
  },
};
