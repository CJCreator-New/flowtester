import type { SignInEntry } from './form';

/**
 * "Import roles": turns a `role,username,password` list that the person typed, pasted or picked
 * into sign-in rows. Pure and form-state only: nothing is saved, logged or sent, and messages
 * name line numbers, never values. There is no detection of seed files.
 */

export const MAX_IMPORTED_ROLES = 10;

export interface ImportedRole {
  role: string;
  username: string;
  password: string;
}

export interface ImportRolesResult {
  roles: ImportedRole[];
  /** Plain sentences about lines that were skipped (line numbers only). */
  skipped: string[];
}

const HEADER = /^role\s*[,\t;]\s*(user(name)?|email)\b/i;

export function parseRoleList(text: string): ImportRolesResult {
  const roles: ImportedRole[] = [];
  const skipped: string[] = [];
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#') || HEADER.test(line)) return;
    const sep = line.includes('\t') ? '\t' : ',';
    const first = line.indexOf(sep);
    const second = first < 0 ? -1 : line.indexOf(sep, first + 1);
    if (first < 0 || second < 0) {
      skipped.push(`Line ${i + 1} skipped: expected role, username, password.`);
      return;
    }
    const role = line.slice(0, first).trim();
    const username = line.slice(first + 1, second).trim();
    // The rest of the line is the password, so a password may contain commas.
    const password = line.slice(second + 1).trim();
    if (!role || !username || !password) {
      skipped.push(`Line ${i + 1} skipped: role, username and password are all needed.`);
      return;
    }
    if (roles.some((r) => r.role.toLowerCase() === role.toLowerCase())) {
      skipped.push(`Line ${i + 1} skipped: the role “${role}” is already listed.`);
      return;
    }
    if (roles.length >= MAX_IMPORTED_ROLES) {
      skipped.push(`Line ${i + 1} skipped: up to ${MAX_IMPORTED_ROLES} roles can be imported.`);
      return;
    }
    roles.push({ role, username, password });
  });
  return { roles, skipped };
}

/**
 * Fills the existing sign-in rows: a row with the same role name is updated (its sign-in page is
 * kept), otherwise the first row with no username is used, otherwise a row is added.
 */
export function fillRoleRows(rows: SignInEntry[], imported: ImportedRole[]): SignInEntry[] {
  const next = rows.map((r) => ({ ...r }));
  for (const item of imported) {
    let at = next.findIndex((r) => r.role.trim().toLowerCase() === item.role.toLowerCase());
    if (at < 0) at = next.findIndex((r) => !r.username.trim() && !r.password);
    if (at < 0) {
      next.push({ role: item.role, username: item.username, password: item.password, loginPath: '' });
    } else {
      next[at] = { ...next[at], role: item.role, username: item.username, password: item.password };
    }
  }
  return next;
}
