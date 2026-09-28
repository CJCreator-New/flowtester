import type {
  Finding,
  CanonicalFinding,
  RunFinalizeInput,
  TestPointResult,
} from '@qa/types';
import { computeStructuralFingerprint } from '@qa/types';
import type { IHubDatabase, HubRelease } from './storage/db.js';

export class DeduplicationEngine {
  constructor(private db: IHubDatabase) {}

  /**
   * Processes a finalized run, performs structural fingerprint deduplication,
   * updates occurrence counts and evidence links, and runs Targeted Verification.
   */
  async processRunFinalization(
    release: HubRelease,
    productId: string,
    payload: RunFinalizeInput
  ): Promise<{
    newFindingsCount: number;
    updatedFindingsCount: number;
    verifiedFixedCount: number;
    regressedCount: number;
  }> {
    let newFindingsCount = 0;
    let updatedFindingsCount = 0;
    let verifiedFixedCount = 0;
    let regressedCount = 0;

    const seenFingerprintsInThisRun = new Set<string>();

    // 1. Process all incoming findings from this run
    for (const rawFinding of payload.findings) {
      const fingerprint = computeStructuralFingerprint({
        productId,
        route: rawFinding.where.urlPath,
        checkerId: rawFinding.checker,
        ruleCode: rawFinding.id.split('-')[0] || rawFinding.checker,
        selector: rawFinding.where.dataTestId
          ? `[data-testid="${rawFinding.where.dataTestId}"]`
          : rawFinding.where.cssSelector,
      });

      seenFingerprintsInThisRun.add(fingerprint);

      const existing = await this.db.getCanonicalFindingByFingerprint(release.id, fingerprint);

      const runFindingEntry = {
        runId: payload.runId,
        testCaseId: rawFinding.testCaseId,
        flowId: rawFinding.flowId,
        evidenceUrls: rawFinding.evidence.screenshotPath
          ? [rawFinding.evidence.screenshotPath]
          : [],
        timestamp: new Date().toISOString(),
      };

      if (!existing) {
        // Create new Canonical Finding
        const canonical: CanonicalFinding = {
          id: `cf_${fingerprint}_${Date.now()}`,
          fingerprint,
          productId,
          releaseTarget: release.id,
          checker: rawFinding.checker,
          ruleCode: rawFinding.id.split('-')[0] || rawFinding.checker,
          title: rawFinding.title,
          severity: rawFinding.severity,
          route: rawFinding.where.urlPath,
          selector: rawFinding.where.dataTestId || rawFinding.where.cssSelector,
          status: 'OPEN',
          firstSeenRunId: payload.runId,
          lastSeenRunId: payload.runId,
          firstSeenAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
          occurrenceCount: 1,
          runFindings: [runFindingEntry],
        };

        await this.db.saveCanonicalFinding(canonical);
        newFindingsCount++;
      } else {
        // Update existing Canonical Finding
        existing.occurrenceCount += 1;
        existing.lastSeenRunId = payload.runId;
        existing.lastSeenAt = new Date().toISOString();
        existing.runFindings.push(runFindingEntry);

        if (existing.status === 'VERIFIED_FIXED') {
          existing.status = 'REGRESSED';
          regressedCount++;
        }

        await this.db.saveCanonicalFinding(existing);
        updatedFindingsCount++;
      }
    }

    // 2. Targeted Verification for previously OPEN findings
    const allFindingsInRelease = await this.db.listCanonicalFindings(release.id);
    const passedTestPoints = payload.testPoints.filter((tp: TestPointResult) => tp.status === 'Passed');

    for (const finding of allFindingsInRelease) {
      if (finding.status === 'OPEN' && !seenFingerprintsInThisRun.has(finding.fingerprint)) {
        // Did this run execute the flow covering this finding?
        const matchingTestPoint = passedTestPoints.find((tp) => {
          return finding.runFindings.some((rf) => rf.flowId && rf.flowId === tp.flowId);
        });

        if (matchingTestPoint) {
          finding.status = 'VERIFIED_FIXED';
          finding.lastSeenAt = new Date().toISOString();
          await this.db.saveCanonicalFinding(finding);
          verifiedFixedCount++;
        }
      }
    }

    return {
      newFindingsCount,
      updatedFindingsCount,
      verifiedFixedCount,
      regressedCount,
    };
  }
}
