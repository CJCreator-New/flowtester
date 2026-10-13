/** A believable value for a form field, from its selector and label. */
export function guessFillValue(target: string): string {
  const hint = target.toLowerCase();
  if (hint.includes('email')) return 'test.user@example.com';
  if (hint.includes('password') || hint.includes('pass')) return 'TestPassword123!';
  if (
    hint.includes('url') ||
    hint.includes('address') ||
    hint.includes('site') ||
    hint.includes('domain') ||
    hint.includes('host')
  )
    return 'https://example.com';
  if (hint.includes('phone') || hint.includes('tel')) return '5555550123';
  if (hint.includes('name')) return 'Test User';
  if (/number|amount|qty|quantity|price/.test(hint)) return '1';
  return 'Test Value';
}
