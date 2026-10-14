import { promises as fs } from 'fs';
import path from 'path';

export interface SafeReadResult<T = unknown> {
  data: T | null;
  corrupt?: boolean;
  readOnly?: boolean;
  version?: number;
}

/**
 * Atomically writes a JSON value to disk:
 * Writes to a temporary file in the same directory, then renames over the target path.
 * Cleans up temp file on failure.
 */
export async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmpFile = `${filePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    await fs.writeFile(tmpFile, JSON.stringify(value, null, 2), 'utf8');
    await fs.rename(tmpFile, filePath);
  } catch (err) {
    await fs.rm(tmpFile, { force: true }).catch(() => {});
    throw err;
  }
}

/**
 * Safely reads a JSON file from disk:
 * - If file does not exist, returns { data: null }
 * - If file is invalid JSON (corrupted / truncated), copies it to `<filePath>.corrupt-<timestamp>` and returns { data: null, corrupt: true }
 * - Checks `schemaVersion`: if version > currentVersion, marks readOnly: true
 */
export async function readJsonSafe<T = any>(
  filePath: string,
  options?: {
    currentVersion?: number;
    logWarning?: (msg: string) => void;
  }
): Promise<SafeReadResult<T>> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return { data: null };
    }
    throw err;
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Corrupt file: copy aside so evidence is not lost
    const corruptPath = `${filePath}.corrupt-${Date.now()}`;
    await fs.copyFile(filePath, corruptPath).catch(() => {});
    options?.logWarning?.(`Corrupted JSON file ${filePath} backed up to ${corruptPath}`);
    return { data: null, corrupt: true };
  }

  const currentVersion = options?.currentVersion ?? 1;
  const version = typeof parsed?.schemaVersion === 'number' ? parsed.schemaVersion : 0;
  if (version > currentVersion) {
    options?.logWarning?.(
      `File ${filePath} has schemaVersion ${version} (newer than supported ${currentVersion}); loaded read-only.`
    );
    return { data: parsed as T, readOnly: true, version };
  }

  return { data: parsed as T, readOnly: false, version };
}
