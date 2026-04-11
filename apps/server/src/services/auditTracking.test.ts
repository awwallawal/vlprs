import { describe, it, expect, beforeEach } from 'vitest';
import {
  trackFireAndForget,
  drainFireAndForgetWrites,
  pendingFireAndForgetCount,
  // Verify backward-compatible aliases still work
  trackAuditWrite,
  drainPendingAuditWrites,
  pendingAuditWriteCount,
} from './fireAndForgetTracking';

/**
 * Helper: a deferred promise so tests can control resolution timing precisely.
 */
function defer<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('fireAndForgetTracking registry', () => {
  beforeEach(async () => {
    // Drain any leakage from previous tests so each starts clean.
    await drainFireAndForgetWrites();
  });

  it('starts empty', () => {
    expect(pendingFireAndForgetCount()).toBe(0);
  });

  it('trackFireAndForget returns the same promise', async () => {
    const original = Promise.resolve('hello');
    const tracked = trackFireAndForget(original);
    expect(tracked).toBe(original);
    await drainFireAndForgetWrites();
  });

  it('increments count while a write is in flight, decrements when it settles', async () => {
    const d = defer();
    trackFireAndForget(d.promise);
    expect(pendingFireAndForgetCount()).toBe(1);

    d.resolve();
    await drainFireAndForgetWrites();

    expect(pendingFireAndForgetCount()).toBe(0);
  });

  it('drainFireAndForgetWrites awaits multiple in-flight writes', async () => {
    const d1 = defer();
    const d2 = defer();
    const d3 = defer();

    trackFireAndForget(d1.promise);
    trackFireAndForget(d2.promise);
    trackFireAndForget(d3.promise);
    expect(pendingFireAndForgetCount()).toBe(3);

    // Resolve them out of order to prove drain doesn't depend on registration order.
    setTimeout(() => d2.resolve(), 5);
    setTimeout(() => d1.resolve(), 10);
    setTimeout(() => d3.resolve(), 15);

    await drainFireAndForgetWrites();

    expect(pendingFireAndForgetCount()).toBe(0);
  });

  it('drain handles writes that reject (Promise.allSettled semantics)', async () => {
    const d1 = defer();
    const d2 = defer();

    trackFireAndForget(d1.promise).catch(() => undefined);
    trackFireAndForget(d2.promise).catch(() => undefined);

    d1.reject(new Error('boom'));
    d2.resolve();

    // Should NOT throw — drain swallows individual failures.
    await expect(drainFireAndForgetWrites()).resolves.toBeUndefined();
    expect(pendingFireAndForgetCount()).toBe(0);
  });

  it('drain handles writes added mid-drain (loops until quiescent)', async () => {
    const wave1 = defer();
    const wave2 = defer();

    trackFireAndForget(
      wave1.promise.then(() => {
        trackFireAndForget(wave2.promise);
      }),
    );

    setTimeout(() => wave1.resolve(), 5);
    setTimeout(() => wave2.resolve(), 15);

    await drainFireAndForgetWrites();

    expect(pendingFireAndForgetCount()).toBe(0);
  });

  it('drain on an empty registry resolves immediately', async () => {
    expect(pendingFireAndForgetCount()).toBe(0);
    await expect(drainFireAndForgetWrites()).resolves.toBeUndefined();
  });

  // Verify backward-compatible aliases point to the same implementation
  it('backward-compatible aliases work', async () => {
    expect(trackAuditWrite).toBe(trackFireAndForget);
    expect(drainPendingAuditWrites).toBe(drainFireAndForgetWrites);
    expect(pendingAuditWriteCount).toBe(pendingFireAndForgetCount);
  });
});
