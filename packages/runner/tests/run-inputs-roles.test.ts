import { describe, it, expect } from 'vitest';
import { checkRoles, checkLoginPath, checkCustomHeaders } from '../src/run-inputs.js';

describe('run-inputs: checkRoles', () => {
  it('returns ok undefined for absent or empty input', () => {
    expect(checkRoles(undefined)).toEqual({ ok: true, value: undefined });
    expect(checkRoles(null)).toEqual({ ok: true, value: undefined });
    expect(checkRoles([])).toEqual({ ok: true, value: undefined });
  });

  it('rejects non-array input', () => {
    const res = checkRoles({ role: 'admin' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.problem.code).toBe('ERR_INVALID_ROLES');
    }
  });

  it('rejects more than 10 roles', () => {
    const eleven = Array.from({ length: 11 }, (_, i) => ({ role: `role${i}`, username: `user${i}` }));
    const res = checkRoles(eleven);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.problem.code).toBe('ERR_INVALID_ROLES');
    }
  });

  it('rejects invalid role names (e.g. path traversal)', () => {
    const res = checkRoles([{ role: '../x', username: 'a', password: 'b' }]);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.problem.code).toBe('ERR_INVALID_ROLES');
      expect(res.problem.error).not.toContain('b');
    }
  });

  it('accepts valid role names and credentials', () => {
    const res = checkRoles([{ role: 'member', username: 'a', password: 'b' }]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toEqual([{ role: 'member', username: 'a', password: 'b' }]);
    }
  });

  it('rejects duplicate role names', () => {
    const res = checkRoles([
      { role: 'admin', username: 'user1' },
      { role: 'admin', username: 'user2' },
    ]);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.problem.code).toBe('ERR_INVALID_ROLES');
    }
  });

  it('rejects non-string fields or fields over 500 characters', () => {
    expect(checkRoles([{ role: 'admin', username: 123 }]).ok).toBe(false);
    expect(checkRoles([{ role: 'admin', username: 'a', password: 123 }]).ok).toBe(false);
    expect(checkRoles([{ role: 'admin', username: 'a', password: 'x'.repeat(501) }]).ok).toBe(false);
  });
});

describe('run-inputs: checkLoginPath', () => {
  it('returns ok undefined for absent or empty input', () => {
    expect(checkLoginPath(undefined, 'https://app.test')).toEqual({ ok: true, value: undefined });
    expect(checkLoginPath(null, 'https://app.test')).toEqual({ ok: true, value: undefined });
    expect(checkLoginPath('', 'https://app.test')).toEqual({ ok: true, value: undefined });
  });

  it('accepts normal relative paths starting with a single slash', () => {
    expect(checkLoginPath('/login', 'https://app.test')).toEqual({ ok: true, value: '/login' });
    expect(checkLoginPath('/signin?ref=1', 'https://app.test')).toEqual({ ok: true, value: '/signin?ref=1' });
  });

  it('rejects protocol-relative paths', () => {
    const res = checkLoginPath('//evil.example/x', 'https://app.test');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.problem.code).toBe('ERR_INVALID_LOGIN_PATH');
    }
  });

  it('accepts absolute URLs matching target host (apex or www)', () => {
    expect(checkLoginPath('https://app.test/login', 'https://app.test')).toEqual({ ok: true, value: '/login' });
    expect(checkLoginPath('https://www.app.test/login?tab=1', 'https://app.test')).toEqual({
      ok: true,
      value: '/login?tab=1',
    });
  });

  it('rejects cross-host absolute URLs', () => {
    const res = checkLoginPath('https://evil.example/login', 'https://app.test');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.problem.code).toBe('ERR_INVALID_LOGIN_PATH');
    }
  });
});

describe('run-inputs: checkCustomHeaders', () => {
  it('rejects header names with invalid characters', () => {
    const res = checkCustomHeaders({ 'X Bad': '1' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.problem.code).toBe('ERR_INVALID_HEADERS');
    }
  });

  it('rejects header values with CR/LF without leaking the values', () => {
    const res = checkCustomHeaders({ 'X-A': 'a\r\nb' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.problem.code).toBe('ERR_INVALID_HEADERS');
      expect(res.problem.error).not.toContain('a\r\nb');
    }
  });

  it('accepts valid record and string headers', () => {
    const rec = checkCustomHeaders({ 'X-QA-Token': 'secret-123' });
    expect(rec.ok).toBe(true);
    if (rec.ok) {
      expect(rec.value).toEqual({ 'X-QA-Token': 'secret-123' });
    }

    const text = checkCustomHeaders('X-QA-Token: secret-123\nX-Env: staging');
    expect(text.ok).toBe(true);
    if (text.ok) {
      expect(text.value).toEqual({ 'X-QA-Token': 'secret-123', 'X-Env': 'staging' });
    }
  });
});
