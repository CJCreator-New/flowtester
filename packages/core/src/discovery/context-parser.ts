import { promises as fs } from 'fs';

export interface ParsedRequirementHint {
  id: string;
  name: string;
  description: string;
  expectedFlow?: string;
  rules: string[];
}

export interface ParsedProductContext {
  summary: string;
  requirements: ParsedRequirementHint[];
  rawContent: string;
}

export class ContextParser {
  async parseFile(filePath?: string): Promise<ParsedProductContext> {
    if (!filePath) {
      return {
        summary: 'No external product context provided.',
        requirements: [],
        rawContent: '',
      };
    }

    try {
      const content = await fs.readFile(filePath, 'utf8');
      return this.parseContent(content);
    } catch (err: unknown) {
      return {
        summary: `Could not read context file: ${err instanceof Error ? err.message : String(err)}`,
        requirements: [],
        rawContent: '',
      };
    }
  }

  parseContent(content: string): ParsedProductContext {
    const lines = content.split('\n');
    const requirements: ParsedRequirementHint[] = [];
    let reqCounter = 1;

    let currentReq: ParsedRequirementHint | null = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();

      // Look for headers like "## Invoice Creation" or "### User Story: Sign In"
      if (line.startsWith('#') && line.length > 2) {
        if (currentReq) {
          requirements.push(currentReq);
        }
        const headerTitle = line.replace(/^#+\s*/, '');
        currentReq = {
          id: `REQ-${reqCounter++}`,
          name: headerTitle,
          description: headerTitle,
          rules: [],
        };
      } else if (currentReq && (line.startsWith('-') || line.startsWith('*'))) {
        const item = line.replace(/^[-*]\s*/, '');
        currentReq.rules.push(item);
      } else if (currentReq && line.length > 0 && !currentReq.description) {
        currentReq.description = line;
      }
    }

    if (currentReq) {
      requirements.push(currentReq);
    }

    const firstFewLines = lines
      .filter((l) => l.trim().length > 0 && !l.startsWith('#'))
      .slice(0, 3)
      .join(' ');

    return {
      summary: firstFewLines || 'Extracted Product Context',
      requirements,
      rawContent: content,
    };
  }
}
