import { promises as fs } from 'fs';
import path from 'path';
import type { OutboxQueueEntry, RunManifestInitInput, RunFinalizeInput } from '@qa/types';

export class OutboxQueue {
  private queueFilePath: string;

  constructor(cacheDir?: string) {
    const dir = path.resolve(cacheDir || path.join(process.cwd(), '.qa-cache'));
    this.queueFilePath = path.join(dir, 'outbox.json');
  }

  private async loadEntries(): Promise<OutboxQueueEntry[]> {
    try {
      const data = await fs.readFile(this.queueFilePath, 'utf-8');
      return JSON.parse(data) as OutboxQueueEntry[];
    } catch {
      return [];
    }
  }

  private async saveEntries(entries: OutboxQueueEntry[]): Promise<void> {
    await fs.mkdir(path.dirname(this.queueFilePath), { recursive: true });
    await fs.writeFile(this.queueFilePath, JSON.stringify(entries, null, 2), 'utf-8');
  }

  /**
   * Enqueues an un-synced run when the Hub server is offline.
   */
  async enqueue(
    initPayload: RunManifestInitInput,
    finalizePayload: RunFinalizeInput,
    evidenceFiles: Array<{ localFilePath: string; clientKey: string }>,
    error?: string
  ): Promise<OutboxQueueEntry> {
    const entries = await this.loadEntries();
    const entry: OutboxQueueEntry = {
      id: `outbox_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      runId: finalizePayload.runId,
      initPayload,
      finalizePayload,
      evidenceFiles,
      createdAt: new Date().toISOString(),
      retryAttempts: 0,
      error,
    };

    entries.push(entry);
    await this.saveEntries(entries);
    return entry;
  }

  /**
   * Returns all pending runs awaiting sync.
   */
  async getPending(): Promise<OutboxQueueEntry[]> {
    return this.loadEntries();
  }

  /**
   * Removes a successfully uploaded entry from the outbox.
   */
  async remove(id: string): Promise<void> {
    const entries = await this.loadEntries();
    const filtered = entries.filter((e) => e.id !== id);
    await this.saveEntries(filtered);
  }

  /**
   * Updates an entry with attempt counter and error message.
   */
  async recordFailure(id: string, error: string): Promise<void> {
    const entries = await this.loadEntries();
    const entry = entries.find((e) => e.id === id);
    if (entry) {
      entry.retryAttempts += 1;
      entry.lastAttemptAt = new Date().toISOString();
      entry.error = error;
      await this.saveEntries(entries);
    }
  }

  /**
   * Clears all entries from the outbox.
   */
  async clear(): Promise<void> {
    try {
      await fs.unlink(this.queueFilePath);
    } catch {
      // file might not exist
    }
  }
}
