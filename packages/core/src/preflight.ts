import { promises as fs } from 'fs';
import path from 'path';
import type { BrowserContext } from 'playwright';
import type { PreFlightResult, ProductProfile, RoleCredential } from '@qa/types';
import type { BrowserManager } from './browser.js';

export class PreFlightChecker {
  async checkUrlReachable(
    url: string,
    tunnelAuth?: string
  ): Promise<{ ok: boolean; status?: number; error?: string }> {
    try {
      const headers: Record<string, string> = {
        'User-Agent': 'QA-Readiness-Checker/0.1.0',
        'X-Tunnel-Skip-AntiPhishing-Page': 'true',
      };
      if (tunnelAuth) {
        headers['X-Tunnel-Authorization'] = tunnelAuth;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      return {
        ok: res.status < 500,
        status: res.status,
      };
    } catch (err: unknown) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async verifyRoleLogin(
    context: BrowserContext,
    baseUrl: string,
    credential: RoleCredential,
    saveStorageStatePath?: string
  ): Promise<boolean> {
    try {
      const page = await context.newPage();
      const loginUrl = new URL(credential.loginPath || '/login', baseUrl).toString();

      await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 8000 });

      // Check if username/email input exists
      const usernameInput = page.locator(
        'input[type="email"], input[type="text"], [data-testid="username-input"], [data-testid="email-input"]'
      ).first();
      
      const passwordInput = page.locator(
        'input[type="password"], [data-testid="password-input"]'
      ).first();

      if ((await usernameInput.count()) > 0 && credential.username) {
        await usernameInput.fill(credential.username);
      }

      if ((await passwordInput.count()) > 0 && credential.password) {
        await passwordInput.fill(credential.password);
      }

      const submitBtn = page.locator(
        'button[type="submit"], input[type="submit"], [data-testid="login-btn"], [data-testid="submit-btn"]'
      ).first();

      if ((await submitBtn.count()) > 0) {
        await Promise.all([
          page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 6000 }).catch(() => {}),
          submitBtn.click().catch(() => {}),
        ]);
      }

      await page.waitForTimeout(400);

      if (saveStorageStatePath) {
        await context.storageState({ path: saveStorageStatePath });
      }

      await page.close();
      return true;
    } catch {
      return false;
    }
  }

  async runPreFlight(
    targetUrl: string,
    profile?: ProductProfile,
    tunnelAuth?: string,
    options?: {
      browserManager?: BrowserManager;
      authDir?: string;
    }
  ): Promise<PreFlightResult> {
    const urlCheck = await this.checkUrlReachable(targetUrl, tunnelAuth);
    if (!urlCheck.ok) {
      return {
        ok: false,
        url: targetUrl,
        statusCode: urlCheck.status,
        loginReachable: false,
        roleAuthResults: {},
        error: `Target URL is unreachable (${urlCheck.error || `HTTP ${urlCheck.status}`}). Verify the server or tunnel is running.`,
      };
    }

    const roleResults: Record<string, boolean> = {};
    const roleStorageStates: Record<string, string> = {};

    if (profile?.roles && profile.roles.length > 0) {
      if (options?.authDir) {
        await fs.mkdir(options.authDir, { recursive: true });
      }

      for (const role of profile.roles) {
        if (options?.browserManager && options?.authDir) {
          const statePath = path.join(options.authDir, `${role.role}.json`);
          try {
            const context = await options.browserManager.createContext({
              baseUrl: targetUrl,
              tunnelAuth,
            });
            const loginOk = await this.verifyRoleLogin(context, targetUrl, role, statePath);
            roleResults[role.role] = loginOk;
            if (loginOk) {
              roleStorageStates[role.role] = statePath;
            }
            await context.close();
          } catch {
            roleResults[role.role] = false;
          }
        } else {
          roleResults[role.role] = true;
        }
      }
    }

    return {
      ok: true,
      url: targetUrl,
      statusCode: urlCheck.status,
      loginReachable: true,
      roleAuthResults: roleResults,
      roleStorageStates,
    };
  }
}

