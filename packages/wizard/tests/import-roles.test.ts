import { describe, it, expect } from 'vitest';
import { fillRoleRows, parseRoleList } from '../src/lib/import-roles';
import { EMPTY_SIGN_IN } from '../src/lib/form';

describe('parseRoleList', () => {
  it('reads role,username,password lines and skips header, blanks and comments', () => {
    const r = parseRoleList('role,username,password\n\n# note\nadmin,a@x.test,pw1\nmember,m@x.test,pw2\n');
    expect(r.skipped).toEqual([]);
    expect(r.roles).toEqual([
      { role: 'admin', username: 'a@x.test', password: 'pw1' },
      { role: 'member', username: 'm@x.test', password: 'pw2' },
    ]);
  });
  it('keeps commas in the password and accepts tabs', () => {
    expect(parseRoleList('admin,a@x.test,pa,ss').roles[0].password).toBe('pa,ss');
    expect(parseRoleList('admin\ta@x.test\tpw').roles[0]).toEqual({
      role: 'admin',
      username: 'a@x.test',
      password: 'pw',
    });
  });
  it('skips bad and repeated lines by line number, never echoing values', () => {
    const r = parseRoleList('admin,a@x.test,secret-one\nonlyone\nadmin,b@x.test,secret-two\nx,,pw');
    expect(r.roles).toHaveLength(1);
    expect(r.skipped).toHaveLength(3);
    expect(r.skipped[0]).toMatch(/^Line 2/);
    expect(r.skipped.join(' ')).not.toMatch(/secret|a@x|b@x/);
  });
  it('caps the number of roles', () => {
    const many = Array.from({ length: 12 }, (_, i) => `r${i},u${i},p${i}`).join('\n');
    const r = parseRoleList(many);
    expect(r.roles).toHaveLength(10);
    expect(r.skipped).toHaveLength(2);
  });
});

describe('fillRoleRows', () => {
  it('updates a row with the same role, fills an empty row, then adds', () => {
    const rows = [{ role: 'admin', username: '', password: '', loginPath: '/login' }, { ...EMPTY_SIGN_IN }];
    const out = fillRoleRows(rows, [
      { role: 'admin', username: 'a', password: 'pa' },
      { role: 'member', username: 'm', password: 'pm' },
      { role: 'guest', username: 'g', password: 'pg' },
    ]);
    expect(out).toEqual([
      { role: 'admin', username: 'a', password: 'pa', loginPath: '/login' },
      { role: 'member', username: 'm', password: 'pm', loginPath: '' },
      { role: 'guest', username: 'g', password: 'pg', loginPath: '' },
    ]);
    expect(rows[0].username).toBe('');
  });
});
