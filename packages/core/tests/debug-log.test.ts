import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { debugEnabled, debugLog } from '../src/debug-log.js';

describe('debug-log: debugEnabled', () => {
  const origEnv = process.env.QA_DEBUG;

  afterEach(() => {
    if (origEnv !== undefined) {
      process.env.QA_DEBUG = origEnv;
    } else {
      delete process.env.QA_DEBUG;
    }
  });

  it('disables all areas when unset or empty', () => {
    delete process.env.QA_DEBUG;
    expect(debugEnabled('crawl')).toBe(false);
    expect(debugEnabled('auth')).toBe(false);
    expect(debugEnabled('nav')).toBe(false);

    process.env.QA_DEBUG = '';
    expect(debugEnabled('crawl')).toBe(false);
    expect(debugEnabled('auth')).toBe(false);
    expect(debugEnabled('nav')).toBe(false);
  });

  it('enables specific area when set', () => {
    process.env.QA_DEBUG = 'crawl';
    expect(debugEnabled('crawl')).toBe(true);
    expect(debugEnabled('auth')).toBe(false);
    expect(debugEnabled('nav')).toBe(false);

    process.env.QA_DEBUG = 'crawl,nav';
    expect(debugEnabled('crawl')).toBe(true);
    expect(debugEnabled('auth')).toBe(false);
    expect(debugEnabled('nav')).toBe(true);
  });

  it('enables all areas when set to all, 1, or true', () => {
    for (const val of ['all', 'ALL', '1', 'true', 'crawl,all']) {
      process.env.QA_DEBUG = val;
      expect(debugEnabled('crawl')).toBe(true);
      expect(debugEnabled('auth')).toBe(true);
      expect(debugEnabled('nav')).toBe(true);
    }
  });
});

describe('debug-log: debugLog', () => {
  const origEnv = process.env.QA_DEBUG;
  let stderrOutput = '';
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrOutput = '';
    errorSpy = vi.spyOn(console, 'error').mockImplementation((msg: string) => {
      stderrOutput += msg + '\n';
    });
  });

  afterEach(() => {
    errorSpy.mockRestore();
    if (origEnv !== undefined) {
      process.env.QA_DEBUG = origEnv;
    } else {
      delete process.env.QA_DEBUG;
    }
  });

  it('is a no-op when area is disabled', () => {
    delete process.env.QA_DEBUG;
    debugLog('crawl', 'test message', { foo: 'bar' });
    expect(stderrOutput).toBe('');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('logs prefix and message when enabled', () => {
    process.env.QA_DEBUG = 'crawl';
    debugLog('crawl', 'starting crawl');
    expect(stderrOutput).toContain('[qa:crawl] starting crawl');
  });

  it('redacts URL parameters in URL fields', () => {
    process.env.QA_DEBUG = 'crawl';
    debugLog('crawl', 'visited route', { url: 'https://a.test/x?token=abc&page=1' });
    expect(stderrOutput).toContain('url=https://a.test/x?token=***&page=1');
    expect(stderrOutput).not.toContain('token=abc');
  });

  it('hides sensitive fields like password, secret, token, cookie, authorization', () => {
    process.env.QA_DEBUG = 'auth';
    debugLog('auth', 'attempted signin', {
      user: 'admin',
      password: 'superSecretPassword',
      authorization: 'Bearer z',
      token: 'tok-xyz',
      sessionCookie: 'sess=abc',
    });

    expect(stderrOutput).toContain('password=[hidden]');
    expect(stderrOutput).toContain('authorization=[hidden]');
    expect(stderrOutput).toContain('token=[hidden]');
    expect(stderrOutput).toContain('sessionCookie=[hidden]');
    expect(stderrOutput).toContain('user=admin');

    expect(stderrOutput).not.toContain('superSecretPassword');
    expect(stderrOutput).not.toContain('Bearer z');
    expect(stderrOutput).not.toContain('tok-xyz');
    expect(stderrOutput).not.toContain('sess=abc');
  });
});
