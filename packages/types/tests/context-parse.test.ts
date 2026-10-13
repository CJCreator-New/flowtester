import { describe, it, expect } from 'vitest';
import { parseDocumentText, summarizeDocument, isSupportedContextName } from '../src/context-parse.js';

describe('summarizeDocument', () => {
  it('counts requirements, journeys, tables and rules', () => {
    const text = [
      '# Spec',
      '- a rule',
      '**Journey J1: Go**',
      '- Steps: a → b',
      '| Route | Roles |',
      '|---|---|',
      '| /x | all |',
    ].join('\n');
    expect(summarizeDocument(text)).toEqual({ requirements: 2, journeys: 1, tables: 1, rules: 1 });
  });

  it('plain prose with no structure is zero yield', () => {
    const s = summarizeDocument('Just some words.\nMore words.');
    expect([s.requirements, s.journeys, s.tables]).toEqual([0, 0, 0]);
  });

  it('is deterministic', () => {
    const t = '# A\n- x\n| H |\n|---|\n| v |';
    expect(parseDocumentText(t)).toEqual(parseDocumentText(t));
  });
});

describe('parseDocumentText', () => {
  it('omits document and section without options', () => {
    const [h] = parseDocumentText('# A\n- x').hints;
    expect(h.document).toBeUndefined();
    expect(h.section).toBeUndefined();
  });
  it('ignores headings inside a fenced block', () => {
    const { hints } = parseDocumentText('# A\n```\n# not a heading\n```');
    expect(hints).toHaveLength(1);
  });
});

describe('isSupportedContextName', () => {
  it('docx ok, pdf and doc refused', () => {
    expect(isSupportedContextName('a.docx')).toEqual({ ok: true });
    expect(isSupportedContextName('a.pdf').ok).toBe(false);
    expect(isSupportedContextName('a.doc').ok).toBe(false);
  });
});

describe('heading-form journeys (Word documents)', () => {
  const doc = [
    '# 1. Employee',
    '',
    '## J1 — Apply for leave',
    '',
    '- Preconditions: user is signed in; balance exists.',
    '- Steps: open Requests → new request → submit.',
    '- Expected: status shows Applied; request is queued.',
    '',
    '## Journey B: Cancel leave',
    '- Given',
    '  - a pending request',
    '- When',
    '  1. open the request',
    '  2. press Cancel',
    '- Then',
    '  - status shows Cancelled',
    '',
    '# 2. Admin',
    '### Scenario - Export',
    'As an auditor, I export the log.',
    '- Steps: click Export',
    '- Assertions: file downloads',
    '',
    '## Flow 3: Role line',
    'Role: Manager',
    '- Step: approve',
    '- Expected result: approved',
  ].join('\n');

  it('recognises journey headings, labels, nested items and persona', () => {
    const { hints } = parseDocumentText(doc);
    const j = hints.filter((h) => h.kind === 'journey');
    expect(j.map((h) => h.name)).toEqual(['Apply for leave', 'Cancel leave', 'Export', 'Role line']);
    expect(j[0]).toMatchObject({
      persona: 'Employee',
      preconditions: ['user is signed in', 'balance exists.'],
      steps: ['open Requests', 'new request', 'submit.'],
      assert: ['status shows Applied', 'request is queued.'],
    });
    expect(j[1]).toMatchObject({
      preconditions: ['a pending request'],
      steps: ['open the request', 'press Cancel'],
      assert: ['status shows Cancelled'],
    });
    expect(j[2]).toMatchObject({ persona: 'auditor', steps: ['click Export'], assert: ['file downloads'] });
    expect(j[3]).toMatchObject({ persona: 'Manager', steps: ['approve'], assert: ['approved'] });
    expect(summarizeDocument(doc).journeys).toBe(4);
  });

  it('plain headings that merely start with a similar word stay sections', () => {
    const { hints } = parseDocumentText('# Flow charts\n# Journeys overview\n# Scenarios');
    expect(hints.every((h) => h.kind === 'section')).toBe(true);
  });
});
