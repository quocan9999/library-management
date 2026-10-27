import { apiClient } from '../../auth/api';
import type { ApiEnvelope } from '../../auth/types';
import type { SystemConfigData, UpdateMaintenancePayload } from './types';

function readConfigData(envelope: ApiEnvelope<SystemConfigData>): SystemConfigData {
  if (!envelope.success || !envelope.data) {
    throw new Error(envelope.message || 'Không thể lấy dữ liệu cấu hình hệ thống.');
  }
  return envelope.data;
}

export const systemConfigApi = {
  async getSystemConfig(signal?: AbortSignal): Promise<SystemConfigData> {
    const response = await apiClient.get<ApiEnvelope<SystemConfigData>>('/api/v1/system-configs', { signal });
    return readConfigData(response.data);
  },

  async updateMaintenanceMode(payload: UpdateMaintenancePayload): Promise<SystemConfigData> {
    const response = await apiClient.patch<ApiEnvelope<SystemConfigData>>(
      '/api/v1/system-configs/maintenance',
      payload,
    );
    return readConfigData(response.data);
  },
};
