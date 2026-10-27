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
  expectedEndTime: string | null;
  updatedAt: string;
  recentHistories: SystemConfigHistoryItem[];
}

export interface UpdateMaintenancePayload {
  maintenanceMode: boolean;
  reason?: string;
  expectedEndTime?: string | null;
}
