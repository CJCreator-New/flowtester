import http from 'http';
import { promises as fs } from 'fs';
import path from 'path';
import type { ReleaseReport, TriageStatus, DiscoveryDraft, AIProviderType } from '@qa/types';
import { KeyResolver } from '@qa/core';
import { renderDashboardHtml, renderConfirmHtml } from './ui.js';

function isInside(dir: string, file: string): boolean {
  const rel = path.relative(dir, file);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname);
  } catch {
    return false;
  }
}

export interface DashboardServerOptions {
  port?: number;
  reportDir?: string;
  host?: string;
}

export class DashboardServer {
  private server: http.Server | null = null;
  private port: number;
  private host: string;
  private reportDir: string;
  private streamClients = new Set<http.ServerResponse>();

  constructor(options: DashboardServerOptions = {}) {
    this.port = options.port || 3000;
    this.host = options.host || 'localhost';
    this.reportDir = path.resolve(options.reportDir || path.join(process.cwd(), '.qa-report'));
  }

  public broadcastRunnerEvent(event: any): void {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of this.streamClients) {
      try {
        client.write(payload);
      } catch {
        this.streamClients.delete(client);
      }
    }
  }

  public async start(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        try {
          const url = new URL(req.url || '/', `http://${this.host}:${this.port}`);
          const pathname = url.pathname;

          // CORS for local development only. A wildcard would let any website the developer
          // visits read evidence and write API keys through this localhost server.
          const origin = req.headers.origin;
          if (origin && isLoopbackOrigin(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Vary', 'Origin');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          } else if (origin && req.method !== 'GET') {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Cross-origin requests are only accepted from localhost');
            return;
          }

          if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
          }

          // 0. GET /api/runner/stream (Server-Sent Events)
          if (pathname === '/api/runner/stream') {
            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache, no-transform',
              'Connection': 'keep-alive',
            });
            res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);
            this.streamClients.add(res);

            req.on('close', () => {
              this.streamClients.delete(res);
            });
            return;
          }

          // 1. Root Dashboard HTML
          if (pathname === '/' || pathname === '/index.html') {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(renderDashboardHtml());
            return;
          }

          // 1b. Confirmation Dashboard HTML
          if (pathname === '/confirm' || pathname === '/confirm.html') {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(renderConfirmHtml());
            return;
          }

          // 2. GET /api/report
          if (pathname === '/api/report') {
            const findingsPath = path.join(this.reportDir, 'findings.json');
            try {
              const data = await fs.readFile(findingsPath, 'utf8');
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(data);
            } catch (err) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: `findings.json not found in ${this.reportDir}` }));
            }
            return;
          }

          // 2b. GET /api/discovery/draft
          if (pathname === '/api/discovery/draft') {
            const draftPath = path.join(this.reportDir, 'discovery-draft.json');
            try {
              const data = await fs.readFile(draftPath, 'utf8');
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(data);
            } catch (err) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: `discovery-draft.json not found in ${this.reportDir}` }));
            }
            return;
          }

          // 2c. POST /api/discovery/confirm
          if (req.method === 'POST' && pathname === '/api/discovery/confirm') {
            let body = '';
            for await (const chunk of req) {
              body += chunk;
            }
            try {
              const { draft, generateSpec } = JSON.parse(body) as {
                draft: DiscoveryDraft;
                generateSpec?: boolean;
              };
              const draftPath = path.join(this.reportDir, 'discovery-draft.json');
              await fs.writeFile(draftPath, JSON.stringify(draft, null, 2), 'utf8');

              let testCasesCreated = 0;
              if (generateSpec !== false) {
                const outOfScopePages = new Set(
                  draft.pages.filter((p) => p.outOfScope).map((p) => p.urlPath)
                );
                const testCases = draft.flows
                  .filter((f) => !f.outOfScope && !outOfScopePages.has(f.startPage))
                  .map((f) => ({
                    id: f.id.startsWith('TC-') ? f.id : `TC-${f.id}`,
                    flowId: f.id,
                    name: f.name,
                    role: f.role,
                    startPage: f.startPage,
                    steps: f.steps,
                    expectations: f.candidateExpectations || { url: { pattern: '/*' } },
                    validationRules: f.candidateValidationRules,
                  }));

                testCasesCreated = testCases.length;
                const specFile = { version: '1.0', product: draft.productId, testCases };
                await fs.writeFile(path.join(process.cwd(), 'qa.spec.json'), JSON.stringify(specFile, null, 2), 'utf8');
                await fs.writeFile(path.join(this.reportDir, 'confirmed-spec.json'), JSON.stringify(specFile, null, 2), 'utf8');
              }

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, testCasesCreated }));
            } catch (err: any) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
            return;
          }

          // 2d. POST /api/settings/keys
          if (req.method === 'POST' && pathname === '/api/settings/keys') {
            let body = '';
            for await (const chunk of req) {
              body += chunk;
            }
            try {
              const { provider, apiKey } = JSON.parse(body) as {
                provider: AIProviderType;
                apiKey: string;
              };
              const storedIn = await new KeyResolver().saveByokKey(provider, apiKey);

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, provider, storedIn }));
            } catch (err: any) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
            return;
          }

          // 3. POST /api/findings/:id/triage
          if (req.method === 'POST' && pathname.startsWith('/api/findings/') && pathname.endsWith('/triage')) {
            const parts = pathname.split('/');
            const findingId = parts[3];

            let body = '';
            for await (const chunk of req) {
              body += chunk;
            }

            try {
              const { triageStatus } = JSON.parse(body) as { triageStatus: TriageStatus };
              const findingsPath = path.join(this.reportDir, 'findings.json');
              const fileContent = await fs.readFile(findingsPath, 'utf8');
              const report: ReleaseReport = JSON.parse(fileContent);

              const finding = report.findings.find((f) => f.id === findingId);
              if (!finding) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: `Finding ${findingId} not found` }));
                return;
              }

              finding.triageStatus = triageStatus;
              await fs.writeFile(findingsPath, JSON.stringify(report, null, 2), 'utf8');

              if (triageStatus === 'Intended' || triageStatus === 'False Positive') {
                const suppressionsPath = path.join(this.reportDir, 'suppressions.json');
                let suppressions: any[] = [];
                try {
                  const sContent = await fs.readFile(suppressionsPath, 'utf8');
                  suppressions = JSON.parse(sContent);
                } catch {}

                const existingIdx = suppressions.findIndex(
                  (s: any) => s.findingTitle === finding.title && s.urlPath === finding.where.urlPath
                );
                const newRule = {
                  findingTitle: finding.title,
                  urlPath: finding.where.urlPath,
                  checker: finding.checker,
                  triageStatus,
                  dateAdded: new Date().toISOString(),
                };
                if (existingIdx >= 0) {
                  suppressions[existingIdx] = newRule;
                } else {
                  suppressions.push(newRule);
                }
                await fs.writeFile(suppressionsPath, JSON.stringify(suppressions, null, 2), 'utf8');
              }

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, findingId, triageStatus }));
            } catch (err: any) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
            return;
          }

          // 4. GET /api/evidence/*
          if (pathname.startsWith('/api/evidence/')) {
            const relPath = decodeURIComponent(pathname.replace('/api/evidence/', ''));
            // Evidence paths are stored relative to reportDir, relative to cwd, or absolute.
            // Whichever form it is, the resolved file must live inside reportDir.
            const targetFile = [path.resolve(this.reportDir, relPath), path.resolve(process.cwd(), relPath)].find(
              (candidate) => isInside(this.reportDir, candidate)
            );
            if (!targetFile) {
              res.writeHead(403, { 'Content-Type': 'text/plain' });
              res.end('Forbidden');
              return;
            }

            try {
              const stat = await fs.stat(targetFile);
              if (!stat.isFile()) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not a file');
                return;
              }

              const ext = path.extname(targetFile).toLowerCase();
              let mime = 'application/octet-stream';
              if (ext === '.png') mime = 'image/png';
              else if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
              else if (ext === '.html') mime = 'text/html; charset=utf-8';
              else if (ext === '.json') mime = 'application/json';
              else if (ext === '.webm') mime = 'video/webm';
              else if (ext === '.ts' || ext === '.js') mime = 'text/plain; charset=utf-8';

              const content = await fs.readFile(targetFile);
              res.writeHead(200, { 'Content-Type': mime });
              res.end(content);
            } catch {
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.end(`Evidence file not found: ${relPath}`);
            }
            return;
          }

          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end(`Internal Server Error: ${err.message}`);
        }
      });

      this.server.listen(this.port, this.host, () => {
        const address = `http://${this.host}:${this.port}`;
        resolve(address);
      });

      this.server.on('error', (err) => {
        reject(err);
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }
      this.server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
