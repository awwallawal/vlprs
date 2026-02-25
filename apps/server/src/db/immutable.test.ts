import { describe, it, expect } from 'vitest';
import { ledgerDb } from './immutable';

describe('ledgerDb (Layer 2 immutability guard)', () => {
  it('exposes insert method', () => {
    expect(ledgerDb).toHaveProperty('insert');
    expect(typeof ledgerDb.insert).toBe('function');
  });

  it('exposes selectByLoan method', () => {
    expect(ledgerDb).toHaveProperty('selectByLoan');
    expect(typeof ledgerDb.selectByLoan).toBe('function');
  });

  it('exposes selectByMdaAndLoan method', () => {
    expect(ledgerDb).toHaveProperty('selectByMdaAndLoan');
    expect(typeof ledgerDb.selectByMdaAndLoan).toBe('function');
  });

  it('does NOT expose update method', () => {
    expect(ledgerDb).not.toHaveProperty('update');
  });

  it('does NOT expose delete method', () => {
    expect(ledgerDb).not.toHaveProperty('delete');
  });
});
