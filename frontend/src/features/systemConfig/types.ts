export interface SystemConfigHistoryItem {
  id: number;
  action: string;
  actorUsername: string;
  reason: string;
  detail: string;
  createdAt: string;
}

export interface SystemConfigData {
  id: number;
  maintenanceMode: boolean;
  bannerMessage: string | null;
  contactEmail: string | null;
  expectedEndTime: string | null;
  updatedAt: string;
  bypassRoles: string[];
  recentHistories: SystemConfigHistoryItem[];
}

export interface UpdateMaintenancePayload {
  maintenanceMode: boolean;
  reason?: string;
  bannerMessage?: string;
  contactEmail?: string;
  expectedEndTime?: string | null;
}
