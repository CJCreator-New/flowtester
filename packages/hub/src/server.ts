import http from 'http';
import type {
  RunManifestInitInput,
  RunManifestInitResponse,
  RunFinalizeInput,
  FindingLifecycleStatus,
  CompetitiveBenchmark,
} from '@qa/types';
import { IHubDatabase, MemoryHubDatabase, HubRunRecord } from './storage/db.js';
import { IObjectStorage, LocalObjectStorage } from './storage/object-storage.js';
import { DeduplicationEngine } from './deduplicator.js';
import { renderHubDashboardHtml, renderBenchmarkHtml } from './ui.js';


export interface HubServerOptions {
  port?: number;
  host?: string;
  db?: IHubDatabase;
  storage?: IObjectStorage;
}

export class HubServer {
  private server: http.Server | null = null;
  public readonly port: number;
  public readonly host: string;
  public readonly db: IHubDatabase;
  public readonly storage: IObjectStorage;
  public readonly deduplicator: DeduplicationEngine;

  constructor(options: HubServerOptions = {}) {
    this.port = options.port || 4000;
    this.host = options.host || 'localhost';
    this.db = options.db || new MemoryHubDatabase();
    this.storage = options.storage || new LocalObjectStorage(undefined, `http://${this.host}:${this.port}`);
    this.deduplicator = new DeduplicationEngine(this.db);
  }

  public async start(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        try {
          const url = new URL(req.url || '/', `http://${this.host}:${this.port}`);
          const pathname = url.pathname;

          // CORS headers
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

          if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
          }

          // 1. Hub Dashboard UI
          if ((pathname === '/' || pathname === '/hub') && req.method === 'GET') {
            const productId = url.searchParams.get('product') || 'product-a';
            const releaseTarget = url.searchParams.get('release') || 'latest';
            const report = await this.db.getConsolidatedReport(productId, releaseTarget);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(renderHubDashboardHtml(report));
            return;
          }

          // 1b. Benchmark Comparison UI
          if (pathname === '/compare' && req.method === 'GET') {
            const id = url.searchParams.get('id');
            const benchmark = id ? await this.db.getBenchmark(id) : null;
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(renderBenchmarkHtml(benchmark));
            return;
          }


          // 2. Health check
          if (pathname === '/api/v1/health' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString() }));
            return;
          }

          // 3. POST /api/v1/runs/init
          if (pathname === '/api/v1/runs/init' && req.method === 'POST') {
            const body = await this.readJsonBody<RunManifestInitInput>(req);
            const authHeader = req.headers['authorization'];
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
              res.writeHead(401, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Missing or malformed Authorization header (expected: Bearer <token>)' }));
              return;
            }
            const token = authHeader.substring(7);
            const validToken = await this.db.validateToken(token);
            if (!validToken) {
              res.writeHead(401, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid or unrecognized ingest token' }));
              return;
            }
            if (validToken.productId !== body.productId) {
              res.writeHead(403, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Token not authorized for this productId' }));
              return;
            }

            const release = await this.db.getOrCreateRelease(body.productId, body.releaseTarget);
            const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

            const runRecord: HubRunRecord = {
              id: runId,
              releaseId: release.id,
              productId: body.productId,
              developerId: body.developerId,
              machineId: body.machineId,
              commitHash: body.commitHash,
              durationMs: 0,
              createdAt: new Date().toISOString(),
              status: 'pending',
            };
            await this.db.createRun(runRecord);

            const uploadUrls: Record<string, { uploadUrl: string; storageKey: string }> = {};
            for (const item of body.evidenceItems) {
              const preSigned = await this.storage.generatePreSignedUploadUrl(
                runId,
                item.clientKey,
                item.mimeType
              );
              uploadUrls[item.clientKey] = preSigned;
            }

            const response: RunManifestInitResponse = {
              runId,
              uploadUrls,
            };

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response));
            return;
          }

          // 4. PUT /api/v1/evidence/upload
          if (pathname === '/api/v1/evidence/upload' && req.method === 'PUT') {
            const storageKey = url.searchParams.get('key');
            if (!storageKey) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Missing key parameter' }));
              return;
            }

            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(Buffer.from(chunk));
            }
            const buffer = Buffer.concat(chunks);
            await this.storage.saveObject(storageKey, buffer);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, storageKey }));
            return;
          }

          // 5. POST /api/v1/runs/:id/finalize
          const finalizeMatch = pathname.match(/^\/api\/v1\/runs\/([^/]+)\/finalize$/);
          if (finalizeMatch && req.method === 'POST') {
            const runId = finalizeMatch[1];
            const run = await this.db.getRun(runId);
            if (!run) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Run not found' }));
              return;
            }

            const body = await this.readJsonBody<RunFinalizeInput>(req);
            const release = (await this.db.getRelease(run.productId, run.releaseId.replace(`rel_${run.productId}_`, ''))) || {
              id: run.releaseId,
              productId: run.productId,
              targetName: 'latest',
              createdAt: new Date().toISOString(),
              status: 'active' as const,
            };

            const dedupeResults = await this.deduplicator.processRunFinalization(
              release,
              run.productId,
              body
            );

            await this.db.updateRunStatus(runId, 'completed', body.durationMs);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, ...dedupeResults }));
            return;
          }

          // 6. GET /api/v1/products/:productId/releases/:releaseTarget
          const releaseReportMatch = pathname.match(/^\/api\/v1\/products\/([^/]+)\/releases\/([^/]+)$/);
          if (releaseReportMatch && req.method === 'GET') {
            const productId = releaseReportMatch[1];
            const releaseTarget = releaseReportMatch[2];
            const report = await this.db.getConsolidatedReport(productId, releaseTarget);
            if (!report) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Release not found' }));
              return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(report));
            return;
          }

          // 7. PATCH /api/v1/findings/:id/triage
          const triageMatch = pathname.match(/^\/api\/v1\/findings\/([^/]+)\/triage$/);
          if (triageMatch && req.method === 'PATCH') {
            const findingId = triageMatch[1];
            const body = await this.readJsonBody<{ status: FindingLifecycleStatus }>(req);
            const updated = await this.db.updateFindingStatus(findingId, body.status);
            if (!updated) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Finding not found' }));
              return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, finding: updated }));
            return;
          }

          // 8. POST /api/v1/benchmarks
          if (pathname === '/api/v1/benchmarks' && req.method === 'POST') {
            const body = await this.readJsonBody<CompetitiveBenchmark>(req);
            await this.db.saveBenchmark(body);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, id: body.id }));
            return;
          }

          // 9. GET /api/v1/benchmarks/:id
          const benchmarkMatch = pathname.match(/^\/api\/v1\/benchmarks\/([^/]+)$/);
          if (benchmarkMatch && req.method === 'GET') {
            const id = benchmarkMatch[1];
            const benchmark = await this.db.getBenchmark(id);
            if (!benchmark) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Benchmark not found' }));
              return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(benchmark));
            return;
          }


          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not found' }));
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: errorMsg }));
        }
      });

      this.server.listen(this.port, this.host, () => {
        resolve(`http://${this.host}:${this.port}`);
      });
      this.server.on('error', reject);
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  private async readJsonBody<T>(req: http.IncomingMessage): Promise<T> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk));
    }
    const raw = Buffer.concat(chunks).toString('utf-8');
    return JSON.parse(raw) as T;
  }
}
