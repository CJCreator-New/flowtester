import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { loadSiteMemory, saveSiteMemory, emptySiteMemory } from '../src/site-memory.js';

describe('site-memory-versioning (schemaVersion and safe recovery)', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'site-memory-version-test-'));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it('loads legacy site memory without schemaVersion and writes back as schemaVersion: 1', async () => {
    const host = 'legacy.example.com';
    const siteDir = path.join(tmpDir, 'sites');
    await fs.mkdir(siteDir, { recursive: true });
    const memoryFile = path.join(siteDir, `${host}.json`);

    // Write legacy file without schemaVersion
    const legacyData = {
      host,
      owner: true,
      updatedAt: '2025-01-01T00:00:00.000Z',
    };
    await fs.writeFile(memoryFile, JSON.stringify(legacyData, null, 2), 'utf8');

    // Load
    const loaded = await loadSiteMemory(tmpDir, host);
    expect(loaded).not.toBeNull();
    expect(loaded?.host).toBe(host);
    expect(loaded?.owner).toBe(true);
    expect(loaded?.schemaVersion).toBe(0);

    // Save
    await saveSiteMemory(tmpDir, loaded!);

    // Inspect file on disk
    const savedContent = JSON.parse(await fs.readFile(memoryFile, 'utf8'));
    expect(savedContent.schemaVersion).toBe(1);
    expect(savedContent.host).toBe(host);
  });

  it('loads site memory with schemaVersion: 99 and prevents overwriting it', async () => {
    const host = 'future.example.com';
    const siteDir = path.join(tmpDir, 'sites');
    await fs.mkdir(siteDir, { recursive: true });
    const memoryFile = path.join(siteDir, `${host}.json`);

    const futureData = {
      host,
      owner: true,
      schemaVersion: 99,
      futureField: 'special',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    await fs.writeFile(memoryFile, JSON.stringify(futureData, null, 2), 'utf8');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const loaded = await loadSiteMemory(tmpDir, host);
    expect(loaded).not.toBeNull();
    expect(loaded?.schemaVersion).toBe(99);

    // Attempt to overwrite
    loaded!.owner = false;
    await saveSiteMemory(tmpDir, loaded!);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('schemaVersion 99 is newer than supported 1'));

    // File on disk must remain intact and NOT overwritten
    const contentOnDisk = JSON.parse(await fs.readFile(memoryFile, 'utf8'));
    expect(contentOnDisk.owner).toBe(true);
    expect(contentOnDisk.futureField).toBe('special');
  });

  it('backs up corrupt site memory on load and does not overwrite corrupt backup on subsequent save', async () => {
    const host = 'corrupt.example.com';
    const siteDir = path.join(tmpDir, 'sites');
    await fs.mkdir(siteDir, { recursive: true });
    const memoryFile = path.join(siteDir, `${host}.json`);

    // Write corrupt JSON
    await fs.writeFile(memoryFile, '{"host": "corrupt.example.com", "incomplete": ', 'utf8');

    const loaded = await loadSiteMemory(tmpDir, host);
    expect(loaded).toBeNull();

    // Check backup was created
    const files = await fs.readdir(siteDir);
    const corruptBackup = files.find((f) => f.startsWith(`${host}.json.corrupt-`));
    expect(corruptBackup).toBeDefined();

    // Save a new site memory
    const fresh = emptySiteMemory(host);
    fresh.owner = true;
    await saveSiteMemory(tmpDir, fresh);

    // Corrupt backup must still exist intact
    const filesAfter = await fs.readdir(siteDir);
    expect(filesAfter).toContain(corruptBackup);
    const backupContent = await fs.readFile(path.join(siteDir, corruptBackup!), 'utf8');
    expect(backupContent).toBe('{"host": "corrupt.example.com", "incomplete": ');

    // The primary memory file should now be valid
    const reloaded = await loadSiteMemory(tmpDir, host);
    expect(reloaded).not.toBeNull();
    expect(reloaded?.host).toBe(host);
    expect(reloaded?.schemaVersion).toBe(1);
  });
});
