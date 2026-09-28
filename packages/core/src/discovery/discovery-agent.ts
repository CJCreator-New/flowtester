import { promises as fs } from 'fs';
import path from 'path';
import type {
  ProductProfile,
  DiscoveryDraft,
  DiscoveredFlow,
  AmbiguityQuestion,
  AIMessage,
} from '@qa/types';
import { BrowserManager } from '../browser.js';
import { DeterministicSpider } from './deterministic-spider.js';
import { ContextParser } from './context-parser.js';
import type { AIProvider } from '../ai/ai-provider.js';

export interface DiscoveryOptions {
  targetUrl: string;
  productId: string;
  profile?: ProductProfile;
  contextFilePath?: string;
  outputDir?: string;
  aiProvider: AIProvider;
}

export class DiscoveryAgent {
  private browserManager = new BrowserManager();
  private contextParser = new ContextParser();

  async discover(options: DiscoveryOptions): Promise<DiscoveryDraft> {
    const outputDir = options.outputDir || path.join(process.cwd(), '.qa-report');
    await fs.mkdir(outputDir, { recursive: true });

    // 1. Ingest Product Context
    const parsedContext = await this.contextParser.parseFile(options.contextFilePath);

    // 2. Run Deterministic Spider
    const spider = new DeterministicSpider(options.profile?.forbiddenActions || []);
    const context = await this.browserManager.createContext({
      baseUrl: options.targetUrl,
    });

    console.log(`[DiscoveryAgent] Crawling routes and interactive forms on ${options.targetUrl}...`);
    const spiderResult = await spider.crawl(context, options.targetUrl);
    await context.close();
    await this.browserManager.close();

    console.log(
      `[DiscoveryAgent] Spider found ${spiderResult.pages.length} pages, ${spiderResult.forms.length} forms, ${spiderResult.sensitiveActions.length} sensitive actions.`
    );

    // 3. Form ambiguity questions for unmapped forms
    const ambiguityQuestions: AmbiguityQuestion[] = [...spiderResult.ambiguityQuestions];
    let qCounter = ambiguityQuestions.length + 1;

    for (const form of spiderResult.forms) {
      ambiguityQuestions.push({
        id: `Q-FORM-${qCounter++}`,
        targetElement: form.submitButtonSelector || 'form',
        urlPath: form.urlPath,
        question: `Found form on "${form.urlPath}" submitting to "${form.action}" with fields [${form.inputs.map((i) => i.name).join(', ')}]. What should happen on submit?`,
        options: [
          'Expect navigation to confirmation / detail page',
          'Expect inline success banner',
          'Exclude form from testing (out of scope)',
        ],
        category: 'untested_form',
      });
    }

    // 4. Synthesize flows using AI Provider
    const promptMessage: AIMessage = {
      role: 'user',
      content: `
You are an expert QA Engineer synthesizing application flows for pre-release testing.
Target Application: ${options.targetUrl}
Product ID: ${options.productId}

Product Context:
${parsedContext.rawContent || 'No written PRD provided. Rely on discovered pages.'}

Discovered Pages:
${JSON.stringify(spiderResult.pages, null, 2)}

Discovered Forms:
${JSON.stringify(spiderResult.forms, null, 2)}

Roles:
${JSON.stringify(options.profile?.roles || [{ role: 'member' }], null, 2)}

Generate a JSON object with:
1. "flows": an array of DiscoveredFlow items. Each flow MUST have:
   - "id": e.g. "FLOW-001"
   - "name": flow name
   - "role": assigned role
   - "description": summary
   - "startPage": starting URL path
   - "steps": array of { action: "click"|"fill"|"navigate"|"wait", selector?: string, value?: string, name: string }
   - "inferredRules": list of validation or business constraints
   - "candidateExpectations": { url?: { pattern: string }, text?: { contains: string } }
   - "candidateValidationRules": [ { field: string, selector?: string, min?: number, max?: number, expectedError: string } ]
2. "inferredRules": list of global inferred application business rules

Respond with ONLY the JSON object.
`,
    };

    const NON_FILLABLE_TYPES = new Set(['submit', 'button', 'reset', 'checkbox', 'radio', 'file', 'image', 'hidden']);

    const parseFlowsFromResponse = (responseText: string): DiscoveredFlow[] => {
      const cleanJson = responseText
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
      const parsed = JSON.parse(cleanJson);
      return parsed.flows || [];
    };

    // Some models (esp. smaller/free ones) omit "value" on fill steps entirely, which
    // otherwise silently no-ops the action (e.g. a login form submitted with blank fields
    // that still "succeeds" because no exception is thrown). Detect this before accepting
    // a parse as usable so it triggers the same repair retry as malformed JSON.
    const findMissingFillValue = (flows: DiscoveredFlow[]): string | null => {
      for (const flow of flows) {
        for (const step of flow.steps || []) {
          if (step.action === 'fill' && (!step.value || String(step.value).trim() === '')) {
            return `Flow "${flow.id}" step "${step.name}" has action "fill" but no non-empty "value".`;
          }
        }
      }
      return null;
    };

    // Best-effort heuristic value for a fill step that still has no value after a repair
    // attempt, so we never silently execute a no-op fill. Better an obviously-fake value
    // that produces a visible finding than a blank field that passes silently.
    const guessFillValue = (step: { selector?: string; name: string }): string => {
      const hint = `${step.selector || ''} ${step.name}`.toLowerCase();
      if (hint.includes('email')) return 'test.user@example.com';
      if (hint.includes('password') || hint.includes('pass')) return 'TestPassword123!';
      if (hint.includes('phone') || hint.includes('tel')) return '5555550123';
      if (hint.includes('name')) return 'Test User';
      if (hint.includes('number') || hint.includes('amount') || hint.includes('qty')) return '1';
      return 'Test Value';
    };

    const backfillMissingFillValues = (flows: DiscoveredFlow[]): void => {
      for (const flow of flows) {
        for (const step of flow.steps || []) {
          if (step.action === 'fill' && (!step.value || String(step.value).trim() === '')) {
            const guessed = guessFillValue(step);
            console.warn(
              `[DiscoveryAgent] AI-generated fill step "${step.name}" in flow "${flow.id}" had no value; backfilling with a placeholder ("${guessed}") to avoid a silent no-op.`
            );
            step.value = guessed;
          }
        }
      }
    };

    let synthesizedFlows: DiscoveredFlow[] = [];
    let usedFallbackSynthesis = false;
    try {
      const responseText = await options.aiProvider.generateText(
        [
          {
            role: 'system',
            content: 'You are an autonomous QA flow extraction agent. Output strictly valid JSON.',
          },
          promptMessage,
        ],
        { responseFormat: 'json', temperature: 0.2 }
      );

      try {
        synthesizedFlows = parseFlowsFromResponse(responseText);
        const missingValueIssue = findMissingFillValue(synthesizedFlows);
        if (missingValueIssue) {
          throw new Error(missingValueIssue);
        }
      } catch (parseErr) {
        // Either invalid JSON (truncation, stray prose, etc.) or a valid-but-incomplete
        // flow (missing fill value). Give the model one chance to repair its own output
        // before giving up on AI synthesis or backfilling a placeholder.
        console.warn(
          `[DiscoveryAgent] AI response needs repair (${parseErr instanceof Error ? parseErr.message : parseErr}); retrying with a repair prompt...`
        );
        const repairText = await options.aiProvider.generateText(
          [
            {
              role: 'system',
              content: 'You are an autonomous QA flow extraction agent. Output strictly valid JSON.',
            },
            promptMessage,
            { role: 'assistant', content: responseText },
            {
              role: 'user',
              content:
                'That response was not usable — either it was not valid JSON, or a "fill" step was missing a non-empty "value" field. Reply again with ONLY a single valid JSON object matching the requested schema — no markdown fences, no commentary, no truncation, and every "fill" step MUST include a concrete non-empty "value".',
            },
          ],
          { responseFormat: 'json', temperature: 0 }
        );
        synthesizedFlows = parseFlowsFromResponse(repairText);
        // If the repair attempt still didn't produce a value, don't silently no-op the
        // step — backfill a placeholder so the step actually does something observable.
        backfillMissingFillValues(synthesizedFlows);
      }
    } catch (aiErr) {
      console.warn(`[DiscoveryAgent] AI flow synthesis fallback triggered: ${aiErr instanceof Error ? aiErr.message : aiErr}`);
      usedFallbackSynthesis = true;
      // Fallback: generate default flows from discovered forms.
      // Only text-like inputs get a `fill` step; buttons/submits/checkboxes get `click` (or are skipped).
      let flowIdx = 1;
      for (const form of spiderResult.forms) {
        const fillableInputs = form.inputs.filter((inp) => !NON_FILLABLE_TYPES.has(inp.type));
        // type="button" needs its own click step; type="submit" is already covered by
        // submitButtonSelector below, so it's excluded here to avoid a duplicate click.
        const clickableInputs = form.inputs.filter((inp) => inp.type === 'button');

        synthesizedFlows.push({
          id: `FLOW-FALLBACK-${flowIdx++}`,
          name: `Form Flow on ${form.urlPath}`,
          role: options.profile?.roles?.[0]?.role || 'member',
          description: `Discovered form submission on ${form.urlPath}`,
          startPage: form.urlPath,
          steps: [
            ...fillableInputs.map((inp) => ({
              action: 'fill' as const,
              selector: inp.selector,
              value: inp.type === 'number' ? '100' : 'Test Value',
              name: `Fill ${inp.name || 'field'}`,
            })),
            ...clickableInputs.map((inp) => ({
              action: 'click' as const,
              selector: inp.selector,
              name: `Click ${inp.name || 'button'}`,
            })),
            ...(form.submitButtonSelector
              ? [{ action: 'click' as const, selector: form.submitButtonSelector, name: 'Submit Form' }]
              : []),
          ],
          inferredRules: ['Form fields require valid inputs'],
          candidateExpectations: {
            url: { pattern: '/*' },
          },
        });
      }
    }

    const draft: DiscoveryDraft = {
      version: '1.0',
      productId: options.productId,
      targetUrl: options.targetUrl,
      timestamp: new Date().toISOString(),
      pages: spiderResult.pages,
      flows: synthesizedFlows,
      sensitiveActions: spiderResult.sensitiveActions,
      ambiguityQuestions,
      rawContextSummary: parsedContext.summary,
      usedFallbackSynthesis,
    };

    const draftPath = path.join(outputDir, 'discovery-draft.json');
    await fs.writeFile(draftPath, JSON.stringify(draft, null, 2), 'utf8');
    console.log(`[DiscoveryAgent] Discovery draft saved to ${draftPath}`);

    return draft;
  }
}
