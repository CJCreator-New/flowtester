import { describe, it, expect } from 'vitest';
import { isSameSite } from '../src/same-site.js';

describe('isSameSite', () => {
  it('treats a host and its www twin as one site, whatever the case', () => {
    expect(isSameSite('www.mghealthtech.com', 'mghealthtech.com')).toBe(true);
    expect(isSameSite('mghealthtech.com', 'www.mghealthtech.com')).toBe(true);
    expect(isSameSite('WWW.Example.com', 'example.COM')).toBe(true);
    expect(isSameSite('www.localhost:3001', 'localhost:3001')).toBe(true);
  });

  it('keeps other subdomains, other domains and other ports apart', () => {
    expect(isSameSite('app.example.com', 'example.com')).toBe(false);
    expect(isSameSite('www2.example.com', 'example.com')).toBe(false);
    expect(isSameSite('www.mghealthtech.com', 'arocord.com')).toBe(false);
    expect(isSameSite('localhost:3001', 'localhost:3002')).toBe(false);
  });
});
