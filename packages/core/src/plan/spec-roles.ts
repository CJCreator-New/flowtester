/**
 * Role words in Product Context documents, matched to the roles configured for a Check-up.
 * Pure. Never guesses: exact match or a whole-word match that points at one role only; anything
 * else ("lead+", free words, an ambiguous word) is returned as unresolved for a person to settle.
 */

/** Lowercase, punctuation to spaces, spaces collapsed: `HR / Admin` and `HR/Admin` are both `hr admin`. */
export function normaliseRoleText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Whether `needle` is a run of whole words inside `hay` (both already normalised). */
function containsWords(hay: string, needle: string): boolean {
  if (!needle) return false;
  return ` ${hay} `.includes(` ${needle} `);
}

/** The role name from a persona heading: `Employee — Aarav Sharma` gives `Employee`; numbering is dropped. */
export function personaName(text: string): string {
  const noNumber = text.replace(/^\s*\d+(?:\.\d+)*\.?\s+/, '');
  return noNumber.split(/\s+[—–-]\s+|\s*:\s+/)[0].trim();
}

/**
 * The one configured role a word or phrase names, or undefined. Equal after normalising wins; else a
 * whole-word match either way (`lead` in `Team Lead`, `HR` in `HR/Admin`, `Alumni settled` for `Alumni`)
 * counts only when exactly one role matches.
 */
export function resolveRole(text: string, roles: string[]): string | undefined {
  const query = normaliseRoleText(personaName(text));
  if (!query) return undefined;
  const exact = roles.filter((r) => normaliseRoleText(r) === query);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return undefined;
  const partial = roles.filter((r) => {
    const name = normaliseRoleText(r);
    return containsWords(name, query) || containsWords(query, name);
  });
  return partial.length === 1 ? partial[0] : undefined;
}

export interface RoleListResult {
  /** Configured roles the text names, in the configured order. */
  roles: string[];
  /** Words that name no single role (`lead+`, free text, an ambiguous word). Never guessed. */
  unresolved: string[];
}

const ALL = /^(all|everyone|everybody|all roles|all users|all signed in|all signed in users|any signed in role)$/;
const ALL_ACTIVE = /^(all active|all active roles|all active users)$/;
const INACTIVE = /alumni|settled/i;

/** The roles a Roles cell names: `lead / manager / HR`, `all`, `all active`, `all + alumni`, `HR`. */
export function resolveRoleList(text: string, roles: string[]): RoleListResult {
  const found = new Set<string>();
  const unresolved: string[] = [];
  const tokens = text
    .split(/\s*[\/,;&\n]\s*|\s+\+\s+|\s+(?:and|or)\s+/i)
    .map((t) => t.trim())
    .filter(Boolean);
  for (const token of tokens) {
    const norm = normaliseRoleText(token);
    if (/\w\+$/.test(token) || /\+\s*$/.test(token)) {
      unresolved.push(token);
    } else if (ALL.test(norm)) {
      roles.forEach((r) => found.add(r));
    } else if (ALL_ACTIVE.test(norm)) {
      roles.filter((r) => !INACTIVE.test(r)).forEach((r) => found.add(r));
    } else {
      const role = resolveRole(token, roles);
      if (role) found.add(role);
      else unresolved.push(token);
    }
  }
  // `HR/Admin` as a configured name is split by the separator above; try the whole text as one role first.
  if (tokens.length > 1) {
    const whole = resolveRole(text, roles);
    if (whole && normaliseRoleText(whole) === normaliseRoleText(text)) return { roles: [whole], unresolved: [] };
  }
  return { roles: roles.filter((r) => found.has(r)), unresolved };
}
