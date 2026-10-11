export interface ApiEnvelope<T> {
  success: boolean;
  status: number;
  code: string;
  message: string;
  data: T | null;
  errors?: Record<string, string> | null;
  timestamp: string;
}

export interface LoginCredentials {
  identifier: string;
  password: string;
}

export interface LoginData {
  accessToken: string;
  tokenType: 'Bearer';
  accessTokenExpiresIn: number;
}

export interface RegisterCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  emailVerificationRequired: true;
}
