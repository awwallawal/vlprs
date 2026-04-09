import { describe, it, expect, beforeEach } from 'vitest';
import {
  trackAuditWrite,
  drainPendingAuditWrites,
  pendingAuditWriteCount,
} from './auditTracking';

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

describe('auditTracking registry', () => {
  beforeEach(async () => {
    // Drain any leakage from previous tests so each starts clean.
    await drainPendingAuditWrites();
  });

  it('starts empty', () => {
    expect(pendingAuditWriteCount()).toBe(0);
  });

  it('trackAuditWrite returns the same promise', async () => {
    const original = Promise.resolve('hello');
    const tracked = trackAuditWrite(original);
    expect(tracked).toBe(original);
    await drainPendingAuditWrites();
  });

  it('increments count while a write is in flight, decrements when it settles', async () => {
    const d = defer();
    trackAuditWrite(d.promise);
    expect(pendingAuditWriteCount()).toBe(1);

    d.resolve();
    // The .finally cleanup runs in a microtask after resolve; let it run.
    await drainPendingAuditWrites();

    expect(pendingAuditWriteCount()).toBe(0);
  });

  it('drainPendingAuditWrites awaits multiple in-flight writes', async () => {
    const d1 = defer();
    const d2 = defer();
    const d3 = defer();

    trackAuditWrite(d1.promise);
    trackAuditWrite(d2.promise);
    trackAuditWrite(d3.promise);
    expect(pendingAuditWriteCount()).toBe(3);

    // Resolve them out of order to prove drain doesn't depend on registration order.
    setTimeout(() => d2.resolve(), 5);
    setTimeout(() => d1.resolve(), 10);
    setTimeout(() => d3.resolve(), 15);

    await drainPendingAuditWrites();

    expect(pendingAuditWriteCount()).toBe(0);
  });

  it('drain handles writes that reject (Promise.allSettled semantics)', async () => {
    const d1 = defer();
    const d2 = defer();

    // Attach a noop catch so vitest does not flag the rejection as unhandled.
    // (trackAuditWrite returns the same promise; without a handler, the
    // rejection would propagate up to the test runner.)
    trackAuditWrite(d1.promise).catch(() => undefined);
    trackAuditWrite(d2.promise).catch(() => undefined);

    d1.reject(new Error('boom'));
    d2.resolve();

    // Should NOT throw — drain swallows individual failures.
    await expect(drainPendingAuditWrites()).resolves.toBeUndefined();
    expect(pendingAuditWriteCount()).toBe(0);
  });

  it('drain handles writes added mid-drain (loops until quiescent)', async () => {
    // First wave: a write that, when it settles, schedules a second write.
    const wave1 = defer();
    const wave2 = defer();

    trackAuditWrite(
      wave1.promise.then(() => {
        // This second write is registered AFTER drain has started awaiting wave1.
        trackAuditWrite(wave2.promise);
      }),
    );

    // Schedule resolutions: wave1 first, then wave2 once the chained track has run.
    setTimeout(() => wave1.resolve(), 5);
    setTimeout(() => wave2.resolve(), 15);

    await drainPendingAuditWrites();

    expect(pendingAuditWriteCount()).toBe(0);
  });

  it('drain on an empty registry resolves immediately', async () => {
    expect(pendingAuditWriteCount()).toBe(0);
    await expect(drainPendingAuditWrites()).resolves.toBeUndefined();
  });
});
