/** True when a bind address only accepts connections from this computer. */
export function isLoopbackBindHost(host: string): boolean {
  const h = host
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '');
  return h === 'localhost' || h === '::1' || h === '127.0.0.1' || /^127(\.\d{1,3}){3}$/.test(h);
}
