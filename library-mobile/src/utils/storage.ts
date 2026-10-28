import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'libby_access_token';
const REFRESH_TOKEN_KEY = 'libby_refresh_token';
const USER_KEY = 'libby_user_profile';

const memoryFallback = new Map<string, string>();

export const storage = {
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
          return;
        }
      } catch {
        // Fallback to memory
      }
      memoryFallback.set(key, value);
      return;
    }

    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      memoryFallback.set(key, value);
    }
  },

  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(key);
        }
      } catch {
        // Fallback to memory
      }
      return memoryFallback.get(key) ?? null;
    }

    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return memoryFallback.get(key) ?? null;
    }
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
          return;
        }
      } catch {
        // Fallback to memory
      }
      memoryFallback.delete(key);
      return;
    }

    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      memoryFallback.delete(key);
    }
  },

  async saveToken(token: string): Promise<void> {
    await this.setItem(TOKEN_KEY, token);
  },

  async getToken(): Promise<string | null> {
    return await this.getItem(TOKEN_KEY);
  },

  async removeToken(): Promise<void> {
    await this.removeItem(TOKEN_KEY);
  },

  async saveRefreshToken(token: string): Promise<void> {
    await this.setItem(REFRESH_TOKEN_KEY, token);
  },

  async getRefreshToken(): Promise<string | null> {
    return await this.getItem(REFRESH_TOKEN_KEY);
  },

  async removeRefreshToken(): Promise<void> {
    await this.removeItem(REFRESH_TOKEN_KEY);
  },

  async saveUser(user: object): Promise<void> {
    await this.setItem(USER_KEY, JSON.stringify(user));
  },

  async getUser<T>(): Promise<T | null> {
    const raw = await this.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  async removeUser(): Promise<void> {
    await this.removeItem(USER_KEY);
  },

  async clearAuth(): Promise<void> {
    await Promise.all([this.removeToken(), this.removeRefreshToken(), this.removeUser()]);
  },
};
