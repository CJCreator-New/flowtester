import { promises as fs } from 'fs';
import path from 'path';
import type {
  AspectGradeDelta,
  AspectType,
  Finding,
  SiteAspectGrades,
  SiteHistoryDiff,
} from '@qa/types';
import { computeStructuralFingerprint } from '@qa/types';

export interface SiteHistoryEntry {
  runId: string;
  timestamp: string;
  grades: SiteAspectGrades;
  findingFingerprints: string[];
}

export interface SiteHistoryData {
  host: string;
  runs: SiteHistoryEntry[];
}

export class SiteHistoryManager {
  constructor(private readonly dataDir: string = path.join(process.cwd(), 'sites')) {}

  private historyFilePath(host: string): string {
    const safeHost = host.replace(/[:\/\\?%*|"<>]/g, '_');
    return path.join(this.dataDir, `${safeHost}.history.json`);
  }

  async loadHistory(host: string): Promise<SiteHistoryData> {
    try {
      const content = await fs.readFile(this.historyFilePath(host), 'utf8');
      return JSON.parse(content);
    } catch {
      return { host, runs: [] };
    }
  }

  async recordRun(
    host: string,
    runId: string,
    grades: SiteAspectGrades,
    findings: Finding[],
    productId: string
  ): Promise<SiteHistoryDiff> {
    const history = await this.loadHistory(host);
    const lastRun = history.runs.length > 0 ? history.runs[history.runs.length - 1] : undefined;

    // Compute structural fingerprints for current findings
    const currentFingerprints = new Set<string>();
    for (const f of findings) {
      if (!f.needsConfirmation && f.triageStatus !== 'False Positive' && f.triageStatus !== 'Intended') {
        const fp = computeStructuralFingerprint({
          productId,
          route: f.where.urlPath,
          checkerId: f.checker,
          ruleCode: f.title,
          selector: f.where.cssSelector || f.where.dataTestId,
        });
        currentFingerprints.add(fp);
      }
    }

    const currentFpList = Array.from(currentFingerprints);
    const prevFpSet = new Set(lastRun?.findingFingerprints || []);

    const newFindings = currentFpList.filter((fp) => !prevFpSet.has(fp));
    const openFindings = currentFpList.filter((fp) => prevFpSet.has(fp));
    const fixedFindings = Array.from(prevFpSet).filter((fp) => !currentFingerprints.has(fp));

    const aspectList: AspectType[] = [
      'Works',
      'Accessible',
      'Fast and mobile',
      'Findable',
      'Secure',
      'Looks and reads well',
    ];

    const aspectDeltas: Record<AspectType, AspectGradeDelta> = {} as any;
    for (const aspect of aspectList) {
      const curr = grades.aspects[aspect];
      const prev = lastRun?.grades.aspects[aspect];
      aspectDeltas[aspect] = {
        previousGrade: prev?.grade,
        previousScore: prev?.score,
        currentGrade: curr.grade,
        currentScore: curr.score,
      };
    }

    const diff: SiteHistoryDiff = {
      previousRunId: lastRun?.runId,
      previousTimestamp: lastRun?.timestamp,
      aspectDeltas,
      newFindingFingerprints: newFindings,
      fixedFindingFingerprints: fixedFindings,
      openFindingFingerprints: openFindings,
    };

    // Append current run to history
    history.runs.push({
      runId,
      timestamp: new Date().toISOString(),
      grades,
      findingFingerprints: currentFpList,
    });

    // Retain up to the latest 50 runs
    if (history.runs.length > 50) {
      history.runs = history.runs.slice(history.runs.length - 50);
    }

    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.writeFile(this.historyFilePath(host), JSON.stringify(history, null, 2), 'utf8');

    return diff;
  }
}
