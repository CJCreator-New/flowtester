import { promises as fs } from 'fs';
import path from 'path';

export interface CheckupSchedule {
  id: string;
  name: string;
  targetUrl: string;
  cadence: 'daily' | 'weekly' | 'hourly';
  hour: number; // 0 - 23
  dayOfWeek?: number; // 0 (Sun) - 6 (Sat)
  preset: 'full' | 'quick';
  enabled: boolean;
  createdAt: string;
  lastRunAt?: string;
  lastRunStatus?: 'passed' | 'failed';
  nextRunAt: string;
}

export class SchedulerManager {
  private schedulesFile: string;
  private timer: NodeJS.Timeout | null = null;

  constructor(dataDir: string) {
    this.schedulesFile = path.join(dataDir, 'schedules.json');
  }

  calculateNextRun(cadence: 'daily' | 'weekly' | 'hourly', hour: number = 2, dayOfWeek: number = 1): string {
    const now = new Date();
    const next = new Date(now);

    if (cadence === 'hourly') {
      next.setMinutes(0, 0, 0);
      next.setHours(next.getHours() + 1);
      return next.toISOString();
    }

    if (cadence === 'daily') {
      next.setHours(hour, 0, 0, 0);
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      return next.toISOString();
    }

    if (cadence === 'weekly') {
      next.setHours(hour, 0, 0, 0);
      const currentDay = next.getDay();
      let daysUntil = (dayOfWeek - currentDay + 7) % 7;
      if (daysUntil === 0 && next <= now) {
        daysUntil = 7;
      }
      next.setDate(next.getDate() + daysUntil);
      return next.toISOString();
    }

    return next.toISOString();
  }

  async loadSchedules(): Promise<CheckupSchedule[]> {
    try {
      const data = await fs.readFile(this.schedulesFile, 'utf8');
      return JSON.parse(data) as CheckupSchedule[];
    } catch {
      return [];
    }
  }

  async saveSchedules(schedules: CheckupSchedule[]): Promise<void> {
    await fs.mkdir(path.dirname(this.schedulesFile), { recursive: true });
    await fs.writeFile(this.schedulesFile, JSON.stringify(schedules, null, 2), 'utf8');
  }

  async addSchedule(input: Omit<CheckupSchedule, 'id' | 'createdAt' | 'nextRunAt'>): Promise<CheckupSchedule> {
    const schedules = await this.loadSchedules();
    const id = `sched_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const nextRunAt = this.calculateNextRun(input.cadence, input.hour, input.dayOfWeek);

    const newSchedule: CheckupSchedule = {
      ...input,
      id,
      createdAt: new Date().toISOString(),
      nextRunAt,
    };

    schedules.push(newSchedule);
    await this.saveSchedules(schedules);
    return newSchedule;
  }

  async deleteSchedule(id: string): Promise<boolean> {
    const schedules = await this.loadSchedules();
    const filtered = schedules.filter((s) => s.id !== id);
    if (filtered.length === schedules.length) return false;
    await this.saveSchedules(filtered);
    return true;
  }

  async toggleSchedule(id: string, enabled: boolean): Promise<CheckupSchedule | null> {
    const schedules = await this.loadSchedules();
    const target = schedules.find((s) => s.id === id);
    if (!target) return null;
    target.enabled = enabled;
    if (enabled) {
      target.nextRunAt = this.calculateNextRun(target.cadence, target.hour, target.dayOfWeek);
    }
    await this.saveSchedules(schedules);
    return target;
  }

  private ticking = false;

  /**
   * Runs every schedule that is due, once. The next run time is saved before the run is started, so a
   * schedule that is due is never fired twice, and a tick that is still going is not entered again.
   */
  async tick(onRunScheduled: (schedule: CheckupSchedule) => Promise<boolean>, now: Date = new Date()): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const schedules = await this.loadSchedules();
      const due = schedules.filter((s) => s.enabled && now >= new Date(s.nextRunAt));
      if (due.length === 0) return;
      for (const sched of due) {
        sched.lastRunAt = now.toISOString();
        sched.nextRunAt = this.calculateNextRun(sched.cadence, sched.hour, sched.dayOfWeek);
      }
      await this.saveSchedules(schedules);
      for (const sched of due) {
        const started = await onRunScheduled(sched).catch(() => false);
        sched.lastRunStatus = started ? 'passed' : 'failed';
      }
      // Re-read so a schedule added or removed while a run was starting is not undone.
      const latest = await this.loadSchedules();
      for (const sched of due) {
        const target = latest.find((s) => s.id === sched.id);
        if (target) target.lastRunStatus = sched.lastRunStatus;
      }
      await this.saveSchedules(latest);
    } catch {
      // scheduler tick error resilience
    } finally {
      this.ticking = false;
    }
  }

  start(onRunScheduled: (schedule: CheckupSchedule) => Promise<boolean>, intervalMs = 60000): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(onRunScheduled), intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
