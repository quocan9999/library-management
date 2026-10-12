// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_MEMBER_LIST_STATE,
  buildMemberListQuery,
  clearMemberListState,
  isValidBirthRange,
  readMemberListState,
  saveMemberListState,
} from '../../features/members/listState';

afterEach(() => window.sessionStorage.clear());

describe('member list view state', () => {
  it('maps one-based UI state to bounded backend filters and whitelist sort', () => {
    const query = buildMemberListQuery({
      fullName: '  Nguyen  ',
      memberCode: '',
      email: 'reader@example.test',
      phone: '0388.919.210',
      birthFrom: '2000-01-01',
      birthTo: '',
      book: ' Dac ',
      borrowStatus: 'RETURNED',
      emailVerified: 'false',
      enabled: 'true',
    }, 3, 'fullName,asc');

    expect(query).toEqual({
      fullName: 'Nguyen',
      email: 'reader@example.test',
      phone: '0388.919.210',
      birthFrom: '2000-01-01',
      book: 'Dac',
      borrowStatus: 'RETURNED',
      emailVerified: false,
      enabled: true,
      page: 2,
      size: 10,
      sort: 'fullName,asc',
    });
  });

  it('restores valid search state and ignores malformed or out-of-range values', () => {
    window.sessionStorage.setItem('memberManagement:listState:v1', JSON.stringify({
      filters: { fullName: 'Nguyen', borrowStatus: 'INVALID', emailVerified: 'all' },
      page: -8,
      sort: 'password,drop table',
    }));

    expect(readMemberListState()).toEqual({
      filters: { ...DEFAULT_MEMBER_LIST_STATE.filters, fullName: 'Nguyen' },
      page: 1,
      sort: DEFAULT_MEMBER_LIST_STATE.sort,
    });
  });

  it('persists only list search state and clears it when the shared session logs out', () => {
    const next = {
      filters: { ...DEFAULT_MEMBER_LIST_STATE.filters, book: 'M001' },
      page: 2,
      sort: 'dateOfBirth,asc',
    };
    saveMemberListState(next);

    expect(readMemberListState()).toEqual(next);
    clearMemberListState();
    expect(readMemberListState()).toEqual(DEFAULT_MEMBER_LIST_STATE);
  });

  it('accepts empty or chronological birth ranges and rejects reversed dates', () => {
    expect(isValidBirthRange('', '')).toBe(true);
    expect(isValidBirthRange('2000-01-01', '')).toBe(true);
    expect(isValidBirthRange('2000-01-01', '2000-01-01')).toBe(true);
    expect(isValidBirthRange('2001-01-01', '2000-12-31')).toBe(false);
  });
});
