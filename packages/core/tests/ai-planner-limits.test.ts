/** Limits from the AI Planner (ADR 0024). No browser. */
import { describe, it, expect } from 'vitest';
import type { AIMessage, AICompletionOptions, AIProviderType, PageInventoryItem } from '@qa/types';
import type { AIProvider } from '../src/ai/ai-provider.js';
import { buildSiteGraph } from '../src/plan/site-graph.js';
import { sampleLayoutGroups } from '../src/plan/sampling.js';
import { planPagesAndMenus, type PagePlannerInput } from '../src/plan/ai-planner.js';

const el = (name: string, selector: string, role = 'textbox') => ({
  role,
  name,
  selector,
  tagName: 'input',
  visible: true,
  enabled: true,
});
const signup: PageInventoryItem = {
  urlPath: '/lab/signup',
  title: 'Signup',
  interactiveElementsCount: 2,
  formsCount: 1,
  elements: [el('Name', '#name'), el('Send', '#go', 'button')],
  reachedBy: ['visitor'],
  links: [],
  layoutGroup: 'a',
};

class Scripted implements AIProvider {
  readonly providerType: AIProviderType = 'mock';
  constructor(private test: object) {}
  async generateText(messages: AIMessage[], _o?: AICompletionOptions): Promise<string> {
    const prompt = messages.map((m) => m.content).join('\n');
    if (prompt.includes('Pages:\n')) return JSON.stringify({ pages: [{ urlPath: '/lab/signup', tests: [this.test] }] });
    return '{}';
  }
}

const input = (): PagePlannerInput => ({
  pages: [signup],
  forms: [
    {
      urlPath: '/lab/signup',
      method: 'POST',
      submitButtonSelector: '#go',
      inputs: [{ selector: '#name', label: 'Name', type: 'text' }],
    },
  ],
  coverage: sampleLayoutGroups([signup]).coverage,
  graph: buildSiteGraph([signup], '/lab/signup'),
  targetUrl: 'https://app.example/',
  siteType: 'app',
  readOnly: false,
  redact: (t) => t,
});

const aTest = (intent?: string) => ({
  name: 'A very long name',
  steps: [
    { action: 'fill', selector: '#name', value: 'x'.repeat(300), name: 'Name' },
    { action: 'click', selector: '#go', name: 'Send' },
  ],
  expect: {},
  ...(intent ? { intent } : {}),
});

const fromAi = (out: Awaited<ReturnType<typeof planPagesAndMenus>>) =>
  out.pages[0].tests.filter((t) => t.source === 'ai');

describe('Limits in the AI Planner', () => {
  it('plans Limits from the AI answer: needs a Test Copy, a guess, never failing on its own', async () => {
    const [t] = fromAi(await planPagesAndMenus(input(), new Scripted(aTest('limits'))));
    expect(t.intent).toBe('limits');
    expect(t.needsTestCopy).toBe(true);
    expect(t.expectations).toEqual({
      origin: 'ai-guess',
      refusal: { formPath: '/lab/signup', submitSelector: '#go' },
    });
  });

  it('plans none with no AI and no Source', async () => {
    const out = await planPagesAndMenus(input(), undefined);
    expect(out.pages.flatMap((p) => p.tests).filter((t) => t.intent === 'limits')).toEqual([]);
  });

  it('drops an intent the AI made up, and Limits on a test that sends no form', async () => {
    expect(fromAi(await planPagesAndMenus(input(), new Scripted(aTest('banana'))))[0].intent).toBeUndefined();
    const noSubmit = { ...aTest('limits'), steps: [{ action: 'fill', selector: '#name', value: 'x', name: 'Name' }] };
    expect(fromAi(await planPagesAndMenus(input(), new Scripted(noSubmit)))[0].intent).toBeUndefined();
  });
});
