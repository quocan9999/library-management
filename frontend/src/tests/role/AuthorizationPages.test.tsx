// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthorizationLandingPage } from '../../role/AuthorizationPages';

afterEach(cleanup);

describe('authorization overview', () => {
  it('shows exactly the group-management and assignment cards', () => {
    render(<MemoryRouter><AuthorizationLandingPage /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Quản lý phân quyền' })).toBeTruthy();
    const cards = screen.getAllByRole('link');
    expect(cards).toHaveLength(2);
    expect(cards.map((card) => (card as HTMLAnchorElement).getAttribute('href'))).toEqual([
      '/admin/authorization/groups',
      '/admin/authorization/assignments',
    ]);
    expect(within(cards[0]).getByText('Quản lý nhóm quyền')).toBeTruthy();
    expect(within(cards[1]).getByText('Gán nhóm quyền cho tài khoản')).toBeTruthy();
  });
});
