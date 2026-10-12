// @vitest-environment jsdom
import { AxiosHeaders, type AxiosAdapter, type AxiosResponse } from 'axios';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../auth/api';
import type { ApiEnvelope } from '../../auth/types';
import { MemberListPage } from '../../features/members/MemberListPage';
import type { MemberListItem, PageResponse } from '../../features/members/types';

const originalAdapter = apiClient.defaults.adapter;

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (media: string) => ({
      matches: false,
      media,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
});

function response<T>(config: Parameters<AxiosAdapter>[0], data: T): AxiosResponse<T> {
  return { data, status: 200, statusText: 'OK', headers: new AxiosHeaders(), config };
}

function success<T>(data: T): ApiEnvelope<T> {
  return { success: true, status: 200, code: 'MEMBER_LIST_SUCCESS', message: 'Success.', data, timestamp: '2026-10-01T00:00:00Z' };
}

function page(): PageResponse<MemberListItem> {
  return {
    content: [{
      id: 17,
      memberCode: 'M000017',
      fullName: 'Nguyễn An',
      email: 'an@example.test',
      phone: '0388919210',
      dateOfBirth: null,
      createdAt: '2026-10-01T08:30:00',
      emailVerified: true,
      enabled: true,
    }],
    page: 0,
    size: 10,
    totalElements: 25,
    totalPages: 3,
    first: true,
    last: false,
  };
}

afterEach(() => {
  cleanup();
  apiClient.defaults.adapter = originalAdapter;
  window.sessionStorage.clear();
  vi.useRealTimers();
});

describe('MemberListPage', () => {
  it('debounces text search and resets the server page to the first page', async () => {
    const requests: Record<string, unknown>[] = [];
    apiClient.defaults.adapter = (async (config) => {
      requests.push(config.params as Record<string, unknown>);
      return response(config, success(page()));
    }) satisfies AxiosAdapter;
    render(<MemoryRouter><MemberListPage /></MemoryRouter>);
    expect(await screen.findByText('M000017')).toBeTruthy();
    expect(requests).toHaveLength(1);
    vi.useFakeTimers();

    await act(async () => {
      fireEvent.click(screen.getByTitle('2'));
      await vi.waitFor(() => expect(requests).toHaveLength(2));
    });
    expect(requests[1].page).toBe(1);

    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm theo họ và tên' }), {
      target: { value: 'Nguyễn' },
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(449); });
    expect(requests).toHaveLength(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    await vi.waitFor(() => expect(requests).toHaveLength(3));
    expect(requests[2]).toMatchObject({ fullName: 'Nguyễn', page: 0, size: 10 });
  });

  it('restores a valid saved page, filter, and sort from the current tab', async () => {
    const requests: Record<string, unknown>[] = [];
    window.sessionStorage.setItem('memberManagement:listState:v1', JSON.stringify({
      filters: { fullName: 'An' },
      page: 3,
      sort: 'memberCode,asc',
    }));
    apiClient.defaults.adapter = (async (config) => {
      requests.push(config.params as Record<string, unknown>);
      return response(config, success(page()));
    }) satisfies AxiosAdapter;

    render(<MemoryRouter><MemberListPage /></MemoryRouter>);
    expect(await screen.findByText('M000017')).toBeTruthy();
    expect(requests[0]).toMatchObject({ fullName: 'An', page: 2, size: 10, sort: 'memberCode,asc' });
    expect(screen.getByRole('textbox', { name: 'Tìm theo họ và tên' })).toHaveProperty('value', 'An');
  });

  it('shows a recoverable list error and retries the real API client request', async () => {
    let attempts = 0;
    apiClient.defaults.adapter = (async (config) => {
      attempts += 1;
      if (attempts === 1) throw new Error('offline');
      return response(config, success(page()));
    }) satisfies AxiosAdapter;

    render(<MemoryRouter><MemberListPage /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('M000017')).toBeTruthy();
    expect(attempts).toBe(2);
  });

  it('ignores an older response after a newer filter request succeeds', async () => {
    let resolveStale: (() => void) | undefined;
    let requests = 0;
    apiClient.defaults.adapter = (async (config) => {
      requests += 1;
      if (requests === 1) {
        const stalePage = {
          ...page(),
          content: [{ ...page().content[0], fullName: 'Old response' }],
          totalElements: 1,
          totalPages: 1,
        };
        return new Promise<AxiosResponse<ApiEnvelope<PageResponse<MemberListItem>>>>((resolve) => {
          resolveStale = () => resolve(response(config, success(stalePage)));
        });
      }
      const currentPage = {
        ...page(),
        content: [{ ...page().content[0], fullName: 'Current response' }],
        totalElements: 1,
        totalPages: 1,
      };
      return response(config, success(currentPage));
    }) satisfies AxiosAdapter;

    render(<MemoryRouter><MemberListPage /></MemoryRouter>);
    await vi.waitFor(() => expect(resolveStale).toBeDefined());
    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm theo họ và tên' }), {
      target: { value: 'Current' },
    });
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    await vi.waitFor(() => expect(requests).toBe(2));
    expect(await screen.findByText('Current response')).toBeTruthy();

    await act(async () => {
      resolveStale?.();
      await Promise.resolve();
    });
    expect(screen.queryByText('Old response')).toBeNull();
  });
});
