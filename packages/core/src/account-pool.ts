import type { RoleCredential } from '@qa/types';

export interface LeasedAccount {
  credential: RoleCredential;
  leaseId: string;
  workerId: string;
}

export class AccountPoolManager {
  private availableAccounts: Map<string, RoleCredential[]> = new Map();
  private activeLeases: Map<string, LeasedAccount> = new Map(); // key: leaseId

  constructor(accountsByRole: Record<string, RoleCredential[]> = {}) {
    for (const [role, creds] of Object.entries(accountsByRole)) {
      this.availableAccounts.set(role, [...creds]);
    }
  }

  /**
   * Leases an available account credential for the given role to a worker.
   */
  leaseAccount(role: string, workerId: string): LeasedAccount | null {
    const pool = this.availableAccounts.get(role);
    if (!pool || pool.length === 0) {
      return null;
    }

    const credential = pool.shift()!;
    const leaseId = `lease_${role}_${workerId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const lease: LeasedAccount = {
      credential,
      leaseId,
      workerId,
    };

    this.activeLeases.set(leaseId, lease);
    return lease;
  }

  /**
   * Releases an account back to the pool once a worker finishes executing a flow.
   */
  releaseAccount(leaseId: string): void {
    const lease = this.activeLeases.get(leaseId);
    if (!lease) {
      return;
    }

    this.activeLeases.delete(leaseId);
    const pool = this.availableAccounts.get(lease.credential.role) || [];
    pool.push(lease.credential);
    this.availableAccounts.set(lease.credential.role, pool);
  }

  /**
   * Returns how many accounts are currently available for a role.
   */
  getAvailableCount(role: string): number {
    return this.availableAccounts.get(role)?.length || 0;
  }
}
