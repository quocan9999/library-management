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
}

export interface AdminAccountRoleUpdateRequest {
  roleCode: string;
  expectedSessionVersion: number;
}

export interface AdminAccountStatusUpdateRequest {
  enabled: boolean;
  expectedSessionVersion: number;
}
