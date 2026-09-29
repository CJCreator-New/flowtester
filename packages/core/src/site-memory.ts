import { promises as fs } from 'fs';
import path from 'path';
import type { DiscoveredFlow, DiscoveryDraft, ReleaseReport, TestCaseExpectations } from '@qa/types';
import { PlanValidator } from './discovery/plan-validator.js';

/**
 * What the tool remembers about one site between runs: the review's decisions and answers, checks
 * the owner fixed or added, tests they described, whether the host is a test copy, and what was
 * there last time (so the next plan can flag what's new). Kept in the runner's data folder.
 */
export interface SiteMemory {
  /** The site's host, e.g. "localhost:3050" or "shop.example.com". */
  host: string;
  updatedAt: string;
  /** The owner said this host is a test copy (staging), so it may be tested fully. */
  staging?: boolean;
  /** Pages found in the last run. */
  pages: string[];
  /** Journeys in the last run, by journey key, with a fingerprint of their steps. */
  journeys: Record<string, { name: string; steps: string; skipped?: boolean }>;
  /** Question keys asked in the last run. */
  questions: string[];
  /** Answers the owner gave in a review, by question key. Safe answers a skipped review filled in aren't kept. */
  answers: Record<string, string>;
  /** Expected results the owner fixed, and business rules they added, by journey key. */
  edits: Record<string, { expectations?: TestCaseExpectations; userRules?: DiscoveredFlow['userRules'] }>;
  /** Tests the owner described in a sentence. */
  addedJourneys: DiscoveredFlow[];
  /** What the site was seen doing that confirms a guessed rule, by journey key. */
  observed: Record<string, Array<{ field: string; message: string }>>;
}

/** The same journey on another run: same start page and name. */
export function journeyKey(flow: Pick<DiscoveredFlow, 'startPage' | 'name'>): string {
  return `${flow.startPage}|${flow.name.trim().toLowerCase()}`;
}

/** What the journey does, so a changed journey can be told from the same one. */
export function journeyFingerprint(flow: Pick<DiscoveredFlow, 'steps'>): string {
  return (flow.steps || []).map((s) => `${s.action}:${s.selector || s.value || ''}`).join('>');
}

function memoryFile(dataDir: string, host: string): string {
  return path.join(dataDir, 'sites', `${host.toLowerCase().replace(/[^a-z0-9.-]+/g, '_')}.json`);
}

export function emptySiteMemory(host: string): SiteMemory {
  return { host, updatedAt: new Date().toISOString(), pages: [], journeys: {}, questions: [], answers: {}, edits: {}, addedJourneys: [], observed: {} };
}

export async function loadSiteMemory(dataDir: string, host: string): Promise<SiteMemory | null> {
  try {
    return { ...emptySiteMemory(host), ...(JSON.parse(await fs.readFile(memoryFile(dataDir, host), 'utf8')) as SiteMemory) };
  } catch {
    return null;
  }
}

export async function saveSiteMemory(dataDir: string, memory: SiteMemory): Promise<void> {
  const file = memoryFile(dataDir, memory.host);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify({ ...memory, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
}

export interface MemorySummary {
  /** False on a site's first run: nothing is flagged as new then. */
  seenBefore: boolean;
  newPages: number;
  newJourneys: number;
  newQuestions: number;
  /** Questions answered from what the owner said last time. */
  rememberedAnswers: number;
}

const OBSERVED_EMPTY_FIELD = /^Leaving "(.+)" empty shows: "(.+)"$/;

/**
 * Applies what was remembered to a fresh plan: last time's answers and decisions, fixed checks,
 * added tests and confirmed rules. Flags pages, journeys and questions that weren't there before.
 */
export function applySiteMemory(draft: DiscoveryDraft, memory: SiteMemory | null): MemorySummary {
  const summary: MemorySummary = { seenBefore: !!memory, newPages: 0, newJourneys: 0, newQuestions: 0, rememberedAnswers: 0 };
  if (!memory) return summary;

  const knownPages = new Set(memory.pages);
  for (const page of draft.pages) {
    page.isNew = !knownPages.has(page.urlPath) || undefined;
    if (page.isNew) summary.newPages++;
  }

  // Tests the owner described last time come back, checked against today's pages.
  const existing = new Set(draft.flows.map(journeyKey));
  const validator = new PlanValidator(draft.pages, draft.forms);
  for (const added of memory.addedJourneys) {
    if (existing.has(journeyKey(added))) continue;
    const flow: DiscoveredFlow = JSON.parse(JSON.stringify(added));
    flow.id = `FLOW-USER-${draft.flows.length + 1}`;
    validator.markFlowsNeedingHelp([flow]);
    draft.flows.push(flow);
  }

  for (const flow of draft.flows) {
    const key = journeyKey(flow);
    const before = memory.journeys[key];
    flow.isNew = (!before || before.steps !== journeyFingerprint(flow)) || undefined;
    if (flow.isNew && flow.source !== 'user') summary.newJourneys++;
    if (before?.skipped) flow.outOfScope = true;

    const edit = memory.edits[key];
    if (edit?.expectations) flow.candidateExpectations = { ...edit.expectations, origin: 'user' };
    if (edit?.userRules) flow.userRules = edit.userRules;

    // A guessed rule the site was seen following becomes an observed rule, with the site's own words.
    for (const seen of memory.observed[key] || []) {
      const rule = flow.candidateValidationRules?.find((r) => r.field === seen.field);
      if (rule && rule.origin === 'ai-guess') {
        // Only the empty field was seen; the AI's guessed limits stay unconfirmed, so they go.
        rule.origin = 'observed';
        rule.expectedError = seen.message;
        delete rule.min;
        delete rule.max;
        delete rule.pattern;
      }
    }
  }

  const knownQuestions = new Set(memory.questions);
  for (const q of draft.ambiguityQuestions) {
    const remembered = q.key ? memory.answers[q.key] : undefined;
    if (remembered && q.options.includes(remembered)) {
      q.selectedAnswer = remembered;
      summary.rememberedAnswers++;
    }
    q.isNew = (!q.key || !knownQuestions.has(q.key)) || undefined;
    if (q.isNew) summary.newQuestions++;
  }
  return summary;
}

/**
 * Updates the memory after a run. What was there is always recorded; the owner's decisions and
 * answers only when they reviewed the plan (`answeredByOwner` holds the answers they chose, before
 * any safe answers were filled in).
 */
export function rememberRun(
  memory: SiteMemory | null,
  host: string,
  draft: DiscoveryDraft,
  review: { reviewed: boolean; answeredByOwner?: Record<string, string> } = { reviewed: false }
): SiteMemory {
  const next: SiteMemory = memory ? JSON.parse(JSON.stringify(memory)) : emptySiteMemory(host);
  next.pages = draft.pages.map((p) => p.urlPath);
  next.questions = draft.ambiguityQuestions.map((q) => q.key).filter((k): k is string => !!k);

  const journeys: SiteMemory['journeys'] = {};
  for (const flow of draft.flows) {
    const key = journeyKey(flow);
    journeys[key] = {
      name: flow.name,
      steps: journeyFingerprint(flow),
      // A decision stands until the owner reviews again; an unreviewed run doesn't undo it.
      skipped: review.reviewed ? flow.outOfScope || undefined : memory?.journeys[key]?.skipped,
    };
  }
  next.journeys = journeys;

  if (review.reviewed) {
    next.answers = { ...next.answers, ...(review.answeredByOwner || {}) };
    for (const flow of draft.flows) {
      const key = journeyKey(flow);
      const edit: SiteMemory['edits'][string] = {};
      if (flow.candidateExpectations?.origin === 'user') edit.expectations = flow.candidateExpectations;
      if (flow.userRules?.length) edit.userRules = flow.userRules;
      if (edit.expectations || edit.userRules) next.edits[key] = edit;
      else delete next.edits[key];
    }
    next.addedJourneys = draft.flows
      .filter((f) => f.source === 'user' && !f.outOfScope)
      .map(({ isNew: _isNew, needsHelp: _needsHelp, ...flow }) => flow);
  }
  return next;
}

/** Records what the site was seen doing that confirms a guessed rule, e.g. the error it shows. */
export function rememberObservations(memory: SiteMemory, draft: DiscoveryDraft, report: ReleaseReport): void {
  const flowsById = new Map(draft.flows.map((f) => [f.id, f]));
  for (const result of report.results) {
    const flow = flowsById.get(result.flowId);
    if (!flow) continue;
    const key = journeyKey(flow);
    for (const observation of result.observations || []) {
      const m = observation.match(OBSERVED_EMPTY_FIELD);
      if (!m) continue;
      const list = (memory.observed[key] ||= []);
      if (!list.some((o) => o.field === m[1])) list.push({ field: m[1], message: m[2] });
    }
  }
}
