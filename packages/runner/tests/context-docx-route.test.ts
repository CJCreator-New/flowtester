/**
 * POST /api/runner/context/docx: one Word file in as base64, Markdown and a read summary out.
 * Stateless, open on a shared copy (beta). Nothing is stored or logged.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'http';
import { promises as fs } from 'fs';
import path from 'path';
import { RunnerServer } from '../src/server.js';

const PORT = 3597;
const BETA_PORT = 3598;
const scratch = path.join(process.cwd(), '.tmp-context-docx-route');

// --- tiny stored (uncompressed) ZIP writer, test only ---
const CRC_TABLE = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();
function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of data) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
interface ZipEntry {
  name: string;
  data: string;
  declaredSize?: number;
}
function buildZip(entries: ZipEntry[]): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = enc.encode(e.name);
    const data = enc.encode(e.data);
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    parts.push(local, data);
    const cd = new Uint8Array(46 + name.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, e.declaredSize ?? data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    cd.set(name, 46);
    central.push(cd);
    offset += local.length + data.length;
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let pos = 0;
  for (const p of all) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const para = (text: string, style?: string) =>
  `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
const cell = (text: string) => `<w:tc>${para(text)}</w:tc>`;
const tableXml = (rows: string[][]) =>
  `<w:tbl>${rows.map((r) => `<w:tr>${r.map(cell).join('')}</w:tr>`).join('')}</w:tbl>`;

function makeDocx(bodyXml: string, extra: ZipEntry[] = []): Uint8Array {
  return buildZip([
    {
      name: '[Content_Types].xml',
      data: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
    },
    {
      name: '_rels/.rels',
      data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    },
    {
      name: 'word/_rels/document.xml.rels',
      data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    },
    {
      name: 'word/styles.xml',
      data: `<?xml version="1.0" encoding="UTF-8"?><w:styles ${W}><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style></w:styles>`,
    },
    {
      name: 'word/document.xml',
      data: `<?xml version="1.0" encoding="UTF-8"?><w:document ${W}><w:body>${bodyXml}</w:body></w:document>`,
    },
    ...extra,
  ]);
}

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');

interface Answer {
  status: number;
  body: string;
}
function call(port: number, body: unknown): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    const req = http.request(
      {
        host: 'localhost',
        port,
        path: '/api/runner/context/docx',
        method: 'POST',
        headers: {
          host: `localhost:${port}`,
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let text = '';
        res.on('data', (chunk) => (text += chunk));
        res.on('end', () => resolve({ status: res.statusCode || 0, body: text }));
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

const spec = makeDocx(
  para('Site Map', 'Heading1') + tableXml([['Route', 'Roles'], ['/report', 'lead / manager / HR']]) + para('Login with password: hunter2 today')
);

// The first conversion loads mammoth (several seconds cold).
describe('POST /api/runner/context/docx', { timeout: 30_000 }, () => {
  let local: RunnerServer;
  let beta: RunnerServer;

  beforeAll(async () => {
    local = new RunnerServer({ port: PORT, outputDir: path.join(scratch, 'out'), dataDir: path.join(scratch, 'data') });
    beta = new RunnerServer({
      port: BETA_PORT,
      outputDir: path.join(scratch, 'out-beta'),
      dataDir: path.join(scratch, 'data-beta'),
      beta: true,
    });
    await local.start();
    await beta.start();
  });
  afterAll(async () => {
    await local?.stop();
    await beta?.stop();
    await fs.rm(scratch, { recursive: true, force: true }).catch(() => {});
  });

  it('returns Markdown, warnings and a read summary for a Word file', async () => {
    const answer = await call(PORT, { name: 'spec.docx', base64: b64(spec) });
    expect(answer.status).toBe(200);
    const out = JSON.parse(answer.body) as {
      text: string;
      warnings: string[];
      summary: { requirements: number; journeys: number; tables: number; rules: number };
    };
    expect(out.text).toContain('# Site Map');
    expect(out.text).toContain('| /report |');
    expect(Array.isArray(out.warnings)).toBe(true);
    expect(out.summary.tables).toBeGreaterThanOrEqual(1);
    expect(out.summary.requirements).toBeGreaterThanOrEqual(1);
  });

  it('hides a password typed into the document', async () => {
    const answer = await call(PORT, { name: 'spec.docx', base64: b64(spec) });
    expect(answer.body).not.toContain('hunter2');
    expect(JSON.parse(answer.body).text).toContain('[hidden]');
  });

  it('refuses bytes that are not a ZIP, named .docx', async () => {
    const answer = await call(PORT, { name: 'fake.docx', base64: Buffer.from('# just markdown').toString('base64') });
    expect(answer.status).toBe(400);
    const out = JSON.parse(answer.body);
    expect(out.code).toBe('ERR_INVALID_CONTEXT');
    expect(out.error).toMatch(/not a Word/);
  });

  it('refuses a ZIP whose declared size is a bomb', async () => {
    const bomb = makeDocx(para('x'), [{ name: 'word/big.bin', data: 'a', declaredSize: 25 * 1024 * 1024 }]);
    const answer = await call(PORT, { name: 'bomb.docx', base64: b64(bomb) });
    expect(answer.status).toBe(400);
    expect(JSON.parse(answer.body).code).toBe('ERR_INVALID_CONTEXT');
    expect(JSON.parse(answer.body).error).toMatch(/20 MB/);
  });

  it('refuses a file over 2 MB without decoding it', async () => {
    const big = Buffer.alloc(2 * 1024 * 1024 + 1024, 0x50).toString('base64');
    const answer = await call(PORT, { name: 'big.docx', base64: big });
    expect(answer.status).toBe(400);
    expect(JSON.parse(answer.body)).toMatchObject({ code: 'ERR_INVALID_CONTEXT' });
    expect(JSON.parse(answer.body).error).toMatch(/2 MB/);
  });

  it('refuses a missing name, missing content, a non-.docx name and bad JSON', async () => {
    for (const body of [
      {},
      { name: 'spec.docx' },
      { base64: b64(spec) },
      { name: 'spec.docx', base64: 42 },
      { name: 'spec.pdf', base64: b64(spec) },
      { name: 'spec.md', base64: b64(spec) },
      'not json',
    ]) {
      const answer = await call(PORT, body);
      expect(answer.status, JSON.stringify(body).slice(0, 40)).toBe(400);
      expect(JSON.parse(answer.body).code).toBe('ERR_INVALID_CONTEXT');
    }
  });

  it('is open on a shared copy (beta): answers 200', async () => {
    const answer = await call(BETA_PORT, { name: 'spec.docx', base64: b64(spec) });
    expect(answer.status).toBe(200);
    expect(JSON.parse(answer.body).text).toContain('# Site Map');
  });

  it('logs nothing of the file and stores nothing', async () => {
    const logged: string[] = [];
    for (const method of ['log', 'info', 'warn', 'error'] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        logged.push(args.map(String).join(' '));
      });
    }
    const unique = makeDocx(para('Zebra-unique-heading-9917', 'Heading1'));
    const answer = await call(PORT, { name: 'u.docx', base64: b64(unique) });
    vi.restoreAllMocks();
    expect(answer.status).toBe(200);
    expect(logged.join('\n')).not.toContain('Zebra-unique-heading-9917');

    const walk = async (dir: string): Promise<string[]> => {
      const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
      const files = await Promise.all(
        entries.map((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : Promise.resolve([path.join(dir, e.name)])))
      );
      return files.flat();
    };
    for (const file of await walk(scratch)) {
      expect(await fs.readFile(file, 'utf8').catch(() => ''), file).not.toContain('Zebra-unique-heading-9917');
    }
  });
});
