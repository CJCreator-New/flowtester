import type { Page } from 'playwright';
import type { Finding, TestCase, StepEvidence, Breakpoint } from '@qa/types';

export class SpecConformanceChecker {
  async check(
    page: Page,
    testCase: TestCase,
    stepEvidenceList: StepEvidence[],
    context: {
      role: string;
      breakpoint: Breakpoint;
      baseUrl: string;
    }
  ): Promise<Finding[]> {
    const findings: Finding[] = [];
    let counter = 1;
    const currentUrl = page.url();

    // 1. URL Pattern Check
    if (testCase.expectations.url) {
      const pattern = testCase.expectations.url.pattern;
      // Convert glob-like pattern /invoices/* to regex
      const regex = new RegExp(
        '^' + pattern.replace(/\*/g, '.*').replace(/\//g, '\\/') + '$'
      );
      const urlPath = new URL(currentUrl, context.baseUrl).pathname;

      if (!regex.test(urlPath) && !regex.test(currentUrl)) {
        findings.push({
          id: `F-SPEC-${testCase.id}-${counter++}`,
          testCaseId: testCase.id,
          flowId: testCase.flowId,
          severity: 'Blocker',
          checker: 'spec-conformance',
          title: `URL did not match expected pattern: "${pattern}"`,
          where: {
            urlPath,
            role: context.role,
            breakpoint: context.breakpoint,
          },
          expectedVsActual: {
            expected: `URL matches pattern: ${pattern} (${testCase.expectations.url.description || ''})`,
            actual: `Current URL is ${urlPath}`,
          },
          stepsToReproduce: [
            `Navigate to ${testCase.startPage}`,
            ...testCase.steps.map((s) => `Perform "${s.name}" (${s.action})`),
            `Assert URL matches ${pattern}`,
          ],
          evidence: {
            screenshotPath: stepEvidenceList[stepEvidenceList.length - 1]?.screenshotPath,
          },
          resolution: `Check routing or navigation logic after executing "${testCase.steps[testCase.steps.length - 1]?.name}".`,
          verifyCommand: `qa-test verify F-SPEC-${testCase.id}-${counter - 1}`,
        });
      }
    }

    // 2. Visible Text Check
    if (testCase.expectations.text) {
      const { contains, notContains, description } = testCase.expectations.text;
      const pageText = await page.innerText('body').catch(() => '');

      if (contains && !pageText.includes(contains)) {
        findings.push({
          id: `F-SPEC-${testCase.id}-${counter++}`,
          testCaseId: testCase.id,
          flowId: testCase.flowId,
          severity: 'Major',
          checker: 'spec-conformance',
          title: `Expected text not found: "${contains}"`,
          where: {
            urlPath: new URL(currentUrl).pathname,
            role: context.role,
            breakpoint: context.breakpoint,
          },
          expectedVsActual: {
            expected: `Page contains "${contains}" (${description || ''})`,
            actual: `Text "${contains}" was absent from the page body`,
          },
          stepsToReproduce: [
            `Navigate to ${testCase.startPage}`,
            ...testCase.steps.map((s) => `Execute "${s.name}"`),
            `Check page content for "${contains}"`,
          ],
          evidence: {
            screenshotPath: stepEvidenceList[stepEvidenceList.length - 1]?.screenshotPath,
            domSnapshotPath: stepEvidenceList[stepEvidenceList.length - 1]?.domSnapshotPath,
          },
          resolution: `Verify UI notification, success banner, or component rendering logic.`,
          verifyCommand: `qa-test verify F-SPEC-${testCase.id}-${counter - 1}`,
        });
      }

      if (notContains && pageText.includes(notContains)) {
        findings.push({
          id: `F-SPEC-${testCase.id}-${counter++}`,
          testCaseId: testCase.id,
          flowId: testCase.flowId,
          severity: 'Major',
          checker: 'spec-conformance',
          title: `Disallowed text appeared: "${notContains}"`,
          where: {
            urlPath: new URL(currentUrl).pathname,
            role: context.role,
            breakpoint: context.breakpoint,
          },
          expectedVsActual: {
            expected: `Page does NOT contain "${notContains}" (${description || ''})`,
            actual: `Text "${notContains}" was present in the page body`,
          },
          stepsToReproduce: [
            `Navigate to ${testCase.startPage}`,
            ...testCase.steps.map((s) => `Execute "${s.name}"`),
            `Verify page does not show "${notContains}"`,
          ],
          evidence: {
            screenshotPath: stepEvidenceList[stepEvidenceList.length - 1]?.screenshotPath,
          },
          resolution: `Remove error state or unauthorized content for role "${context.role}".`,
          verifyCommand: `qa-test verify F-SPEC-${testCase.id}-${counter - 1}`,
        });
      }
    }

    // 3. API Call expectation
    if (testCase.expectations.apiCall) {
      const { method, path: apiPath, status } = testCase.expectations.apiCall;
      const allNetwork = stepEvidenceList.flatMap((s) => s.failedRequests); // plus recorded
      // Check if matched
      const matched = stepEvidenceList.some((s) =>
        s.failedRequests.some(
          (r) => r.method === method && r.url.includes(apiPath) && r.status === status
        )
      );
      // If the expected API call failed with a different status
      const failedMatch = stepEvidenceList
        .flatMap((s) => s.failedRequests)
        .find((r) => r.method === method && r.url.includes(apiPath));

      if (failedMatch && failedMatch.status !== status) {
        findings.push({
          id: `F-SPEC-${testCase.id}-${counter++}`,
          testCaseId: testCase.id,
          flowId: testCase.flowId,
          severity: 'Blocker',
          checker: 'spec-conformance',
          title: `API call status mismatch: ${method} ${apiPath} returned ${failedMatch.status}`,
          where: {
            urlPath: new URL(currentUrl).pathname,
            role: context.role,
            breakpoint: context.breakpoint,
          },
          expectedVsActual: {
            expected: `${method} ${apiPath} should return HTTP ${status}`,
            actual: `Returned HTTP ${failedMatch.status}`,
          },
          stepsToReproduce: [
            `Navigate to ${testCase.startPage}`,
            ...testCase.steps.map((s) => `Execute "${s.name}"`),
          ],
          evidence: {
            networkLogs: [failedMatch],
          },
          resolution: `Inspect API endpoint handler for ${method} ${apiPath}.`,
          verifyCommand: `qa-test verify F-SPEC-${testCase.id}-${counter - 1}`,
        });
      }
    }

    return findings;
  }
}
