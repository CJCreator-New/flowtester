import { describe, it, expect } from 'vitest';
import { PermissionMatrixChecker } from '../src/permission-matrix.js';

describe('PermissionMatrixChecker', () => {
  const csvMatrix = `
target,admin,manager,member,viewer
/invoices,allow,allow,allow,allow
/invoices/new,allow,allow,deny,deny
/settings/billing,allow,deny,deny,deny
`;

  const checker = new PermissionMatrixChecker(csvMatrix);

  it('correctly parses CSV permission matrix', () => {
    const rules = checker.parseMatrix(csvMatrix);
    expect(rules).toHaveLength(3);
    expect(rules[0].target).toBe('/invoices');
    expect(rules[0].roles.viewer).toBe('allow');
    expect(rules[1].target).toBe('/invoices/new');
    expect(rules[1].roles.viewer).toBe('deny');
  });

  it('detects permission leak when restricted role accesses forbidden route', () => {
    const finding = checker.checkAccess({
      target: '/settings/billing',
      role: 'viewer',
      statusCode: 200,
      testCaseId: 'TC-PERM-01',
    });

    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('Blocker');
    expect(finding?.checker).toBe('permission-matrix');
    expect(finding?.title).toContain('Permission Leak: Role "viewer" can access restricted route "/settings/billing"');
    expect(finding?.resolution).toContain('Add a server-side authorization check to this route');
  });

  it('detects over-restriction when permitted role receives 403 Forbidden', () => {
    const finding = checker.checkAccess({
      target: '/invoices',
      role: 'manager',
      statusCode: 403,
      testCaseId: 'TC-PERM-02',
    });

    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('Major');
    expect(finding?.checker).toBe('permission-matrix');
    expect(finding?.title).toContain('Over-restriction: Role "manager" is blocked');
  });

  it('detects direct URL exposure when forbidden route is hidden from UI but reachable', () => {
    const finding = checker.checkDirectUrlExposure({
      target: '/invoices/new',
      role: 'member',
      isNavVisible: false,
      isReachable: true,
      testCaseId: 'TC-PERM-03',
    });

    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('Blocker');
    expect(finding?.title).toContain('Direct URL Access: Hidden route "/invoices/new" accessible directly by "member"');
  });

  it('returns undefined when permissions match expected behavior', () => {
    const allowFinding = checker.checkAccess({
      target: '/invoices',
      role: 'admin',
      statusCode: 200,
    });
    expect(allowFinding).toBeUndefined();

    const denyFinding = checker.checkAccess({
      target: '/settings/billing',
      role: 'viewer',
      statusCode: 403,
    });
    expect(denyFinding).toBeUndefined();
  });
});
