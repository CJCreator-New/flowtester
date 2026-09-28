/**
 * Pre-Release Readiness Checker - Core Types & Schemas
 */

export type FindingSeverity = 'Blocker' | 'Major' | 'Minor' | 'Suggestion';

export type CheckerType =
  | 'bug-detection'
  | 'spec-conformance'
  | 'design-standards'
  | 'ux-quality'
  | 'permission-matrix';

export type TriageStatus = 'Pending' | 'Confirmed' | 'Intended' | 'False Positive' | 'Resolved';

export type Breakpoint = '375px' | '768px' | '1440px';

export type TestPointStatus =
  | 'Passed'
  | 'Failed'
  | 'Blocked'
  | 'Skipped'
  | 'Could not verify';

export interface TestCaseStep {
  action: 'click' | 'fill' | 'select' | 'check' | 'navigate' | 'wait';
  selector?: string; // e.g. "[data-testid=new-invoice-btn]"
  value?: string;
  name: string;
}

export interface TestCaseExpectations {
  url?: {
    pattern: string;
    description?: string;
  };
  text?: {
    contains?: string;
    notContains?: string;
    description?: string;
  };
  apiCall?: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    path: string;
    status: number;
  };
  elementState?: {
    selector: string;
    visible?: boolean;
    disabled?: boolean;
    description?: string;
  };
}

export interface ValidationRule {
  field: string;
  selector?: string;
  min?: number;
  max?: number;
  pattern?: string;
  expectedError: string;
}

export interface TestCase {
  id: string; // e.g., "TC-001"
  requirementId?: string; // e.g., "REQ-INV-01"
  flowId: string; // e.g., "create-invoice"
  name?: string;
  role: string; // e.g., "manager", "admin", "viewer"
  startPage: string; // e.g., "/invoices"
  steps: TestCaseStep[];
  expectations: TestCaseExpectations;
  validationRules?: ValidationRule[];
  edgeCases?: {
    testBackButton?: boolean;
    testRefresh?: boolean;
    testEmptyInputs?: boolean;
  };
}

export interface SpecFile {
  version?: string;
  product?: string;
  testCases: TestCase[];
}

export interface ConsoleEntry {
  type: 'error' | 'warning' | 'log' | 'info';
  text: string;
  timestamp: number;
}

export interface NetworkEntry {
  url: string;
  method: string;
  status: number;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  postData?: string;
  durationMs?: number;
  timestamp: number;
}

export interface StepEvidence {
  stepIndex: number;
  stepName: string;
  action: string;
  urlBefore: string;
  urlAfter: string;
  screenshotPath?: string;
  domSnapshotPath?: string;
  consoleErrors: ConsoleEntry[];
  failedRequests: NetworkEntry[];
  durationMs: number;
  passed: boolean;
  error?: string;
}

export interface SourceLocation {
  file: string;
  line?: number;
  matchSnippet?: string;
}

export interface Finding {
  id: string; // e.g. "F-001"
  testCaseId?: string;
  flowId?: string;
  severity: FindingSeverity;
  checker: CheckerType;
  title: string;
  where: {
    urlPath: string;
    role: string;
    breakpoint: Breakpoint;
    dataTestId?: string;
    cssSelector?: string;
  };
  sourceLocation?: SourceLocation;
  expectedVsActual: {
    expected: string;
    actual: string;
  };
  stepsToReproduce: string[];
  reproScriptPath?: string;
  evidence: {
    screenshotPath?: string;
    domSnapshotPath?: string;
    videoPath?: string;
    networkLogs?: NetworkEntry[];
    consoleLogs?: ConsoleEntry[];
  };
  resolution: string;
  verifyCommand: string;
  triageStatus?: TriageStatus;
  /** True when this finding originated from a request/resource on a different origin than the page under test (e.g. third-party analytics, fonts, CDNs) rather than a first-party defect. */
  thirdParty?: boolean;
}

export interface PermissionRule {
  target: string; // urlPath e.g. "/settings/billing" or action name
  roles: Record<string, 'allow' | 'deny'>;
}

export type PermissionMatrix = PermissionRule[];

export interface RoleCredential {
  role: string;
  username: string;
  password?: string;
  token?: string;
  loginPath?: string;
}

export interface ProductProfile {
  name: string;
  productId: string;
  owner?: string;
  defaultBaseUrl?: string;
  roles: RoleCredential[];
  forbiddenActions?: string[];
  houseStandards?: Record<string, unknown>;
  /** Path to design-tokens.json (written by `qa-test figma sync`) for Tier 1 token checks. */
  figmaTokensFile?: string;
  /** Directory of approved `<testCaseId>-<breakpoint>.png` baselines for Tier 2 visual diffs. */
  visualBaselineDir?: string;
  /** Fraction of pixels (0–1) allowed to differ from a baseline. Default 0.01. */
  visualDiffMaxPercent?: number;
  permissionMatrix?: PermissionMatrix;
  permissionMatrixFile?: string;
}

export interface PreFlightResult {
  ok: boolean;
  url: string;
  statusCode?: number;
  loginReachable?: boolean;
  roleAuthResults: Record<string, boolean>;
  roleStorageStates?: Record<string, string>;
  error?: string;
}

export interface TestPointResult {
  testCaseId: string;
  flowId: string;
  role: string;
  status: TestPointStatus;
  durationMs: number;
  findings: Finding[];
  stepEvidence: StepEvidence[];
  error?: string;
  /** Session recording, kept only for failed test points. */
  videoPath?: string;
}

export interface RunCoverage {
  totalTestPoints: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  couldNotVerify: number;
  completionRate: number; // percentage
}

export interface TraceabilityEntry {
  requirementId: string;
  testCaseId: string;
  flowId: string;
  name?: string;
  status: TestPointStatus;
  description?: string;
  evidencePath?: string;
}

export interface SuppressionRule {
  findingTitle: string;
  urlPath?: string;
  checker?: CheckerType;
  triageStatus: 'Intended' | 'False Positive';
  reason?: string;
  dateAdded: string;
}

export interface RunDelta {
  newFindings: number;
  fixedFindings: number;
  openFindings: number;
  suppressedFindings: number;
}

export interface ReleaseReport {
  runId: string;
  productId: string;
  targetUrl: string;
  timestamp: string;
  durationMs: number;
  coverage: RunCoverage;
  results: TestPointResult[];
  findings: Finding[];
  traceability?: TraceabilityEntry[];
  suppressions?: SuppressionRule[];
  delta?: RunDelta;
  /** True when this run's test cases came from the generic template fallback, not real AI-driven discovery. */
  usedFallbackDiscovery?: boolean;
  /**
   * 'safe-public' when this report came from a read-only website scan (no sign-in, no form
   * submissions, no data changes), so it must not be read as full product coverage.
   */
  scanMode?: 'full' | 'safe-public';
}

// --- Phase 2: AI Discovery & Confirmation Types ---

export type AIProviderType = 'anthropic' | 'openai' | 'gemini' | 'openrouter' | 'mock';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[]; // base64 data URIs
}

export interface AICompletionOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
  responseFormat?: 'json' | 'text';
}

export interface SensitiveAction {
  type: 'deletion' | 'payment' | 'external_communication' | 'admin_setting';
  elementSelector: string;
  elementText: string;
  urlPath: string;
  reason: string;
}

export interface AmbiguityQuestion {
  id: string; // e.g. "Q-001"
  targetElement?: string;
  urlPath: string;
  question: string;
  options: string[]; // e.g. ["Allow action for tests", "Skip permanently", "Use safe mock input"]
  selectedAnswer?: string;
  category: 'sensitive_action' | 'untested_form' | 'missing_permission' | 'unlinked_page';
}

export interface PageInventoryItem {
  urlPath: string;
  title: string;
  interactiveElementsCount: number;
  formsCount: number;
  outOfScope?: boolean;
}

export interface DiscoveredFlow {
  id: string;
  name: string;
  role: string;
  description: string;
  startPage: string;
  steps: TestCaseStep[];
  inferredRules?: string[];
  candidateExpectations?: TestCaseExpectations;
  candidateValidationRules?: ValidationRule[];
  outOfScope?: boolean;
}

export interface DiscoveryDraft {
  version: string;
  productId: string;
  targetUrl: string;
  timestamp: string;
  pages: PageInventoryItem[];
  flows: DiscoveredFlow[];
  sensitiveActions: SensitiveAction[];
  ambiguityQuestions: AmbiguityQuestion[];
  rawContextSummary?: string;
  /** True when AI-driven flow synthesis failed and flows were generated by the generic template fallback instead. */
  usedFallbackSynthesis?: boolean;
}

// --- Phase 3: Hub, Consolidation, Design & UX Types ---

export * from './fingerprint.js';

export type FindingLifecycleStatus = 'OPEN' | 'VERIFIED_FIXED' | 'REGRESSED' | 'ACCEPTED_RISK';

export interface EvidenceItemManifest {
  clientKey: string;
  fileType: 'screenshot' | 'video' | 'trace' | 'dom' | 'har' | 'log';
  mimeType: string;
  fileSize: number;
}

export interface RunManifestInitInput {
  productId: string;
  releaseTarget: string;
  commitHash?: string;
  developerId?: string;
  machineId?: string;
  branch?: string;
  evidenceItems: EvidenceItemManifest[];
}

export interface RunManifestInitResponse {
  runId: string;
  uploadUrls: Record<string, { uploadUrl: string; storageKey: string }>;
}

export interface RetryTelemetryEntry {
  flowId: string;
  testCaseId: string;
  failedStepIndex: number;
  retryCount: number;
  status: 'FLAKY_PASSED' | 'FAILED';
  errorMessage?: string;
}

export interface RunFinalizeInput {
  runId: string;
  durationMs: number;
  coverage: RunCoverage;
  testPoints: TestPointResult[];
  findings: Finding[];
  evidenceUploaded: string[];
  retryTelemetry?: RetryTelemetryEntry[];
}

export interface CanonicalFinding {
  id: string;
  fingerprint: string;
  productId: string;
  releaseTarget: string;
  checker: CheckerType;
  ruleCode: string;
  title: string;
  severity: FindingSeverity;
  route: string;
  selector?: string;
  status: FindingLifecycleStatus;
  firstSeenRunId: string;
  lastSeenRunId: string;
  firstSeenAt: string;
  lastSeenAt: string;
  occurrenceCount: number;
  runFindings: Array<{
    runId: string;
    testCaseId?: string;
    flowId?: string;
    stepIndex?: number;
    evidenceUrls?: string[];
    timestamp: string;
  }>;
}

export interface ConsolidatedReleaseReport {
  productId: string;
  releaseTarget: string;
  lastConsolidatedAt: string;
  totalRuns: number;
  summary: {
    totalFindings: number;
    open: number;
    verifiedFixed: number;
    regressed: number;
    acceptedRisk: number;
    flakyFlowsCount: number;
  };
  canonicalFindings: CanonicalFinding[];
}

export interface DesignTokens {
  colors?: Record<string, string>;
  spacing?: Record<string, string>;
  fontSize?: Record<string, string>;
  borderRadius?: Record<string, string>;
  fontFamily?: Record<string, string>;
}

export interface DesignTokenBaseline {
  version: string;
  productId: string;
  updatedAt: string;
  tokens: DesignTokens;
}

export interface AccountPoolConfig {
  [role: string]: Array<{
    username: string;
    password?: string;
    token?: string;
  }>;
}

export interface OutboxQueueEntry {
  id: string;
  runId: string;
  initPayload: RunManifestInitInput;
  finalizePayload: RunFinalizeInput;
  evidenceFiles: Array<{ localFilePath: string; clientKey: string }>;
  createdAt: string;
  retryAttempts: number;
  lastAttemptAt?: string;
  error?: string;
}

// --- Phase 4: Competitive & Reference Public Flow Analysis Types ---

export interface ReferenceFlowStep {
  stepIndex: number;
  action: string;
  url: string;
  title?: string;
  screenshotPath?: string;
  interactiveControlsFound: string[];
  fieldsCount: number;
  requiredFieldsCount: number;
}

export interface ReferenceFlow {
  id: string;
  targetDomain: string;
  entryUrl: string;
  name: string;
  steps: ReferenceFlowStep[];
  timestamp: string;
}

export interface FrictionScorecard {
  totalSteps: number;
  totalFields: number;
  requiredFieldsCount: number;
  clickDepth: number;
  frictionIndex: number;
  avgPageLoadMs: number;
}

export interface InteractivePattern {
  name: string;
  category: 'auth' | 'pricing' | 'form' | 'trust';
  present: boolean;
  description: string;
}

export interface UXRecommendation {
  id: string;
  category: 'Quick Win' | 'Strategic Investment' | 'UX Polish';
  title: string;
  effort: 'Low' | 'Medium' | 'High';
  impact: 'Low' | 'Medium' | 'High';
  rationale: string;
  suggestedAction: string;
}

export interface CompetitiveBenchmark {
  id: string;
  flowId: string;
  ourProduct: {
    url: string;
    name: string;
    scorecard: FrictionScorecard;
    a11yScore: number;
    screenshots: string[];
  };
  referenceProduct: {
    url: string;
    name: string;
    scorecard: FrictionScorecard;
    a11yScore: number;
    screenshots: string[];
  };
  delta: {
    stepDifference: number;
    fieldDifference: number;
    frictionRatio: number;
  };
  patterns: Array<{
    pattern: string;
    ourProduct: boolean;
    referenceProduct: boolean;
  }>;
  recommendations: UXRecommendation[];
  createdAt: string;
}


