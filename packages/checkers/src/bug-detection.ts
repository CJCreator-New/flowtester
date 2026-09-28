import type { Finding, StepEvidence, Breakpoint } from '@qa/types';

function safeOrigin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export class BugDetectionChecker {
  check(
    stepEvidenceList: StepEvidence[],
    context: {
      testCaseId?: string;
      flowId?: string;
      role: string;
      breakpoint: Breakpoint;
      urlPath: string;
    }
  ): Finding[] {
    const findings: Finding[] = [];
    let findingCounter = 1;

    for (const step of stepEvidenceList) {
      // 1. Console Errors & Uncaught Exceptions
      for (const consoleLog of step.consoleErrors) {
        const isUnhandledException = consoleLog.text.includes('Uncaught Exception');
        findings.push({
          id: `F-BUG-${context.testCaseId || 'GEN'}-${findingCounter++}`,
          testCaseId: context.testCaseId,
          flowId: context.flowId,
          severity: isUnhandledException ? 'Blocker' : 'Major',
          checker: 'bug-detection',
          title: isUnhandledException
            ? `Uncaught Exception in step "${step.stepName}"`
            : `Console Error in step "${step.stepName}"`,
          where: {
            urlPath: step.urlAfter || context.urlPath,
            role: context.role,
            breakpoint: context.breakpoint,
          },
          expectedVsActual: {
            expected: 'Zero unhandled errors or console exceptions in production builds',
            actual: consoleLog.text.substring(0, 300),
          },
          stepsToReproduce: [
            `Navigate to ${step.urlBefore}`,
            `Perform action: ${step.action} on "${step.stepName}"`,
            `Check browser developer console logs`,
          ],
          evidence: {
            screenshotPath: step.screenshotPath,
            domSnapshotPath: step.domSnapshotPath,
            consoleLogs: [consoleLog],
          },
          resolution:
            'Inspect the stack trace in console logs, ensure null checks and error boundaries are configured.',
          verifyCommand: `qa-test verify F-BUG-${context.testCaseId || 'GEN'}-${findingCounter - 1}`,
        });
      }

      // 2. Failed HTTP Requests (4xx / 5xx)
      for (const req of step.failedRequests) {
        const is5xx = req.status >= 500;
        const pageOrigin = safeOrigin(step.urlBefore || step.urlAfter || context.urlPath);
        const requestOrigin = safeOrigin(req.url);
        const isThirdParty = !!pageOrigin && !!requestOrigin && pageOrigin !== requestOrigin;

        findings.push({
          id: `F-HTTP-${context.testCaseId || 'GEN'}-${findingCounter++}`,
          testCaseId: context.testCaseId,
          flowId: context.flowId,
          severity: isThirdParty ? 'Minor' : is5xx ? 'Blocker' : 'Major',
          checker: 'bug-detection',
          title: isThirdParty
            ? `Third-party request failed: HTTP ${req.status || 'Failed'} on ${req.method} ${req.url}`
            : `HTTP ${req.status || 'Failed'} on ${req.method} ${req.url}`,
          where: {
            urlPath: step.urlAfter || context.urlPath,
            role: context.role,
            breakpoint: context.breakpoint,
          },
          expectedVsActual: {
            expected: `HTTP 2xx or expected status response for ${req.method} ${req.url}`,
            actual: `Request failed with status ${req.status}`,
          },
          stepsToReproduce: [
            `Execute step "${step.stepName}" on ${step.urlBefore}`,
            `Inspect network activity for ${req.method} ${req.url}`,
          ],
          evidence: {
            screenshotPath: step.screenshotPath,
            networkLogs: [req],
          },
          resolution: isThirdParty
            ? 'Failure originates from a third-party domain (analytics, fonts, CDN, etc.), not this application. Confirm it is not blocking a critical user flow before prioritizing.'
            : is5xx
            ? 'Backend API error (5xx). Check server endpoint logs and database connections.'
            : 'Client request failure (4xx). Check request payload, authentication headers, or route.',
          verifyCommand: `qa-test verify F-HTTP-${context.testCaseId || 'GEN'}-${findingCounter - 1}`,
          thirdParty: isThirdParty,
        });
      }

      // 3. Step execution failure
      if (!step.passed && step.error) {
        findings.push({
          id: `F-STEP-${context.testCaseId || 'GEN'}-${findingCounter++}`,
          testCaseId: context.testCaseId,
          flowId: context.flowId,
          severity: 'Blocker',
          checker: 'bug-detection',
          title: `Step failed: "${step.stepName}"`,
          where: {
            urlPath: step.urlBefore,
            role: context.role,
            breakpoint: context.breakpoint,
          },
          expectedVsActual: {
            expected: `Step "${step.stepName}" executes cleanly`,
            actual: step.error,
          },
          stepsToReproduce: [
            `Navigate to ${step.urlBefore}`,
            `Execute step "${step.stepName}" (${step.action})`,
          ],
          evidence: {
            screenshotPath: step.screenshotPath,
            domSnapshotPath: step.domSnapshotPath,
          },
          resolution: `Verify element is present in the DOM and enabled for action "${step.action}".`,
          verifyCommand: `qa-test verify F-STEP-${context.testCaseId || 'GEN'}-${findingCounter - 1}`,
        });
      }
    }

    return findings;
  }
}
