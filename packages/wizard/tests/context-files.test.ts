import { describe, it, expect } from 'vitest';
import { readContextFiles, toContextDocuments } from '../src/lib/context';

const file = (name: string, body: string, size = body.length) => ({ name, size, text: async () => body });

describe('readContextFiles', () => {
  it('keeps two files apart with their names', async () => {
    const { accepted, rejected } = await readContextFiles([file('admin.md', '# Admin'), file('user.txt', 'Users')]);
    expect(rejected).toEqual([]);
    expect(toContextDocuments(accepted)).toEqual([
      { name: 'admin.md', text: '# Admin' },
      { name: 'user.txt', text: 'Users' },
    ]);
  });
  it('rejects PDF and old .doc plainly and keeps the good file', async () => {
    const { accepted, rejected } = await readContextFiles([file('a.pdf', 'x'), file('b.doc', 'x'), file('c.md', 'ok')]);
    expect(accepted.map((f) => f.name)).toEqual(['c.md']);
    expect(rejected[0]).toMatch(/is a PDF. Only text/);
    expect(rejected[1]).toMatch(/is an old Word document/);
  });
  it('converts a .docx through the converter and returns its text', async () => {
    const docx = { name: 'spec.docx', size: 10, text: async () => '', arrayBuffer: async () => new TextEncoder().encode('PK').buffer };
    const calls: Array<[string, string]> = [];
    const convertDocx = async (name: string, base64: string) => {
      calls.push([name, base64]);
      return { text: '# Admin\n- Can delete users', warnings: ['skipped an image'] };
    };
    const { accepted, rejected } = await readContextFiles([docx], 0, { convertDocx });
    expect(rejected).toEqual([]);
    expect(calls).toEqual([['spec.docx', 'UEs=']]);
    expect(accepted[0]).toMatchObject({ name: 'spec.docx', content: '# Admin\n- Can delete users', warnings: ['skipped an image'] });
  });
  it('says so when a .docx cannot be converted', async () => {
    const docx = { name: 'spec.docx', size: 10, text: async () => '', arrayBuffer: async () => new ArrayBuffer(2) };
    const r = await readContextFiles([docx], 0, {
      convertDocx: async () => {
        throw new Error('boom');
      },
    });
    expect(r.accepted).toEqual([]);
    expect(r.rejected[0]).toMatch(/couldn’t be read/);
  });
  it('caps text at 500 KB and Word files at 2 MB', async () => {
    const text = await readContextFiles([file('big.md', 'x', 501 * 1024)]);
    expect(text.rejected[0]).toMatch(/larger than 500 KB/);
    const word = await readContextFiles([{ name: 'big.docx', size: 3 * 1024 * 1024, text: async () => '' }]);
    expect(word.rejected[0]).toMatch(/larger than 2 MB/);
  });
  it('rejects empty, oversize and over-limit files', async () => {
    const r = await readContextFiles([file('e.md', '  '), file('big.md', 'x', 2 * 1024 * 1024)]);
    expect(r.accepted).toEqual([]);
    expect(r.rejected).toHaveLength(2);
    const full = await readContextFiles([file('z.md', 'z')], 10);
    expect(full.rejected[0]).toMatch(/up to 10 files/);
  });
  it('reports an unreadable file', async () => {
    const bad = {
      name: 'x.md',
      size: 1,
      text: async (): Promise<string> => {
        throw new Error('nope');
      },
    };
    expect((await readContextFiles([bad])).rejected[0]).toMatch(/couldn’t be read/);
  });
});

describe('splitStoredContext', () => {
  it('gives the typed text and the named documents back', async () => {
    const { splitStoredContext } = await import('../src/lib/context');
    const stored = 'Typed notes\n\n# Document: admin.md\n# Admin\nCan delete\n\n# Document: user.txt\nUsers read';
    expect(splitStoredContext(stored)).toEqual({
      productContext: 'Typed notes',
      documents: [
        { name: 'admin.md', text: '# Admin\nCan delete' },
        { name: 'user.txt', text: 'Users read' },
      ],
    });
  });
  it('leaves plain text alone', async () => {
    const { splitStoredContext } = await import('../src/lib/context');
    expect(splitStoredContext('Just specs')).toEqual({ productContext: 'Just specs', documents: undefined });
    expect(splitStoredContext(undefined)).toEqual({});
  });
});
