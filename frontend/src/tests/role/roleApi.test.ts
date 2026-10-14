// @vitest-environment jsdom
import {
  AxiosHeaders,
  type AxiosAdapter,
  type AxiosResponse,
} from 'axios';
import { afterEach, describe, expect, it } from 'vitest';
import { apiClient } from '../../auth/api';
import type { ApiEnvelope } from '../../auth/types';
import { roleApi } from '../../role/api';

const originalAdapter = apiClient.defaults.adapter;

function response<T>(config: Parameters<AxiosAdapter>[0], data: T): AxiosResponse<T> {
  return { data, status: 200, statusText: 'OK', headers: new AxiosHeaders(), config };
}

function envelope<T>(code: string, data: T): ApiEnvelope<T> {
  return {
    success: true,
    status: 200,
    code,
    message: 'Success.',
    data,
    timestamp: new Date().toISOString(),
  };
}

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
});

describe('role API client', () => {
  it('uses the shared API client and preserves the backend role DTO contracts', async () => {
    const requests: Array<{ method: string; url: string; body: unknown }> = [];
    apiClient.defaults.adapter = (async (config) => {
      requests.push({ method: config.method ?? '', url: config.url ?? '', body: config.data });
      if (config.url === '/api/v1/roles' && config.method === 'get') {
        return response(config, envelope('ROLE_LIST_SUCCESS', [
          { code: 'USER', description: 'Người dùng', version: 4, canEdit: true },
        ]));
      }
      if (config.url === '/api/v1/permissions') {
        return response(config, envelope('PERMISSION_LIST_SUCCESS', [
          { code: 'book:read', description: 'Xem sách', manageableByActor: true },
        ]));
      }
      if (config.url === '/api/v1/roles/USER/permissions' && config.method === 'get') {
        return response(config, envelope('ROLE_PERMISSIONS_SUCCESS', {
          roleCode: 'USER',
          version: 4,
          assignedPermissions: [],
          effectivePermissions: [],
          editablePermissions: ['book:read'],
          editable: true,
        }));
      }
      if (config.url === '/api/v1/roles/USER/permissions' && config.method === 'patch') {
        return response(config, envelope('ROLE_PERMISSIONS_UPDATED', {
          roleCode: 'USER',
          version: 5,
          assignedPermissions: ['book:read'],
          effectivePermissions: ['book:read'],
          editablePermissions: ['book:read'],
          editable: true,
        }));
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    }) satisfies AxiosAdapter;

    await expect(roleApi.getRoles()).resolves.toEqual([
      { code: 'USER', description: 'Người dùng', version: 4, canEdit: true },
    ]);
    await expect(roleApi.getPermissionCatalog()).resolves.toEqual([
      { code: 'book:read', description: 'Xem sách', manageableByActor: true },
    ]);
    await expect(roleApi.getRolePermissions('USER')).resolves.toMatchObject({ version: 4 });
    await roleApi.updatePermissions('USER', {
      expectedVersion: 4,
      addPermissions: ['book:read'],
      removePermissions: [],
    });

    expect(requests.map(({ method, url }) => [method, url])).toEqual([
      ['get', '/api/v1/roles'],
      ['get', '/api/v1/permissions'],
      ['get', '/api/v1/roles/USER/permissions'],
      ['patch', '/api/v1/roles/USER/permissions'],
    ]);
    expect(JSON.parse(String(requests[3]?.body))).toEqual({
      expectedVersion: 4,
      addPermissions: ['book:read'],
      removePermissions: [],
    });
  });
});
