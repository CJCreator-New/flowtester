/**
 * checkContextDocuments with Word: a .docx arrives already converted to text (name keeps .docx), so
 * the 500 KB and 10-document limits apply to the text. PDF and old .doc stay refused.
 */
import { describe, it, expect } from 'vitest';
import { checkContextDocuments, MAX_CONTEXT_DOC_BYTES } from '../src/run-inputs.js';

describe('checkContextDocuments with .docx', () => {
  it('accepts a docx-derived document', () => {
    const got = checkContextDocuments([{ name: ' Spec v2.docx ', text: '# Site Map\n\n| Route | Roles |' }]);
    expect(got).toEqual({ ok: true, value: [{ name: 'Spec v2.docx', text: '# Site Map\n\n| Route | Roles |' }] });
  });

  it('accepts .docx beside .md and .txt', () => {
    const got = checkContextDocuments([
      { name: 'a.md', text: '# a' },
      { name: 'b.txt', text: 'b' },
      { name: 'c.DOCX', text: '# c' },
    ]);
    expect(got.ok && got.value?.map((d) => d.name)).toEqual(['a.md', 'b.txt', 'c.DOCX']);
  });

  it('refuses a docx text over 500 KB', () => {
    const got = checkContextDocuments([{ name: 'big.docx', text: 'a'.repeat(MAX_CONTEXT_DOC_BYTES + 1) }]);
    expect(got.ok).toBe(false);
    if (!got.ok) {
      expect(got.problem.code).toBe('ERR_INVALID_CONTEXT');
      expect(got.problem.error).toContain('500 KB');
    }
  });

  it('refuses .pdf and .doc with a plain message', () => {
    for (const name of ['spec.pdf', 'spec.doc']) {
      const got = checkContextDocuments([{ name, text: 'x' }]);
      expect(got.ok, name).toBe(false);
      if (!got.ok) {
        expect(got.problem.code).toBe('ERR_INVALID_CONTEXT');
        expect(got.problem.error).toContain(name);
        expect(got.problem.error).toMatch(/not supported/);
      }
    }
  });

  it('refuses 11 documents', () => {
    const many = Array.from({ length: 11 }, (_, i) => ({ name: `d${i}.docx`, text: '# a' }));
    const got = checkContextDocuments(many);
    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.problem.error).toContain('at most 10');
  });

  it('accepts exactly 10 documents', () => {
    const ten = Array.from({ length: 10 }, (_, i) => ({ name: `d${i}.docx`, text: '# a' }));
    expect(checkContextDocuments(ten).ok).toBe(true);
  });
});
