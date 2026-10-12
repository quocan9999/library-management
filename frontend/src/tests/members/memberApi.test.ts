// @vitest-environment jsdom
import {
  AxiosHeaders,
  type AxiosAdapter,
  type AxiosResponse,
} from 'axios';
import { afterEach, describe, expect, it } from 'vitest';
import { apiClient } from '../../auth/api';
import type { ApiEnvelope } from '../../auth/types';
import { memberApi } from '../../features/members/api';
import type {
  LoanHistoryItem,
  MemberDetail,
  MemberListItem,
  PageResponse,
} from '../../features/members/types';

const originalAdapter = apiClient.defaults.adapter;

function response<T>(config: Parameters<AxiosAdapter>[0], data: T): AxiosResponse<T> {
  return { data, status: 200, statusText: 'OK', headers: new AxiosHeaders(), config };
}

function envelope<T>(code: string, data: T): ApiEnvelope<T> {
  return { success: true, status: 200, code, message: 'Success.', data, timestamp: new Date().toISOString() };
}

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
});

describe('member API', () => {
  it('uses the shared client and preserves list, detail, and LoanItem page contracts', async () => {
    const member: MemberListItem = {
      id: 17,
      memberCode: 'M000017',
      fullName: 'Nguyễn An',
      email: 'an@example.test',
      phone: '0388919210',
      dateOfBirth: '2000-01-02',
      createdAt: '2026-10-01T08:30:00',
      emailVerified: true,
      enabled: true,
    };
    const detail: MemberDetail = {
      ...member,
      address: null,
      updatedAt: '2026-10-02T08:30:00',
      version: 0,
      borrowedItemCount: 1,
    };
    const historyItem: LoanHistoryItem = {
      loanItemId: 91,
      loanId: 20,
      loanCode: 'L000020',
      loanStatus: 'PARTIALLY_RETURNED',
      bookId: 7,
      bookCode: 'B000007',
      bookTitle: 'Đắc nhân tâm',
      bookAuthor: 'Dale Carnegie',
      isbn: null,
      itemStatus: 'BORROWED',
      borrowedAt: '2026-10-01T08:30:00',
      dueDate: '2026-10-15',
      returnedAt: null,
      borrowFee: 12.34,
      lateFeePerDay: 1.25,
      lateFee: 0,
      recordedTotalFee: 12.34,
    };
    const page = <T,>(content: T[]): PageResponse<T> => ({
      content,
      page: 0,
      size: 10,
      totalElements: content.length,
      totalPages: content.length ? 1 : 0,
      first: true,
      last: true,
    });
    const requests: Array<{ method: string; url: string; params: unknown }> = [];
    apiClient.defaults.adapter = (async (config) => {
      requests.push({ method: config.method ?? '', url: config.url ?? '', params: config.params });
      if (config.url === '/api/v1/members' && config.method === 'get') {
        return response(config, envelope('MEMBER_LIST_SUCCESS', page([member])));
      }
      if (config.url === '/api/v1/members/17' && config.method === 'get') {
        return response(config, envelope('MEMBER_DETAIL_SUCCESS', detail));
      }
      if (config.url === '/api/v1/members/17/loan-history' && config.method === 'get') {
        return response(config, envelope('MEMBER_LOAN_HISTORY_SUCCESS', page([historyItem])));
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    }) satisfies AxiosAdapter;

    const list = await memberApi.getMembers({ page: 0, size: 10, sort: 'createdAt,desc', fullName: 'Nguyen' });
    const loadedDetail = await memberApi.getMember(17);
    const history = await memberApi.getLoanHistory(17, { status: 'RETURNED', page: 1, size: 10 });

    expect(list.content[0]).toEqual(member);
    expect(loadedDetail).toEqual(detail);
    expect(history.content[0]).toEqual(historyItem);
    expect(requests.map(({ method, url }) => [method, url])).toEqual([
      ['get', '/api/v1/members'],
      ['get', '/api/v1/members/17'],
      ['get', '/api/v1/members/17/loan-history'],
    ]);
    expect(requests[0]?.params).toEqual({ page: 0, size: 10, sort: 'createdAt,desc', fullName: 'Nguyen' });
    expect(requests[2]?.params).toEqual({ status: 'RETURNED', page: 1, size: 10 });
  });

  it('rejects an envelope with the wrong Member response code', async () => {
    apiClient.defaults.adapter = (async (config) => response(config, envelope('OTHER_SUCCESS', {
      content: [], page: 0, size: 10, totalElements: 0, totalPages: 0, first: true, last: true,
    }))) satisfies AxiosAdapter;

    await expect(memberApi.getMembers({ page: 0, size: 10, sort: 'createdAt,desc' }))
      .rejects.toThrow('Phản hồi quản lý thành viên không hợp lệ.');
  });
});
