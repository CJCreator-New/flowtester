import { FindingDetail } from '../components/EvidenceDrawer.js';
import { TestExecutionStep } from '../components/LiveExecutionStepper.js';

export type PersonaPreset = 'all' | 'blockers' | 'developer' | 'a11y';

export interface TestRun {
  id: string;
  name: string;
  targetUrl: string;
  releaseTarget: string;
  branch: string;
  commitSha: string;
  trigger: 'manual' | 'ci' | 'cli';
  status: 'passed' | 'failed' | 'gated' | 'running';
  startedAt: string;
  durationMs: number;
  readinessScore: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  findings: FindingDetail[];
  steps: TestExecutionStep[];
}

export interface NetworkCall {
  method: string;
  url: string;
  status: number;
  durationMs: number;
  error?: string;
}

export interface ExtendedFindingDetail extends FindingDetail {
  stackTrace?: string;
  networkCalls?: NetworkCall[];
  domSnapshotSelector?: string;
}
