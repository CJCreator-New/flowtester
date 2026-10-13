import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'checkindaily');
const files = readdirSync(dir);
const textFiles = files.filter((f) => /\.(md|txt)$/i.test(f));

describe('checkindaily spec fixtures contain no secrets', () => {
  it('has fixture files and no seed or credential file', () => {
    expect(textFiles.length).toBeGreaterThanOrEqual(2);
    for (const f of files) {
      expect(f).not.toMatch(/seed/i);
      expect(f).not.toMatch(/\.(ts|js|json|env)$/i);
      expect(f).not.toMatch(/^\.env/i);
    }
  });

  it.each(textFiles)('%s has no password values, email addresses or credentials', (f) => {
    const text = readFileSync(join(dir, f), 'utf8');
    // "password" is allowed only as a feature word (set-password, complexity rule).
    expect(text).not.toMatch(/password\s*[:=]\s*\S+/i);
    expect(text).not.toMatch(/\bpwd\b|\bpasswd\b/i);
    expect(text).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    expect(text).not.toMatch(/https?:\/\//i);
    expect(text).not.toMatch(/\b(sk|pk|api|key|token)[-_][A-Za-z0-9]{16,}/i);
    expect(text).not.toMatch(/\b\d{1,3}(\.\d{1,3}){3}\b/);
    expect(text).not.toMatch(/BEGIN [A-Z ]*PRIVATE KEY/);
  });
});
