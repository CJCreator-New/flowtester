/**
 * Minimal robots.txt policy (RFC 9309): picks the group for our user-agent token
 * (falling back to `*`) and applies longest-match Allow/Disallow with `*` and `$` wildcards.
 */
export class RobotsPolicy {
  private constructor(private rules: Array<{ allow: boolean; pattern: string }>) {}

  static allowAll(): RobotsPolicy {
    return new RobotsPolicy([]);
  }

  static parse(robotsTxt: string, userAgentToken: string): RobotsPolicy {
    const token = userAgentToken.toLowerCase();
    const groups: Array<{ agents: string[]; rules: Array<{ allow: boolean; pattern: string }> }> = [];
    let current: (typeof groups)[number] | null = null;
    let lastWasAgent = false;

    for (const rawLine of robotsTxt.split(/\r?\n/)) {
      const line = rawLine.replace(/#.*$/, '').trim();
      const sep = line.indexOf(':');
      if (sep === -1) continue;
      const key = line.slice(0, sep).trim().toLowerCase();
      const value = line.slice(sep + 1).trim();

      if (key === 'user-agent') {
        // Consecutive user-agent lines share one group.
        if (!current || !lastWasAgent) {
          current = { agents: [], rules: [] };
          groups.push(current);
        }
        current.agents.push(value.toLowerCase());
        lastWasAgent = true;
      } else if ((key === 'allow' || key === 'disallow') && current) {
        lastWasAgent = false;
        // An empty Disallow means "allow everything" and contributes no rule.
        if (value) current.rules.push({ allow: key === 'allow', pattern: value });
      } else {
        lastWasAgent = false;
      }
    }

    const specific = groups.filter((g) => g.agents.includes(token));
    const chosen = specific.length > 0 ? specific : groups.filter((g) => g.agents.includes('*'));
    return new RobotsPolicy(chosen.flatMap((g) => g.rules));
  }

  /** Fetches `<origin>/robots.txt`. A missing or unreachable file means everything is allowed. */
  static async fetch(origin: string, userAgentToken: string): Promise<RobotsPolicy> {
    try {
      const res = await fetch(new URL('/robots.txt', origin), { signal: AbortSignal.timeout(10000) });
      if (!res.ok) return RobotsPolicy.allowAll();
      return RobotsPolicy.parse(await res.text(), userAgentToken);
    } catch {
      return RobotsPolicy.allowAll();
    }
  }

  isAllowed(pathAndQuery: string): boolean {
    let best: { allow: boolean; length: number } | null = null;
    for (const rule of this.rules) {
      if (!matches(rule.pattern, pathAndQuery)) continue;
      const length = rule.pattern.length;
      // Longest pattern wins; on a tie, Allow wins.
      if (!best || length > best.length || (length === best.length && rule.allow)) {
        best = { allow: rule.allow, length };
      }
    }
    return best ? best.allow : true;
  }
}

function matches(pattern: string, target: string): boolean {
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const regex = body
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${regex}${anchored ? '$' : ''}`).test(target);
}
