import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the useCopyToClipboard hook so this test does not need to stub
// `navigator.clipboard` (which leaks across tests). We just verify that the
// SidebarCalculator wires the formatted result through to the hook.
// AI Review 2026-04-09 cleanup: removes the previous Object.assign(navigator)
// pollution pattern.
const mockCopyToClipboard = vi.fn();
vi.mock('@/hooks/useCopyToClipboard', () => ({
  useCopyToClipboard: () => ({
    copied: false,
    copyToClipboard: mockCopyToClipboard,
  }),
}));

import {
  SidebarCalculator,
  evaluateExpression,
  __resetSidebarCalculatorStoreForTests,
} from './SidebarCalculator';

// ─── Parser unit tests ─────────────────────────────────────────────

describe('evaluateExpression', () => {
  it('evaluates simple addition', () => {
    expect(evaluateExpression('1 + 2').toString()).toBe('3');
  });

  it('evaluates subtraction', () => {
    expect(evaluateExpression('1875000 - 500000').toString()).toBe('1375000');
  });

  it('evaluates multiplication with ×', () => {
    expect(evaluateExpression('1000 × 5').toString()).toBe('5000');
  });

  it('evaluates division with ÷', () => {
    expect(evaluateExpression('100 ÷ 4').toString()).toBe('25');
  });

  it('respects operator precedence', () => {
    // 2 + 3 × 4 should be 14, not 20
    expect(evaluateExpression('2 + 3 × 4').toString()).toBe('14');
  });

  it('respects parentheses', () => {
    expect(evaluateExpression('(2 + 3) × 4').toString()).toBe('20');
  });

  it('handles unary minus', () => {
    expect(evaluateExpression('-5 + 10').toString()).toBe('5');
  });

  it('handles decimals with precision', () => {
    // 0.1 + 0.2 — a classic floating-point trap; Decimal.js must return 0.3
    expect(evaluateExpression('0.1 + 0.2').toString()).toBe('0.3');
  });

  it('throws on division by zero', () => {
    expect(() => evaluateExpression('10 ÷ 0')).toThrow(/Division by zero/i);
  });

  it('throws on unmatched parenthesis', () => {
    expect(() => evaluateExpression('(1 + 2')).toThrow();
  });

  it('throws on empty expression', () => {
    expect(() => evaluateExpression('')).toThrow();
  });

  it('throws on invalid characters', () => {
    expect(() => evaluateExpression('1 + abc')).toThrow();
  });

  it('accepts ASCII * and / alongside × and ÷', () => {
    expect(evaluateExpression('10 * 2 / 4').toString()).toBe('5');
  });

  it('evaluates nested parentheses with decimals preserving precision', () => {
    // Combines two failure modes that the basic suite doesn't exercise:
    // (a) parentheses combined with decimal arithmetic (precision-sensitive)
    // (b) nested parentheses with operator precedence
    expect(evaluateExpression('(0.1 + 0.2) * 10').toString()).toBe('3');
    expect(evaluateExpression('1 + (2 * (3 + 4))').toString()).toBe('15');
    expect(evaluateExpression('((1 + 2) * (3 + 4))').toString()).toBe('21');
  });

  it('rejects multiple decimal points in a number with a clear message', () => {
    // Lexer-level guard added during code review (Story 15.0j Finding #7)
    expect(() => evaluateExpression('1.2.3')).toThrow(/multiple decimal points/i);
  });
});

// ─── Component tests ───────────────────────────────────────────────

describe('SidebarCalculator', () => {
  beforeEach(() => {
    window.localStorage.clear();
    // Ensure panel opens on first render so tests don't have to toggle
    window.localStorage.setItem('vlprs.sidebarCalculator.open', 'true');
    // Reset the module-level shared store so test bleed doesn't happen
    __resetSidebarCalculatorStoreForTests();
    // Reset the copy-to-clipboard mock between tests
    mockCopyToClipboard.mockClear();
  });

  it('renders the calculator toggle button', () => {
    render(<SidebarCalculator />);
    expect(screen.getByRole('button', { name: /calculator/i })).toBeInTheDocument();
  });

  it('evaluates an expression on Enter and formats result as Naira', () => {
    render(<SidebarCalculator />);
    const input = screen.getByLabelText(/calculator expression/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1875000 - 500000' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const result = screen.getByTestId('calculator-result');
    expect(result.textContent).toBe('₦1,375,000.00');
  });

  it('evaluates via the = button', () => {
    render(<SidebarCalculator />);
    const input = screen.getByLabelText(/calculator expression/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1000 + 500' } });
    fireEvent.click(screen.getByRole('button', { name: /evaluate expression/i }));

    expect(screen.getByTestId('calculator-result').textContent).toBe('₦1,500.00');
  });

  it('shows an error for invalid expressions', () => {
    render(<SidebarCalculator />);
    const input = screen.getByLabelText(/calculator expression/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1 + abc' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByTestId('calculator-result')).not.toBeInTheDocument();
  });

  it('clears expression, result, and error when Clear pressed', () => {
    render(<SidebarCalculator />);
    const input = screen.getByLabelText(/calculator expression/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '100 + 200' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByTestId('calculator-result').textContent).toBe('₦300.00');

    fireEvent.click(screen.getByRole('button', { name: /^clear$/i }));
    expect(input.value).toBe('');
    expect(screen.queryByTestId('calculator-result')).not.toBeInTheDocument();
  });

  it('appends tokens when keypad buttons are pressed', () => {
    render(<SidebarCalculator />);
    const input = screen.getByLabelText(/calculator expression/i) as HTMLInputElement;
    fireEvent.click(screen.getByRole('button', { name: 'Insert 7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Insert +' }));
    fireEvent.click(screen.getByRole('button', { name: 'Insert 3' }));
    expect(input.value).toBe('7+3');
  });

  it('passes the formatted result to the useCopyToClipboard hook', () => {
    render(<SidebarCalculator />);
    const input = screen.getByLabelText(/calculator expression/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '500 + 500' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    fireEvent.click(screen.getByRole('button', { name: /copy result/i }));
    expect(mockCopyToClipboard).toHaveBeenCalledWith('₦1,000.00');
  });

  it('renders compact mode as a popover-trigger icon button', () => {
    render(<SidebarCalculator compact />);
    expect(
      screen.getByRole('button', { name: /naira calculator/i }),
    ).toBeInTheDocument();
  });

  it('persists open state to localStorage', () => {
    // Start clean — no key set
    window.localStorage.removeItem('vlprs.sidebarCalculator.open');
    __resetSidebarCalculatorStoreForTests();

    render(<SidebarCalculator />);

    // Initially closed (no key, default is false), then click toggle to open
    fireEvent.click(screen.getByRole('button', { name: /^calculator$/i }));
    expect(window.localStorage.getItem('vlprs.sidebarCalculator.open')).toBe('true');

    // Click again to close
    fireEvent.click(screen.getByRole('button', { name: /^calculator$/i }));
    expect(window.localStorage.getItem('vlprs.sidebarCalculator.open')).toBe('false');
  });

  // Story 15.0j Code Review 2026-04-09 — H1/M4 regression coverage.
  //
  // The previous architecture used per-instance React useState for `open`,
  // `expression`, `result`, `error`, and only WROTE to localStorage in
  // useEffect. That meant two SidebarCalculator instances would desync as
  // soon as either was toggled, and unmounting/remounting any instance lost
  // all calculator state. The new architecture lifts state into a module-level
  // store consumed via useSyncExternalStore.
  //
  // We verify the new behaviour by typing into one mounted instance, then
  // unmounting it, then remounting a fresh instance and asserting that the
  // expression and result are still there. With the previous (broken) design
  // both values would be lost because per-instance React state is destroyed
  // on unmount.
  it('preserves expression and result across unmount/remount via shared store (Story 15.0j H1/M4)', () => {
    const { unmount } = render(<SidebarCalculator />);

    const input = screen.getByLabelText(/calculator expression/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '250 + 750' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByTestId('calculator-result').textContent).toBe('₦1,000.00');

    unmount();

    // Fresh remount — same component, same `open=true` from localStorage.
    // If state lived in React useState, expression/result would both be empty.
    // With the shared module-level store they survive the unmount.
    render(<SidebarCalculator />);
    const remountedInput = screen.getByLabelText(
      /calculator expression/i,
    ) as HTMLInputElement;
    expect(remountedInput.value).toBe('250 + 750');
    expect(screen.getByTestId('calculator-result').textContent).toBe('₦1,000.00');
  });
});
