import { describe, it, expect } from 'vitest';
import { SecurityChecker, urlHasSecretParam } from '../src/security.js';
import type { Page } from 'playwright';

describe('SecurityChecker', () => {
  const checker = new SecurityChecker();

  it('detects secrets in URL parameters', () => {
    expect(urlHasSecretParam('http://example.com/?token=abc123xyz')).toBe(true);
    expect(urlHasSecretParam('http://example.com/?password=secret')).toBe(true);
    expect(urlHasSecretParam('http://example.com/?page=1&query=test')).toBe(false);
  });

  it('flags passwords in URLs from StepEvidence', () => {
    const findings = checker.checkEvidence(
      [
        {
          stepIndex: 1,
          stepName: 'Submit credentials',
          action: 'click',
          urlBefore: 'http://localhost:3050/login',
          urlAfter: 'http://localhost:3050/dashboard?email=admin%40example.com&password=secret',
          consoleErrors: [],
          failedRequests: [],
          durationMs: 100,
          passed: true,
        },
      ],
      {
        testCaseId: 'TC-SEC-URL',
        role: 'visitor',
        breakpoint: '1440px',
      }
    );

    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('Major');
    expect(findings[0].title).toContain('The sign-in form sends passwords in the page address');
  });

  it('flags missing security headers', () => {
    const headers = {
      'content-type': 'text/html; charset=utf-8',
    };

    const findings = checker.checkHeaders(headers, {
      testCaseId: 'TC-SEC-HEADERS',
      role: 'visitor',
      breakpoint: '1440px',
      urlPath: '/',
      isHttps: true,
    });

    // Should flag CSP, nosniff, clickjacking, referrer, and HSTS
    expect(findings.some((f) => f.title.includes('Content-Security-Policy'))).toBe(true);
    expect(findings.some((f) => f.title.includes('X-Content-Type-Options: nosniff'))).toBe(true);
    expect(findings.some((f) => f.title.includes('clickjacking protection'))).toBe(true);
    expect(findings.some((f) => f.title.includes('Referrer-Policy'))).toBe(true);
    expect(findings.some((f) => f.title.includes('Strict-Transport-Security'))).toBe(true);
  });

  it('flags insecure external scripts and mixed content (books.toscrape.com insecure jQuery)', async () => {
    const mockPage = {
      url: () => 'https://books.toscrape.com/',
      evaluate: async (fn: any, ...args: any[]) => {
        // Return simulated script with http://
        return [{ tag: 'script', src: 'http://code.jquery.com/jquery-1.11.0.min.js' }];
      },
      context: () => ({
        cookies: async () => [],
      }),
    } as unknown as Page;

    const findings = await checker.checkPage(mockPage, {
      testCaseId: 'TC-INSECURE-SCRIPT',
      role: 'visitor',
      breakpoint: '1440px',
      urlPath: '/',
    });

    const scriptFinding = findings.find((f) => f.title.includes('Insecure resource loaded over unencrypted HTTP'));
    expect(scriptFinding).toBeDefined();
    expect(scriptFinding?.expectedVsActual.actual).toContain('http://code.jquery.com/jquery-1.11.0.min.js');
    expect(scriptFinding?.severity).toBe('Major');
  });

  it('flags exposed internal stack traces in page body', async () => {
    const mockPage = {
      url: () => 'http://localhost:3050/api/failing-endpoint',
      evaluate: async (fn: any, patternStr: string) => {
        return 'at Object.<anonymous> (/app/server.js:45:12)\nnode:internal/process/task_queues:95:5';
      },
      context: () => ({
        cookies: async () => [],
      }),
    } as unknown as Page;

    const findings = await checker.checkPage(mockPage, {
      testCaseId: 'TC-TRACE',
      role: 'visitor',
      breakpoint: '1440px',
      urlPath: '/api/failing-endpoint',
    });

    const traceFinding = findings.find((f) => f.title.includes('stack trace'));
    expect(traceFinding).toBeDefined();
    expect(traceFinding?.severity).toBe('Major');
  });

  it('flags insecure cookie flags (missing Secure on HTTPS, missing HttpOnly on auth cookies)', async () => {
    const mockPage = {
      url: () => 'https://example.com/account',
      evaluate: async () => [],
      context: () => ({
        cookies: async () => [
          { name: 'session_token', secure: false, httpOnly: false, sameSite: 'None' },
        ],
      }),
    } as unknown as Page;

    const findings = await checker.checkPage(mockPage, {
      testCaseId: 'TC-COOKIES',
      role: 'visitor',
      breakpoint: '1440px',
      urlPath: '/account',
    });

    expect(findings.some((f) => f.title.includes('missing the Secure flag'))).toBe(true);
    expect(findings.some((f) => f.title.includes('missing HttpOnly flag'))).toBe(true);
  });
});
