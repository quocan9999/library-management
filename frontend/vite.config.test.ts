import { describe, expect, it } from 'vitest';
import { resolveSharedFrontendConfig } from './vite.config';

describe('shared root .env configuration', () => {
  it('derives the feature worktree frontend and backend ports without VITE_ variables', () => {
    expect(resolveSharedFrontendConfig({
      SERVER_PORT: '8082',
      FRONTEND_BASE_URL: 'http://localhost:5174',
    })).toEqual({
      host: 'localhost',
      port: 5174,
      apiBaseUrl: 'http://localhost:8082',
    });
  });

  it('uses common develop defaults when root .env is absent', () => {
    expect(resolveSharedFrontendConfig({})).toEqual({
      host: 'localhost',
      port: 5173,
      apiBaseUrl: 'http://localhost:8081',
    });
  });

  it('handles distinct root worktree settings without source edits', () => {
    expect(resolveSharedFrontendConfig({
      SERVER_PORT: '8083',
      FRONTEND_BASE_URL: 'http://localhost:5175',
    })).toMatchObject({ port: 5175, apiBaseUrl: 'http://localhost:8083' });
  });

  it.each([
    [{ SERVER_PORT: 'bad', FRONTEND_BASE_URL: 'http://localhost:5174' }],
    [{ SERVER_PORT: '65536', FRONTEND_BASE_URL: 'http://localhost:5174' }],
    [{ SERVER_PORT: '8082', FRONTEND_BASE_URL: 'http://localhost:not-a-port' }],
    [{ SERVER_PORT: '8082', FRONTEND_BASE_URL: 'http://localhost:5174/path' }],
    [{ SERVER_PORT: '8082', FRONTEND_BASE_URL: 'https://localhost' }],
  ])('rejects invalid root settings instead of silently picking another port', (env) => {
    expect(() => resolveSharedFrontendConfig(env)).toThrow();
  });
});
