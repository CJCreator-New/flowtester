import { promises as fs } from 'fs';
import type {
  RunManifestInitInput,
  RunManifestInitResponse,
  RunFinalizeInput,
  ConsolidatedReleaseReport,
} from '@qa/types';
import { OutboxQueue } from './outbox-queue.js';

export interface HubClientOptions {
  hubUrl: string; // e.g. "http://localhost:3001"
  token?: string; // product-scoped ingest token
  outboxQueue?: OutboxQueue;
}

export interface IngestRunResult {
  synced: boolean;
  queued: boolean;
  runId: string;
  error?: string;
  outboxId?: string;
  authFailed?: boolean;
}

class HubAuthError extends Error {}

export class HubIngestClient {
  public readonly hubUrl: string;
  public readonly token?: string;
  public readonly outbox: OutboxQueue;

  constructor(options: HubClientOptions) {
    this.hubUrl = options.hubUrl.replace(/\/+$/, '');
    this.token = options.token;
    this.outbox = options.outboxQueue || new OutboxQueue();
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  /**
   * Attempts full two-phase ingestion against the Hub.
   * If Hub is offline, gracefully saves to the local outbox queue.
   */
  async uploadRun(
    initPayload: RunManifestInitInput,
    finalizePayload: RunFinalizeInput,
    evidenceFiles: Array<{ localFilePath: string; clientKey: string }>
  ): Promise<IngestRunResult> {
    try {
      // 1. Phase 1: Init Run
      const initRes = await fetch(`${this.hubUrl}/api/v1/runs/init`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(initPayload),
      });

      if (!initRes.ok) {
        const message = `Hub init failed: ${initRes.status} ${await initRes.text()}`;
        if (initRes.status === 401 || initRes.status === 403) {
          throw new HubAuthError(message);
        }
        throw new Error(message);
      }

      const initData = (await initRes.json()) as RunManifestInitResponse;
      const runId = initData.runId;
      finalizePayload.runId = runId;

      // 2. Upload Evidence Binaries to Pre-Signed URLs
      const uploadedStorageKeys: string[] = [];
      for (const ev of evidenceFiles) {
        const uploadTarget = initData.uploadUrls[ev.clientKey];
        if (uploadTarget) {
          try {
            const fileData = await fs.readFile(ev.localFilePath);
            const uploadRes = await fetch(uploadTarget.uploadUrl, {
              method: 'PUT',
              body: fileData,
            });
            if (uploadRes.ok) {
              uploadedStorageKeys.push(uploadTarget.storageKey);
            }
          } catch {
            // continue with next file if one missing
          }
        }
      }
      finalizePayload.evidenceUploaded = uploadedStorageKeys;

      // 3. Phase 2: Finalize Run
      const finalizeRes = await fetch(`${this.hubUrl}/api/v1/runs/${runId}/finalize`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(finalizePayload),
      });

      if (!finalizeRes.ok) {
        const message = `Hub finalize failed: ${finalizeRes.status} ${await finalizeRes.text()}`;
        if (finalizeRes.status === 401 || finalizeRes.status === 403) {
          throw new HubAuthError(message);
        }
        throw new Error(message);
      }

      return {
        synced: true,
        queued: false,
        runId,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (err instanceof HubAuthError) {
        // Retrying won't help without a valid token - don't queue as if this were
        // a transient connectivity problem.
        return {
          synced: false,
          queued: false,
          runId: finalizePayload.runId,
          error: errorMsg,
          authFailed: true,
        };
      }

      // Fallback: enqueue into local outbox
      const entry = await this.outbox.enqueue(
        initPayload,
        finalizePayload,
        evidenceFiles,
        errorMsg
      );

      return {
        synced: false,
        queued: true,
        runId: finalizePayload.runId,
        error: errorMsg,
        outboxId: entry.id,
      };
    }
  }

  /**
   * Synchronizes all pending runs stored in the local outbox.
   */
  async syncOutbox(): Promise<{ syncedCount: number; failedCount: number }> {
    const pending = await this.outbox.getPending();
    let syncedCount = 0;
    let failedCount = 0;

    for (const entry of pending) {
      try {
        const res = await this.uploadRun(
          entry.initPayload,
          entry.finalizePayload,
          entry.evidenceFiles
        );
        if (res.synced) {
          await this.outbox.remove(entry.id);
          syncedCount++;
        } else {
          await this.outbox.recordFailure(entry.id, res.error || 'Upload unsuccessful');
          failedCount++;
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        await this.outbox.recordFailure(entry.id, errorMsg);
        failedCount++;
      }
    }

    return { syncedCount, failedCount };
  }

  /**
   * Fetches the latest consolidated report for a release.
   */
  async getConsolidatedReport(
    productId: string,
    releaseTarget: string
  ): Promise<ConsolidatedReleaseReport | null> {
    const res = await fetch(`${this.hubUrl}/api/v1/products/${productId}/releases/${releaseTarget}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as ConsolidatedReleaseReport;
  }
}
