export interface StaffProfile {
  id: number;
  staffCode: string;
  fullName: string;
  dateOfBirth: string;
  phone: string;
  address?: string | null;
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminAccount {
  id: number;
  username: string;
  email: string;
  roleCode: string;
  roleDisplayName: string;
  emailVerified: boolean;
  enabled: boolean;
  systemAccount: boolean;
  sessionVersion: number;
  createdAt: string;
  staff?: StaffProfile | null;
}

export interface AdminAccountPage {
  content: AdminAccount[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface AdminAccountSearchQuery {
  username?: string;
  email?: string;
  roleCode?: string;
  enabled?: boolean;
  emailVerified?: boolean;
  page: number;
  size: number;
  sort: string;
}

export interface AdminAccountCreateRequest {
  username: string;
  email: string;
  password: string;
  roleCode: string;
  fullName: string;
  dateOfBirth: string;
  phone: string;
  address?: string | null;
}

export interface AdminAccountRoleUpdateRequest {
  roleCode: string;
  expectedSessionVersion: number;
}

export interface AdminAccountStatusUpdateRequest {
  enabled: boolean;
  expectedSessionVersion: number;
}

export interface StaffProfileUpdateRequest {
  version: number;
  fullName?: string | null;
  dateOfBirth?: string | null;
  phone?: string | null;
  address?: string | null;
}
