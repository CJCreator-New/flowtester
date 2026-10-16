import type { RunnerPhase } from '@qa/types';

export interface RunSlot {
  readonly isRunning: boolean;
  readonly phase: RunnerPhase;
  readonly runId: string | null;
  readonly targetUrl: string | null;
  /** Bumped by every start; guards events that belong to a run that is over (today's `runGeneration`). */
  readonly generation: number;
  /** Claim the slot for a run. False when one is already running. */
  begin(runId: string, targetUrl: string): boolean;
  /** Give the slot back. */
  release(): void;
  setPhase(phase: RunnerPhase): void;
  setRunId(runId: string | null): void;
  setTargetUrl(targetUrl: string | null): void;
  setGeneration(generation: number): void;
  setIsRunning(isRunning: boolean): void;
  abortController(): AbortController | null;
  setAbortController(controller: AbortController | null): void;
  finishController(): AbortController | null;
  setFinishController(controller: AbortController | null): void;
}

export class DefaultRunSlot implements RunSlot {
  private _isRunning = false;
  private _phase: RunnerPhase = 'idle';
  private _runId: string | null = null;
  private _targetUrl: string | null = null;
  private _generation = 0;
  private _abortController: AbortController | null = null;
  private _finishController: AbortController | null = null;

  get isRunning(): boolean {
    return this._isRunning;
  }

  get phase(): RunnerPhase {
    return this._phase;
  }

  get runId(): string | null {
    return this._runId;
  }

  get targetUrl(): string | null {
    return this._targetUrl;
  }

  get generation(): number {
    return this._generation;
  }

  begin(runId: string, targetUrl: string): boolean {
    if (this._isRunning && this._phase !== 'awaiting-review') return false;
    this._isRunning = true;
    this._phase = 'scanning';
    this._runId = runId;
    this._targetUrl = targetUrl;
    this._generation++;
    this._abortController = null;
    this._finishController = null;
    return true;
  }

  release(): void {
    this._isRunning = false;
    this._phase = 'idle';
    this._runId = null;
    this._targetUrl = null;
    this._abortController = null;
    this._finishController = null;
  }

  setPhase(phase: RunnerPhase): void {
    this._phase = phase;
    if (phase === 'scanning' || phase === 'testing' || phase === 'awaiting-review') {
      this._isRunning = true;
    } else if (phase === 'idle' || phase === 'done' || phase === 'failed') {
      this._isRunning = false;
    }
  }

  setRunId(runId: string | null): void {
    this._runId = runId;
  }

  setTargetUrl(targetUrl: string | null): void {
    this._targetUrl = targetUrl;
  }

  setGeneration(generation: number): void {
    this._generation = generation;
  }

  setIsRunning(isRunning: boolean): void {
    this._isRunning = isRunning;
  }

  abortController(): AbortController | null {
    return this._abortController;
  }

  setAbortController(controller: AbortController | null): void {
    this._abortController = controller;
  }

  finishController(): AbortController | null {
    return this._finishController;
  }

  setFinishController(controller: AbortController | null): void {
    this._finishController = controller;
  }
}
