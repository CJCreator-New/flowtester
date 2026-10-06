#!/usr/bin/env node
/**
 * Copies the built wizard into ./public, the folder Vercel serves when nothing else is configured,
 * so the deploy works whether or not Vercel reads vercel.json.
 */
import { cpSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const from = path.join(root, 'packages', 'wizard', 'dist');
const to = path.join(root, 'public');

if (!existsSync(path.join(from, 'index.html'))) {
  console.error(`The wizard was not built: ${from} has no index.html.`);
  process.exit(1);
}
rmSync(to, { recursive: true, force: true });
cpSync(from, to, { recursive: true });
console.log(`Copied the wizard build to ${to}`);
