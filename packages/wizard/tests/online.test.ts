import { describe, it, expect } from 'vitest';
import { startAddress, wakeAddress } from '../src/lib/online';

describe('where "Run a free check-up" leads', () => {
  it('stays on this site when no online copy is published', () => {
    expect(startAddress(null, 'https://app.example.com')).toBe('/check');
  });
  it('stays on this site when this page is the online copy', () => {
    expect(startAddress('https://qa.onrender.com', 'https://qa.onrender.com')).toBe('/check');
  });
  it('goes to the online copy from a static host', () => {
    expect(startAddress('https://qa.onrender.com', 'https://site.vercel.app')).toBe('https://qa.onrender.com/check');
    expect(startAddress('https://qa.onrender.com/', 'https://site.vercel.app')).toBe('https://qa.onrender.com/check');
  });
  it('falls back to this site when the published address cannot be read', () => {
    expect(startAddress('not a url', 'https://site.vercel.app')).toBe('/check');
  });
});

describe('waking the online copy', () => {
  it('pings its health address from a static host', () => {
    expect(wakeAddress('https://qa.onrender.com', 'https://site.vercel.app')).toBe('https://qa.onrender.com/healthz');
  });
  it('has nothing to wake on its own origin, or with no online copy', () => {
    expect(wakeAddress('https://qa.onrender.com', 'https://qa.onrender.com')).toBeNull();
    expect(wakeAddress(null, 'https://site.vercel.app')).toBeNull();
    expect(wakeAddress('nope', 'https://site.vercel.app')).toBeNull();
  });
});
