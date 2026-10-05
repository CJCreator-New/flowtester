import { describe, it, expect, afterEach } from 'vitest';
import type http from 'http';
import { publicOrigin } from '../src/ui-static.js';

const req = (headers: Record<string, string>) => ({ headers }) as unknown as http.IncomingMessage;

describe('publicOrigin', () => {
  afterEach(() => {
    delete process.env.PUBLIC_URL;
  });

  it('uses the host the visitor used', () => {
    expect(publicOrigin(req({ host: 'localhost:3001' }))).toBe('http://localhost:3001');
  });

  it('honours https from a proxy or tunnel', () => {
    expect(publicOrigin(req({ host: 'qa.example.com', 'x-forwarded-proto': 'https' }))).toBe('https://qa.example.com');
  });

  it('prefers PUBLIC_URL when it is valid', () => {
    process.env.PUBLIC_URL = 'https://checkup.example.com/';
    expect(publicOrigin(req({ host: 'localhost:3001' }))).toBe('https://checkup.example.com');
  });

  it('never reflects a malformed host into the page', () => {
    expect(publicOrigin(req({ host: 'evil.com"><script>' }))).toBe('http://localhost');
  });
});
