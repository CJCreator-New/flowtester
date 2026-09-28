import { promises as fs } from 'fs';
import path from 'path';
import type { ReleaseReport } from '@qa/types';
import { HubIngestClient } from './hub-client.js';

export interface PushRunToHubOptions {
  hubUrl: string;
  hubToken?: string;
  outputDir: string;
  releaseTarget?: string;
  developerId?: string;
}

export interface PushRunToHubResult {
  synced: boolean;
  queued?: boolean;
  outboxId?: string;
  authFailed?: boolean;
  error?: string;
  hubViewUrl?: string;
}

/**
 * Uploads a completed run (report + its evidence files) to a Report Hub instance.
 * Extracted from the CLI's `run` command so both the CLI and the interactive
 * runner service share one implementation instead of duplicating the upload logic.
 */
export async function pushRunToHub(
  report: ReleaseReport,
  opts: PushRunToHubOptions
): Promise<PushRunToHubResult> {
  const hubClient = new HubIngestClient({
    hubUrl: opts.hubUrl,
    token: opts.hubToken,
  });

  const evidenceDir = path.join(opts.outputDir, 'evidence');
  // Evidence is nested per test point (`evidence/<testCaseId>-<breakpoint>/...`), so walk recursively.
  const evidenceFiles: Array<{ localFilePath: string; clientKey: string; size: number }> = [];
  try {
    const entries = await fs.readdir(evidenceDir, { recursive: true });
    for (const rel of entries) {
      const localFilePath = path.join(evidenceDir, rel);
      const stat = await fs.stat(localFilePath);
      if (!stat.isFile()) continue;
      evidenceFiles.push({ localFilePath, clientKey: rel.replace(/\\/g, '/'), size: stat.size });
    }
  } catch {
    // evidence dir might not exist
  }

  const initPayload = {
    productId: report.productId,
    releaseTarget: opts.releaseTarget || 'latest',
    developerId: opts.developerId || process.env.USER || process.env.USERNAME || 'developer',
    evidenceItems: evidenceFiles.map((ef) => ({
      clientKey: ef.clientKey,
      fileType: (ef.clientKey.endsWith('.png')
        ? 'screenshot'
        : ef.clientKey.endsWith('.webm')
        ? 'video'
        : 'log') as 'screenshot' | 'video' | 'log',
      mimeType: ef.clientKey.endsWith('.png')
        ? 'image/png'
        : ef.clientKey.endsWith('.webm')
        ? 'video/webm'
        : 'application/octet-stream',
      fileSize: ef.size,
    })),
  };

  const finalizePayload = {
    runId: report.runId,
    durationMs: report.durationMs,
    coverage: report.coverage,
    testPoints: report.results,
    findings: report.findings,
    evidenceUploaded: [],
  };

  const uploadRes = await hubClient.uploadRun(initPayload, finalizePayload, evidenceFiles);

  return {
    synced: uploadRes.synced,
    queued: uploadRes.queued,
    outboxId: uploadRes.outboxId,
    authFailed: uploadRes.authFailed,
    error: uploadRes.error,
    hubViewUrl: uploadRes.synced
      ? `${opts.hubUrl.replace(/\/+$/, '')}/hub?product=${report.productId}&release=${opts.releaseTarget || 'latest'}`
      : undefined,
  };
}
