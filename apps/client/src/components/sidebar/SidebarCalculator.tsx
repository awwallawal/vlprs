/**
 * Sidebar Naira Calculator — floating compact dialog (UAT 2026-04-13).
 *
 * Single button in sidebar that opens a small draggable-feel floating window.
 * Uses Dialog (not Popover) so it floats independently of sidebar state.
 *
 * - Safe recursive-descent parser (NO eval)
 * - Decimal.js for precision
 * - Naira-formatted output
 * - Copy to clipboard
 */

import { useState, useCallback, useMemo } from 'react';
import Decimal from 'decimal.js';
import { Calculator, Copy, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatNaira } from '@/lib/formatters';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ─── Safe arithmetic parser (recursive-descent, NO eval) ──────────

export function evaluateExpression(input: string): Decimal {
  const normalised = input
    .replace(/\u00d7/g, '*')
    .replace(/\u00f7/g, '/')
    .replace(/\u2212/g, '-')
    .replace(/\s+/g, '');

  if (normalised.length === 0) throw new Error('Empty expression');

  let pos = 0;
  function peek(): string { return normalised[pos] ?? ''; }
  function consume(): string { return normalised[pos++] ?? ''; }

  function parseExpression(): Decimal {
    let left = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseTerm();
      left = op === '+' ? left.plus(right) : left.minus(right);
    }
    return left;
  }

  function parseTerm(): Decimal {
    let left = parseFactor();
    while (peek() === '*' || peek() === '/') {
      const op = consume();
      const right = parseFactor();
      if (op === '*') { left = left.times(right); }
      else { if (right.isZero()) throw new Error('Division by zero'); left = left.div(right); }
    }
    return left;
  }

  function parseFactor(): Decimal {
    if (peek() === '-') { consume(); return parseFactor().negated(); }
    if (peek() === '+') { consume(); return parseFactor(); }
    return parsePrimary();
  }

  function parsePrimary(): Decimal {
    if (peek() === '(') {
      consume();
      const value = parseExpression();
      if (peek() !== ')') throw new Error('Missing closing parenthesis');
      consume();
      return value;
    }
    let numStr = '';
    let seenDot = false;
    while (pos < normalised.length) {
      const c = normalised[pos];
      if (c >= '0' && c <= '9') { numStr += c; pos++; }
      else if (c === '.') {
        if (seenDot) throw new Error('Invalid number: multiple decimal points');
        seenDot = true; numStr += c; pos++;
      } else break;
    }
    if (numStr.length === 0) throw new Error(`Unexpected character '${peek()}'`);
    try { return new Decimal(numStr); }
    catch { throw new Error(`Invalid number '${numStr}'`); }
  }

  const result = parseExpression();
  if (pos !== normalised.length) throw new Error(`Unexpected character '${peek()}'`);
  return result;
}

// ─── Test helper ────────────────────────────────────────────────────
export function __resetSidebarCalculatorStoreForTests() { /* no-op for compat */ }

// ─── Component ───────────────────────────────────────────────────

export function SidebarCalculator() {
  const [open, setOpen] = useState(false);
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { copied, copyToClipboard } = useCopyToClipboard(2000, 'Result copied');

  const evaluate = useCallback(() => {
    if (!expression.trim()) { setError(null); setResult(null); return; }
    try {
      const value = evaluateExpression(expression);
      setResult(value.toFixed(2));
      setError(null);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'Invalid expression');
    }
  }, [expression]);

  const clear = useCallback(() => {
    setExpression(''); setResult(null); setError(null);
  }, []);

  const append = useCallback((token: string) => {
    setExpression((prev) => prev + token);
    setError(null);
  }, []);

  const formattedResult = useMemo(() => (result ? formatNaira(result) : ''), [result]);

  return (
    <>
      {/* Sidebar trigger button */}
      <div className="px-4 py-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <Calculator className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="group-data-[collapsible=icon]:hidden">Calculator</span>
        </button>
      </div>

      {/* Floating compact dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[360px] sm:max-w-[380px] p-5 gap-4" data-testid="sidebar-calculator-dialog">
          <DialogHeader className="pb-0">
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Naira Calculator
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* Expression input */}
            <div className="flex gap-1.5">
              <Input
                value={expression}
                onChange={(e) => { setExpression(e.target.value); setError(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); evaluate(); } }}
                placeholder="e.g. 1875000 - 500000"
                aria-label="Calculator expression"
                className="h-11 flex-1 text-base font-mono"
                autoFocus
              />
              <Button type="button" variant="ghost" onClick={clear} aria-label="Clear" className="h-11 w-11 p-0">
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-4 gap-1.5">
              {['7', '8', '9', '÷'].map((t) => <KeyButton key={t} token={t} onPress={append} />)}
              {['4', '5', '6', '×'].map((t) => <KeyButton key={t} token={t} onPress={append} />)}
              {['1', '2', '3', '-'].map((t) => <KeyButton key={t} token={t} onPress={append} />)}
              {['0', '.', '(', '+'].map((t) => <KeyButton key={t} token={t} onPress={append} />)}
              <KeyButton token=")" onPress={append} />
              <Button type="button" variant="ghost" onClick={() => setExpression((prev) => prev.slice(0, -1))} aria-label="Backspace" className="col-span-1 h-11 text-base">
                ⌫
              </Button>
              <Button type="button" onClick={evaluate} className="col-span-2 h-11 bg-teal text-white hover:bg-teal/90 text-base font-semibold" aria-label="Evaluate">
                =
              </Button>
            </div>

            {/* Result / error */}
            {error && <p className="text-sm text-amber-700" role="alert">{error}</p>}
            {result && !error && (
              <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-100 px-3 py-2.5">
                <span className="truncate font-mono text-lg font-bold text-text-primary" data-testid="calculator-result">
                  {formattedResult}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(formattedResult)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-text-muted transition-colors hover:bg-slate-200 hover:text-text-primary"
                  aria-label="Copy result"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function KeyButton({ token, onPress }: { token: string; onPress: (token: string) => void }) {
  return (
    <Button type="button" variant="ghost" onClick={() => onPress(token)} className="h-11 text-base font-mono" aria-label={`Insert ${token}`}>
      {token}
    </Button>
  );
}
