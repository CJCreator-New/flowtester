/**
 * The complete Plan (ADR 0009): every page, Navigation Check, journey and check a run does. The
 * crawler gathers the facts, the AI Planner writes the Plan Items, and the Plan is exactly what runs.
 * Terms are defined in CONTEXT.md.
 */
import type { Breakpoint, TestCaseExpectations, TestCaseStep } from './index.js';

/** Who planned a Plan Item: the AI, the Fixed-Rule Fallback when the AI couldn't, or the person. */
export type PlanItemSource = 'ai' | 'fallback' | 'person';

/** A link or navigation button on a page, as the crawler saw it. */
export interface PageLink {
  /** What a person would call it: its text or label. */
  name: string;
  /** Selector the runner can click. */
  selector: string;
  /** Where it goes: a path on the site, or a full address when it leaves the site. */
  to: string;
  /** Where it really ends up, when the site redirects `to` somewhere else. */
  landsOn?: string;
  /**
   * Where it ends up for each explorer, when that isn't `to`: a signed-out visitor who clicks
   * "My account" lands on the sign-in page, while a signed-in role reaches the account page.
   */
  landsOnBy?: Record<string, string>;
  /** It goes to another host. */
  leavesSite?: boolean;
  /** A button or script link: the crawler clicked it to learn where it goes. */
  scripted?: boolean;
  /** The part of the page it sits in, when that's a header, menu or footer. */
  landmark?: 'header' | 'nav' | 'footer';
  /** Narrow screen sizes where it's hidden, usually behind a menu button. */
  hiddenAt?: Breakpoint[];
  /** Who saw it: 'visitor' and/or role names (signed-in menus differ). */
  seenBy?: string[];
}

/** A menu button that narrow screens hide links behind, found by looking at a page at that size. */
export interface NarrowMenu {
  breakpoint: Breakpoint;
  selector: string;
  name: string;
}

/**
 * How a page is covered: tested on its own, tested as one of its Layout Group's Sample Pages,
 * covered by those samples, or promoted by the person to be tested on its own.
 */
export type PageCoverage = 'tested' | 'sample' | 'covered' | 'promoted';

/** One test the AI planned on a page, besides the visit that runs the graded checks. */
export interface PlanPageTest {
  id: string;
  /** What it checks, in plain words. */
  name: string;
  /** Who it runs as: the explorer whose view of the page it was planned from. */
  role: string;
  steps: TestCaseStep[];
  expectations?: TestCaseExpectations;
  source: PlanItemSource;
  skipped?: boolean;
  /** Why it can't run as planned, e.g. a step aimed at something the crawler never found. */
  needsHelp?: string[];
  /** It sends a form or changes data: on a live site it stays in the Plan but isn't run. */
  needsTestCopy?: boolean;
}

/** A page in the Plan. Every page the crawler found is listed. */
export interface PlanPage {
  id: string;
  urlPath: string;
  title: string;
  layoutGroup?: string;
  coverage: PageCoverage;
  /** The Sample Pages that stand for a covered page. */
  coveredBy?: string[];
  /** Who reaches it: 'visitor' and/or role names. */
  reachedBy: string[];
  /** The links a person clicks from the start page to get here, e.g. ["Products", "VitalWeave"]. */
  clickPath?: string[];
  /** No link on the site leads here. */
  unlinked?: boolean;
  screenshotPath?: string;
  /** What the AI planned to try on the page. */
  tests: PlanPageTest[];
  /** Who planned the page's tests. */
  source: PlanItemSource;
  skipped?: boolean;
  /** The person added it by its address. */
  added?: boolean;
  isNew?: boolean;
}

/** A Navigation Check: click one link as a person would and land on a working page. */
export interface NavigationCheck {
  id: string;
  /** Plain words, e.g. "Header menu: “About” opens the About page". */
  name: string;
  /** The page the check starts from: the link's page, or for a shared menu, a page that has it. */
  startPage: string;
  /** A header, menu or footer link found on many pages: checked once for the whole site. */
  shared?: 'header' | 'nav' | 'footer';
  linkName: string;
  selector: string;
  /** A path on the site, or a full address for a link that leaves it. */
  to: string;
  /** Where the link really ends up when the site redirects it: the check expects to land there. */
  landsOn?: string;
  /** Where it ends up for each role, when that differs (a sign-in page for signed-out visitors). */
  landsOnBy?: Record<string, string>;
  /** It goes to another host: only checked for being broken, with one request. */
  leavesSite?: boolean;
  /** What the destination should show, when the AI could say. */
  expectation?: string;
  /** Opening the menu first, at the screen sizes where the link hides behind a menu button (`onlyAt`). */
  menuSteps?: TestCaseStep[];
  /** Screen sizes where the link is hidden and no menu button shows it: the check doesn't run there. */
  notAt?: Breakpoint[];
  roles: string[];
  source: PlanItemSource;
  skipped?: boolean;
  isNew?: boolean;
}

/** A graded aspect that every tested page gets at every screen size: fixed, not planned. */
export interface PlanGradedCheck {
  id: string;
  name: string;
  description: string;
}

export interface PlanLayoutGroup {
  id: string;
  /** Plain words, e.g. "Pages like /products/…". */
  name: string;
  pages: string[];
  samples: string[];
}

/** AI requests the Plan needs, against what the AI key has left today. */
export interface AIRequestBudget {
  /** Requests the Plan was expected to need before planning started. */
  needed: number;
  /** Requests actually made, repairs included. */
  used: number;
  /** Free requests the key has left today after planning, when the AI service says. */
  left?: number;
  /** The key's free requests per day, when the AI service says. */
  limit?: number;
  /** About how many the visual review after the run will use. */
  visualReview?: number;
  /** Plan Items planned by fixed rules because the budget ran out. */
  overBudget?: number;
}

/** Something in the Plan that won't run, and why. */
export interface PlanWontRun {
  itemId?: string;
  what: string;
  reason: string;
}

/** The approval summary: what will run, and every default applied, each linked to its items. */
export interface PlanSummary {
  /** Tests: Plan Items × roles × screen sizes. */
  tests: number;
  /** Pages visited. */
  pages: number;
  /** Pages listed, covered ones included. */
  pagesListed: number;
  screenSizes: Breakpoint[];
  lines: Array<{ text: string; itemIds: string[] }>;
}

/** Another host the site links to: listed, its links checked for being broken, crawled if ticked. */
export interface PlanOtherHost {
  host: string;
  links: number;
  included?: boolean;
}

/** The Plan Items discovery produced, kept with the draft. */
export interface DraftPlan {
  pages: PlanPage[];
  navigation: NavigationCheck[];
  layoutGroups: PlanLayoutGroup[];
  otherHosts: PlanOtherHost[];
  budget?: AIRequestBudget;
}
