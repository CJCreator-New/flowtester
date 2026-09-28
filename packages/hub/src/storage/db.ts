import type {
  ProductProfile,
  CanonicalFinding,
  FindingLifecycleStatus,
  ConsolidatedReleaseReport,
  CompetitiveBenchmark,
} from '@qa/types';
import pg from 'pg';
const { Pool } = pg;



export interface HubProduct {
  id: string;
  name: string;
  createdAt: string;
  profile?: ProductProfile;
}

export interface HubProductToken {
  token: string;
  productId: string;
  label: string;
  createdAt: string;
}

export interface HubRelease {
  id: string;
  productId: string;
  targetName: string;
  createdAt: string;
  status: 'active' | 'gated' | 'released';
}

export interface HubRunRecord {
  id: string;
  releaseId: string;
  productId: string;
  developerId?: string;
  machineId?: string;
  commitHash?: string;
  durationMs: number;
  createdAt: string;
  status: 'pending' | 'completed';
}

export interface HubEvidenceRecord {
  id: string;
  runId: string;
  storageKey: string;
  fileType: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
}

export interface IHubDatabase {
  // Products & Tokens
  createProduct(product: HubProduct): Promise<void>;
  getProduct(id: string): Promise<HubProduct | null>;
  listProducts(): Promise<HubProduct[]>;
  saveProductProfile(productId: string, profile: ProductProfile): Promise<void>;
  createToken(token: HubProductToken): Promise<void>;
  validateToken(token: string): Promise<HubProductToken | null>;

  // Releases
  getOrCreateRelease(productId: string, targetName: string): Promise<HubRelease>;
  getRelease(productId: string, targetName: string): Promise<HubRelease | null>;

  // Runs
  createRun(run: HubRunRecord): Promise<void>;
  getRun(runId: string): Promise<HubRunRecord | null>;
  updateRunStatus(runId: string, status: 'pending' | 'completed', durationMs?: number): Promise<void>;
  listRunsForRelease(releaseId: string): Promise<HubRunRecord[]>;

  // Evidence
  saveEvidenceItem(item: HubEvidenceRecord): Promise<void>;
  listEvidenceForRun(runId: string): Promise<HubEvidenceRecord[]>;

  // Canonical Findings
  getCanonicalFindingByFingerprint(releaseId: string, fingerprint: string): Promise<CanonicalFinding | null>;
  getCanonicalFindingById(id: string): Promise<CanonicalFinding | null>;
  saveCanonicalFinding(finding: CanonicalFinding): Promise<void>;
  listCanonicalFindings(releaseId: string): Promise<CanonicalFinding[]>;
  updateFindingStatus(id: string, status: FindingLifecycleStatus): Promise<CanonicalFinding | null>;

  // Consolidated Reporting
  getConsolidatedReport(productId: string, targetName: string): Promise<ConsolidatedReleaseReport | null>;

  // Competitive Benchmarks
  saveBenchmark(benchmark: CompetitiveBenchmark): Promise<void>;
  getBenchmark(id: string): Promise<CompetitiveBenchmark | null>;
  listBenchmarks(): Promise<CompetitiveBenchmark[]>;
}

export class MemoryHubDatabase implements IHubDatabase {
  private products = new Map<string, HubProduct>();
  private tokens = new Map<string, HubProductToken>();
  private releases = new Map<string, HubRelease>(); // key: `${productId}:${targetName}`
  private runs = new Map<string, HubRunRecord>();
  private evidence = new Map<string, HubEvidenceRecord>();
  private canonicalFindings = new Map<string, CanonicalFinding>(); // key: id
  private benchmarks = new Map<string, CompetitiveBenchmark>();


  async createProduct(product: HubProduct): Promise<void> {
    this.products.set(product.id, { ...product });
  }

  async getProduct(id: string): Promise<HubProduct | null> {
    return this.products.get(id) || null;
  }

  async listProducts(): Promise<HubProduct[]> {
    return Array.from(this.products.values());
  }

  async saveProductProfile(productId: string, profile: ProductProfile): Promise<void> {
    const existing = this.products.get(productId);
    if (existing) {
      existing.profile = profile;
    } else {
      this.products.set(productId, {
        id: productId,
        name: profile.name || productId,
        createdAt: new Date().toISOString(),
        profile,
      });
    }
  }

  async createToken(token: HubProductToken): Promise<void> {
    this.tokens.set(token.token, { ...token });
  }

  async validateToken(token: string): Promise<HubProductToken | null> {
    return this.tokens.get(token) || null;
  }

  async getOrCreateRelease(productId: string, targetName: string): Promise<HubRelease> {
    const key = `${productId}:${targetName}`;
    let release = this.releases.get(key);
    if (!release) {
      release = {
        id: `rel_${productId}_${targetName.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
        productId,
        targetName,
        createdAt: new Date().toISOString(),
        status: 'active',
      };
      this.releases.set(key, release);
    }
    return release;
  }

  async getRelease(productId: string, targetName: string): Promise<HubRelease | null> {
    return this.releases.get(`${productId}:${targetName}`) || null;
  }

  async createRun(run: HubRunRecord): Promise<void> {
    this.runs.set(run.id, { ...run });
  }

  async getRun(runId: string): Promise<HubRunRecord | null> {
    return this.runs.get(runId) || null;
  }

  async updateRunStatus(runId: string, status: 'pending' | 'completed', durationMs?: number): Promise<void> {
    const run = this.runs.get(runId);
    if (run) {
      run.status = status;
      if (durationMs !== undefined) {
        run.durationMs = durationMs;
      }
    }
  }

  async listRunsForRelease(releaseId: string): Promise<HubRunRecord[]> {
    return Array.from(this.runs.values()).filter((r) => r.releaseId === releaseId);
  }

  async saveEvidenceItem(item: HubEvidenceRecord): Promise<void> {
    this.evidence.set(item.id, { ...item });
  }

  async listEvidenceForRun(runId: string): Promise<HubEvidenceRecord[]> {
    return Array.from(this.evidence.values()).filter((e) => e.runId === runId);
  }

  async getCanonicalFindingByFingerprint(releaseId: string, fingerprint: string): Promise<CanonicalFinding | null> {
    for (const finding of this.canonicalFindings.values()) {
      if (finding.releaseTarget === releaseId && finding.fingerprint === fingerprint) {
        return finding;
      }
    }
    return null;
  }

  async getCanonicalFindingById(id: string): Promise<CanonicalFinding | null> {
    return this.canonicalFindings.get(id) || null;
  }

  async saveCanonicalFinding(finding: CanonicalFinding): Promise<void> {
    this.canonicalFindings.set(finding.id, { ...finding });
  }

  async listCanonicalFindings(releaseId: string): Promise<CanonicalFinding[]> {
    return Array.from(this.canonicalFindings.values()).filter((f) => f.releaseTarget === releaseId);
  }

  async updateFindingStatus(id: string, status: FindingLifecycleStatus): Promise<CanonicalFinding | null> {
    const finding = this.canonicalFindings.get(id);
    if (finding) {
      finding.status = status;
      finding.lastSeenAt = new Date().toISOString();
      return finding;
    }
    return null;
  }

  async getConsolidatedReport(productId: string, targetName: string): Promise<ConsolidatedReleaseReport | null> {
    const release = await this.getRelease(productId, targetName);
    if (!release) {
      return null;
    }

    const findings = await this.listCanonicalFindings(release.id);
    const runs = await this.listRunsForRelease(release.id);

    const summary = {
      totalFindings: findings.length,
      open: findings.filter((f) => f.status === 'OPEN').length,
      verifiedFixed: findings.filter((f) => f.status === 'VERIFIED_FIXED').length,
      regressed: findings.filter((f) => f.status === 'REGRESSED').length,
      acceptedRisk: findings.filter((f) => f.status === 'ACCEPTED_RISK').length,
      flakyFlowsCount: 0,
    };

    return {
      productId,
      releaseTarget: targetName,
      lastConsolidatedAt: new Date().toISOString(),
      totalRuns: runs.length,
      summary,
      canonicalFindings: findings,
    };
  }

  async saveBenchmark(benchmark: CompetitiveBenchmark): Promise<void> {
    this.benchmarks.set(benchmark.id, { ...benchmark });
  }

  async getBenchmark(id: string): Promise<CompetitiveBenchmark | null> {
    return this.benchmarks.get(id) || null;
  }

  async listBenchmarks(): Promise<CompetitiveBenchmark[]> {
    return Array.from(this.benchmarks.values());
  }
}

export class PostgresHubDatabase implements IHubDatabase {
  private pool: pg.Pool;
  private initialized = false;

  constructor(connectionStringOrPool: string | pg.Pool) {
    if (typeof connectionStringOrPool === 'string') {
      this.pool = new Pool({ connectionString: connectionStringOrPool });
    } else {
      this.pool = connectionStringOrPool;
    }
  }

  private async ensureSchema(): Promise<void> {
    if (this.initialized) return;

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        profile JSONB
      );

      CREATE TABLE IF NOT EXISTS product_tokens (
        token TEXT PRIMARY KEY,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS releases (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        target_name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        status TEXT NOT NULL DEFAULT 'active',
        UNIQUE(product_id, target_name)
      );

      CREATE TABLE IF NOT EXISTS test_runs (
        id TEXT PRIMARY KEY,
        release_id TEXT NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        developer_id TEXT,
        machine_id TEXT,
        commit_hash TEXT,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS evidence_artifacts (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
        storage_key TEXT NOT NULL,
        file_type TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS canonical_findings (
        id TEXT PRIMARY KEY,
        release_id TEXT NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
        fingerprint TEXT NOT NULL,
        title TEXT NOT NULL,
        severity TEXT NOT NULL,
        category TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'OPEN',
        occurrences_count INTEGER NOT NULL DEFAULT 1,
        first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        data JSONB NOT NULL,
        UNIQUE(release_id, fingerprint)
      );

      CREATE TABLE IF NOT EXISTS benchmark_records (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_releases_product ON releases(product_id);
      CREATE INDEX IF NOT EXISTS idx_runs_release ON test_runs(release_id);
      CREATE INDEX IF NOT EXISTS idx_findings_release ON canonical_findings(release_id);
      CREATE INDEX IF NOT EXISTS idx_findings_severity ON canonical_findings(severity);
    `);

    this.initialized = true;
  }

  async createProduct(product: HubProduct): Promise<void> {
    await this.ensureSchema();
    await this.pool.query(
      `INSERT INTO products (id, name, created_at, profile)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET name = $2, profile = $4`,
      [product.id, product.name, product.createdAt || new Date().toISOString(), product.profile ? JSON.stringify(product.profile) : null]
    );
  }

  async getProduct(id: string): Promise<HubProduct | null> {
    await this.ensureSchema();
    const res = await this.pool.query(`SELECT id, name, created_at as "createdAt", profile FROM products WHERE id = $1`, [id]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      name: row.name,
      createdAt: new Date(row.createdAt).toISOString(),
      profile: row.profile || undefined,
    };
  }

  async listProducts(): Promise<HubProduct[]> {
    await this.ensureSchema();
    const res = await this.pool.query(`SELECT id, name, created_at as "createdAt", profile FROM products ORDER BY name ASC`);
    return res.rows.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: new Date(row.createdAt).toISOString(),
      profile: row.profile || undefined,
    }));
  }

  async saveProductProfile(productId: string, profile: ProductProfile): Promise<void> {
    await this.ensureSchema();
    await this.pool.query(
      `INSERT INTO products (id, name, created_at, profile)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (id) DO UPDATE SET profile = $3`,
      [productId, profile.name || productId, JSON.stringify(profile)]
    );
  }

  async createToken(token: HubProductToken): Promise<void> {
    await this.ensureSchema();
    await this.pool.query(
      `INSERT INTO product_tokens (token, product_id, label, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (token) DO UPDATE SET label = $3`,
      [token.token, token.productId, token.label, token.createdAt || new Date().toISOString()]
    );
  }

  async validateToken(token: string): Promise<HubProductToken | null> {
    await this.ensureSchema();
    const res = await this.pool.query(
      `SELECT token, product_id as "productId", label, created_at as "createdAt" FROM product_tokens WHERE token = $1`,
      [token]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      token: row.token,
      productId: row.productId,
      label: row.label,
      createdAt: new Date(row.createdAt).toISOString(),
    };
  }

  async getOrCreateRelease(productId: string, targetName: string): Promise<HubRelease> {
    await this.ensureSchema();
    const existing = await this.getRelease(productId, targetName);
    if (existing) return existing;

    const id = `rel_${productId}_${targetName.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const createdAt = new Date().toISOString();
    await this.pool.query(
      `INSERT INTO releases (id, product_id, target_name, created_at, status)
       VALUES ($1, $2, $3, $4, 'active')
       ON CONFLICT (product_id, target_name) DO NOTHING`,
      [id, productId, targetName, createdAt]
    );
    return (await this.getRelease(productId, targetName))!;
  }

  async getRelease(productId: string, targetName: string): Promise<HubRelease | null> {
    await this.ensureSchema();
    const res = await this.pool.query(
      `SELECT id, product_id as "productId", target_name as "targetName", created_at as "createdAt", status
       FROM releases WHERE product_id = $1 AND target_name = $2`,
      [productId, targetName]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      productId: row.productId,
      targetName: row.targetName,
      createdAt: new Date(row.createdAt).toISOString(),
      status: row.status,
    };
  }

  async createRun(run: HubRunRecord): Promise<void> {
    await this.ensureSchema();
    await this.pool.query(
      `INSERT INTO test_runs (id, release_id, product_id, developer_id, machine_id, commit_hash, duration_ms, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET status = $8, duration_ms = $7`,
      [
        run.id,
        run.releaseId,
        run.productId,
        run.developerId || null,
        run.machineId || null,
        run.commitHash || null,
        run.durationMs || 0,
        run.status,
        run.createdAt || new Date().toISOString(),
      ]
    );
  }

  async getRun(runId: string): Promise<HubRunRecord | null> {
    await this.ensureSchema();
    const res = await this.pool.query(
      `SELECT id, release_id as "releaseId", product_id as "productId", developer_id as "developerId",
              machine_id as "machineId", commit_hash as "commitHash", duration_ms as "durationMs",
              status, created_at as "createdAt"
       FROM test_runs WHERE id = $1`,
      [runId]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      releaseId: row.releaseId,
      productId: row.productId,
      developerId: row.developerId || undefined,
      machineId: row.machineId || undefined,
      commitHash: row.commitHash || undefined,
      durationMs: row.durationMs,
      status: row.status,
      createdAt: new Date(row.createdAt).toISOString(),
    };
  }

  async updateRunStatus(runId: string, status: 'pending' | 'completed', durationMs?: number): Promise<void> {
    await this.ensureSchema();
    if (durationMs !== undefined) {
      await this.pool.query(`UPDATE test_runs SET status = $1, duration_ms = $2 WHERE id = $3`, [status, durationMs, runId]);
    } else {
      await this.pool.query(`UPDATE test_runs SET status = $1 WHERE id = $2`, [status, runId]);
    }
  }

  async listRunsForRelease(releaseId: string): Promise<HubRunRecord[]> {
    await this.ensureSchema();
    const res = await this.pool.query(
      `SELECT id, release_id as "releaseId", product_id as "productId", developer_id as "developerId",
              machine_id as "machineId", commit_hash as "commitHash", duration_ms as "durationMs",
              status, created_at as "createdAt"
       FROM test_runs WHERE release_id = $1 ORDER BY created_at DESC`,
      [releaseId]
    );
    return res.rows.map((row) => ({
      id: row.id,
      releaseId: row.releaseId,
      productId: row.productId,
      developerId: row.developerId || undefined,
      machineId: row.machineId || undefined,
      commitHash: row.commitHash || undefined,
      durationMs: row.durationMs,
      status: row.status,
      createdAt: new Date(row.createdAt).toISOString(),
    }));
  }

  async saveEvidenceItem(item: HubEvidenceRecord): Promise<void> {
    await this.ensureSchema();
    await this.pool.query(
      `INSERT INTO evidence_artifacts (id, run_id, storage_key, file_type, mime_type, file_size, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING`,
      [item.id, item.runId, item.storageKey, item.fileType, item.mimeType, item.fileSize, item.createdAt || new Date().toISOString()]
    );
  }

  async listEvidenceForRun(runId: string): Promise<HubEvidenceRecord[]> {
    await this.ensureSchema();
    const res = await this.pool.query(
      `SELECT id, run_id as "runId", storage_key as "storageKey", file_type as "fileType",
              mime_type as "mimeType", file_size as "fileSize", created_at as "createdAt"
       FROM evidence_artifacts WHERE run_id = $1`,
      [runId]
    );
    return res.rows.map((row) => ({
      id: row.id,
      runId: row.runId,
      storageKey: row.storageKey,
      fileType: row.fileType,
      mimeType: row.mimeType,
      fileSize: row.fileSize,
      createdAt: new Date(row.createdAt).toISOString(),
    }));
  }

  async getCanonicalFindingByFingerprint(releaseId: string, fingerprint: string): Promise<CanonicalFinding | null> {
    await this.ensureSchema();
    const res = await this.pool.query(
      `SELECT data FROM canonical_findings WHERE release_id = $1 AND fingerprint = $2`,
      [releaseId, fingerprint]
    );
    if (res.rows.length === 0) return null;
    return res.rows[0].data as CanonicalFinding;
  }

  async getCanonicalFindingById(id: string): Promise<CanonicalFinding | null> {
    await this.ensureSchema();
    const res = await this.pool.query(`SELECT data FROM canonical_findings WHERE id = $1`, [id]);
    if (res.rows.length === 0) return null;
    return res.rows[0].data as CanonicalFinding;
  }

  async saveCanonicalFinding(finding: CanonicalFinding): Promise<void> {
    await this.ensureSchema();
    await this.pool.query(
      `INSERT INTO canonical_findings (id, release_id, fingerprint, title, severity, category, status, occurrences_count, first_seen_at, last_seen_at, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         occurrences_count = $8,
         last_seen_at = $10,
         status = $7,
         data = $11`,
      [
        finding.id,
        finding.releaseTarget,
        finding.fingerprint,
        finding.title,
        finding.severity,
        finding.checker,
        finding.status,
        finding.occurrenceCount || 1,
        finding.firstSeenAt || new Date().toISOString(),
        finding.lastSeenAt || new Date().toISOString(),
        JSON.stringify(finding),
      ]
    );
  }

  async listCanonicalFindings(releaseId: string): Promise<CanonicalFinding[]> {
    await this.ensureSchema();
    const res = await this.pool.query(
      `SELECT data FROM canonical_findings WHERE release_id = $1 ORDER BY last_seen_at DESC`,
      [releaseId]
    );
    return res.rows.map((row) => row.data as CanonicalFinding);
  }

  async updateFindingStatus(id: string, status: FindingLifecycleStatus): Promise<CanonicalFinding | null> {
    await this.ensureSchema();
    const existing = await this.getCanonicalFindingById(id);
    if (!existing) return null;

    existing.status = status;
    existing.lastSeenAt = new Date().toISOString();

    await this.pool.query(
      `UPDATE canonical_findings
       SET status = $1, last_seen_at = $2, data = $3
       WHERE id = $4`,
      [status, existing.lastSeenAt, JSON.stringify(existing), id]
    );
    return existing;
  }

  async getConsolidatedReport(productId: string, targetName: string): Promise<ConsolidatedReleaseReport | null> {
    await this.ensureSchema();
    const release = await this.getRelease(productId, targetName);
    if (!release) return null;

    const findings = await this.listCanonicalFindings(release.id);
    const runs = await this.listRunsForRelease(release.id);

    const summary = {
      totalFindings: findings.length,
      open: findings.filter((f) => f.status === 'OPEN').length,
      verifiedFixed: findings.filter((f) => f.status === 'VERIFIED_FIXED').length,
      regressed: findings.filter((f) => f.status === 'REGRESSED').length,
      acceptedRisk: findings.filter((f) => f.status === 'ACCEPTED_RISK').length,
      flakyFlowsCount: 0,
    };

    return {
      productId,
      releaseTarget: targetName,
      lastConsolidatedAt: new Date().toISOString(),
      totalRuns: runs.length,
      summary,
      canonicalFindings: findings,
    };
  }

  async saveBenchmark(benchmark: CompetitiveBenchmark): Promise<void> {
    await this.ensureSchema();
    const name = benchmark.ourProduct?.name || benchmark.flowId || benchmark.id;
    await this.pool.query(
      `INSERT INTO benchmark_records (id, name, data, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (id) DO UPDATE SET name = $2, data = $3`,
      [benchmark.id, name, JSON.stringify(benchmark)]
    );
  }

  async getBenchmark(id: string): Promise<CompetitiveBenchmark | null> {
    await this.ensureSchema();
    const res = await this.pool.query(`SELECT data FROM benchmark_records WHERE id = $1`, [id]);
    if (res.rows.length === 0) return null;
    return res.rows[0].data as CompetitiveBenchmark;
  }

  async listBenchmarks(): Promise<CompetitiveBenchmark[]> {
    await this.ensureSchema();
    const res = await this.pool.query(`SELECT data FROM benchmark_records ORDER BY created_at DESC`);
    return res.rows.map((row) => row.data as CompetitiveBenchmark);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export function createDatabaseFromEnv(): IHubDatabase {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
    return new PostgresHubDatabase(process.env.DATABASE_URL);
  }
  return new MemoryHubDatabase();
}

