import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TOOL_REF, workflowFor } from '../src/lib/workflow';

const root = resolve(__dirname, '../../..');

describe('workflow template', () => {
  it('fills the ref and leaves no placeholder', () => {
    const out = workflowFor('https://x.test');
    expect(out).not.toContain('__QA_TOOL_REF__');
    expect(out).not.toContain('__DEFAULT_URL__');
    expect(out).toContain('ref: main');
    expect(out).not.toContain('v0.1.0');
    expect(out).toContain("default: 'https://x.test'");
  });

  it('ref is main or a release tag, never a made-up tag', () => {
    expect(TOOL_REF === 'main' || /^v\d+\.\d+\.\d+$/.test(TOOL_REF)).toBe(true);
    expect(workflowFor('https://x.test')).toContain(`ref: ${TOOL_REF}`);
  });

  it('a release tag, once set, equals the root package.json version', () => {
    const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { version: string };
    if (TOOL_REF !== 'main') expect(TOOL_REF).toBe(`v${version}`);
  });

  it('url quote is escaped', () => {
    expect(workflowFor("https://x.test/a'b")).toContain("a''b");
  });

  it('permissions are not widened', () => {
    const out = workflowFor('https://x.test').replace(/\r\n/g, '\n');
    expect(out).toContain('permissions:\n  contents: read');
    expect(out).not.toContain('contents: write');
    expect(out).not.toContain('id-token');
    expect(out).not.toContain('pull-requests: write');
  });

  it('the template file keeps the placeholder', () => {
    const raw = readFileSync(resolve(root, 'templates/qa-check.yml'), 'utf8');
    expect(raw.split('__QA_TOOL_REF__').length - 1).toBe(1);
  });
});
