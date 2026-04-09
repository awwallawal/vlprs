/**
 * Sidebar Naira Calculator (Story 15.0j, AC: 13)
 *
 * Collapsible calculator panel embedded in the dashboard sidebar. Provides
 * basic arithmetic with Naira-aware output formatting.
 *
 * Architecture (Story 15.0j AI Review 2026-04-09 — H1/M4 fix):
 *   - The component is rendered TWICE inside DashboardLayout: once in full mode
 *     for the expanded sidebar, once in compact mode (a Popover-wrapped icon)
 *     for the collapsed sidebar. Both modes must show the same input/result
 *     so the user can keep computing across sidebar collapses.
 *   - All four pieces of state (`open`, `expression`, `result`, `error`) live
 *     in a module-level pub/sub store consumed via `useSyncExternalStore`. The
 *     `open` field is also persisted to localStorage. This means:
 *       (a) toggling the popover from compact mode also opens the full panel
 *       (b) typing into one instance shows up in the other
 *       (c) collapsing the sidebar does not lose calculation state.
 *   - The previous implementation used per-instance `useState` and only WROTE
 *     to localStorage in `useEffect`, never reading from it after mount, so the
 *     two instances desynced as soon as either was toggled.
 *
 * Design notes:
 *   - Uses Decimal.js (already in project) for precision — no floating-point
 *     errors on financial values.
 *   - Expression parsing is a hand-written recursive-descent parser — NO eval().
 *   - Supports: + − × ÷ * / and parentheses, with standard operator precedence.
 *   - Result formatted via the shared formatNaira() utility so output matches
 *     every other ₦ display in the app.
 *   - Copy-to-clipboard via the existing useCopyToClipboard hook (Story 7.0e).
 *
 * Scope guard: this is a basic arithmetic calculator, NOT a loan amortisation
 * tool. Interest/tenure computation is handled by the core computation engine.
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import Decimal from 'decimal.js';
import { Calculator, ChevronDown, Copy, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatNaira } from '@/lib/formatters';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { cn } from '@/lib/utils';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const STORAGE_KEY = 'vlprs.sidebarCalculator.open';

// ─── Safe arithmetic parser (recursive-descent, NO eval) ──────────

/**
 * Parse and evaluate an arithmetic expression.
 * Supports: numbers (incl. decimals), + − × ÷ * /, parentheses, unary minus.
 * Returns a Decimal on success, throws on invalid input.
 *
 * Grammar:
 *   expression = term (("+" | "-") term)*
 *   term       = factor (("*" | "/") factor)*
 *   factor     = ("-" | "+") factor | primary
 *   primary    = number | "(" expression ")"
 *
 * Intentional scope guards (NOT supported, by design):
 *   - Scientific notation (e.g., `1e6`) — users should type `1000000` for ₦1M
 *   - Implicit multiplication (e.g., `2(3+4)`) — must spell out the `×`
 *   - Multiple decimal points in one number (e.g., `1.2.3`) — rejected at lexer
 */
export function evaluateExpression(input: string): Decimal {
  // Normalise visual operators to ASCII before tokenising
  const normalised = input
    .replace(/\u00d7/g, '*') // ×
    .replace(/\u00f7/g, '/') // ÷
    .replace(/\u2212/g, '-') // − (Unicode minus)
    .replace(/\s+/g, '');

  if (normalised.length === 0) {
    throw new Error('Empty expression');
  }

  let pos = 0;

  function peek(): string {
    return normalised[pos] ?? '';
  }

  function consume(): string {
    return normalised[pos++] ?? '';
  }

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
      if (op === '*') {
        left = left.times(right);
      } else {
        if (right.isZero()) throw new Error('Division by zero');
        left = left.div(right);
      }
    }
    return left;
  }

  function parseFactor(): Decimal {
    const ch = peek();
    if (ch === '-') {
      consume();
      return parseFactor().negated();
    }
    if (ch === '+') {
      consume();
      return parseFactor();
    }
    return parsePrimary();
  }

  function parsePrimary(): Decimal {
    const ch = peek();
    if (ch === '(') {
      consume();
      const value = parseExpression();
      if (peek() !== ')') throw new Error('Missing closing parenthesis');
      consume();
      return value;
    }
    // Parse a number literal. Reject a second '.' within the same literal at
    // the lexer level so we get a clearer error message than Decimal.js.
    let numStr = '';
    let seenDot = false;
    while (pos < normalised.length) {
      const c = normalised[pos];
      if (c >= '0' && c <= '9') {
        numStr += c;
        pos++;
      } else if (c === '.') {
        if (seenDot) {
          throw new Error('Invalid number: multiple decimal points');
        }
        seenDot = true;
        numStr += c;
        pos++;
      } else {
        break;
      }
    }
    if (numStr.length === 0) {
      throw new Error(`Unexpected character '${ch}'`);
    }
    try {
      return new Decimal(numStr);
    } catch {
      throw new Error(`Invalid number '${numStr}'`);
    }
  }

  const result = parseExpression();
  if (pos !== normalised.length) {
    throw new Error(`Unexpected character '${peek()}'`);
  }
  return result;
}

// ─── Module-level pub/sub store (single source of truth) ─────────────
//
// Both <SidebarCalculator /> and <SidebarCalculator compact /> instances
// subscribe to this store via useSyncExternalStore, so a state change in
// either one immediately re-renders the other. The `open` field is also
// persisted to localStorage; the rest are in-memory only (we don't want to
// surprise users by reviving an old expression after a fresh login).

interface CalculatorState {
  open: boolean;
  expression: string;
  result: string | null;
  error: string | null;
}

const initialState: CalculatorState = {
  open:
    typeof window !== 'undefined'
      && window.localStorage.getItem(STORAGE_KEY) === 'true',
  expression: '',
  result: null,
  error: null,
};

let storeState: CalculatorState = initialState;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): CalculatorState {
  return storeState;
}

function getServerSnapshot(): CalculatorState {
  return initialState;
}

function setState(patch: Partial<CalculatorState>) {
  const next = { ...storeState, ...patch };
  if (
    next.open === storeState.open
    && next.expression === storeState.expression
    && next.result === storeState.result
    && next.error === storeState.error
  ) {
    return;
  }
  storeState = next;
  if (typeof window !== 'undefined' && patch.open !== undefined) {
    window.localStorage.setItem(STORAGE_KEY, String(next.open));
  }
  emit();
}

/**
 * Test-only helper. Resets the module-level store between tests so that one
 * test's state doesn't leak into the next. Not exported from index.ts and
 * never imported by production code.
 */
export function __resetSidebarCalculatorStoreForTests() {
  storeState = {
    open:
      typeof window !== 'undefined'
        && window.localStorage.getItem(STORAGE_KEY) === 'true',
    expression: '',
    result: null,
    error: null,
  };
  emit();
}

// ─── Component ───────────────────────────────────────────────────

interface SidebarCalculatorProps {
  /** If true, renders a compact icon-only button that opens the panel in a popover. */
  compact?: boolean;
}

export function SidebarCalculator({ compact = false }: SidebarCalculatorProps) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { open, expression, result, error } = state;

  const setOpen = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof value === 'function' ? value(storeState.open) : value;
    setState({ open: next });
  }, []);

  const setExpression = useCallback((value: string) => {
    setState({ expression: value, error: null });
  }, []);

  const evaluate = useCallback(() => {
    if (!storeState.expression.trim()) {
      setState({ error: null, result: null });
      return;
    }
    try {
      const value = evaluateExpression(storeState.expression);
      setState({ result: value.toFixed(2), error: null });
    } catch (err) {
      setState({
        result: null,
        error: err instanceof Error ? err.message : 'Invalid expression',
      });
    }
  }, []);

  const clear = useCallback(() => {
    setState({ expression: '', result: null, error: null });
  }, []);

  const append = useCallback((token: string) => {
    setState({ expression: storeState.expression + token, error: null });
  }, []);

  // Compact/collapsed-sidebar view: icon-only button that opens a popover
  // containing the full calculator panel. The popover is anchored to the icon
  // so the user can compute without having to expand the sidebar first.
  if (compact) {
    return (
      <Popover
        open={open}
        onOpenChange={(next) => setOpen(next)}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            aria-label="Naira calculator"
            title="Naira calculator"
          >
            <Calculator className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="start"
          sideOffset={8}
          className="w-72 p-3"
          data-testid="sidebar-calculator-popover"
        >
          <CalculatorPanel
            expression={expression}
            result={result}
            error={error}
            onExpressionChange={setExpression}
            onEvaluate={evaluate}
            onClear={clear}
            onAppend={append}
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className="px-4 py-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        aria-expanded={open}
        aria-controls="sidebar-calculator-panel"
      >
        <span className="flex items-center gap-2">
          <Calculator className="h-3.5 w-3.5" aria-hidden="true" />
          Calculator
        </span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id="sidebar-calculator-panel"
          className="mt-2 space-y-2 rounded-md border border-sidebar-border bg-sidebar-accent/30 p-2"
          data-testid="sidebar-calculator-panel"
        >
          <CalculatorPanel
            expression={expression}
            result={result}
            error={error}
            onExpressionChange={setExpression}
            onEvaluate={evaluate}
            onClear={clear}
            onAppend={append}
          />
        </div>
      )}
    </div>
  );
}

// ─── Inner panel ───────────────────────────────────────────────────
//
// Pure presentational component used by BOTH the inline (sidebar-expanded)
// view and the popover (sidebar-collapsed) view. All state is owned by the
// module-level store; this component receives values + setters via props so
// it can be tested in isolation.

interface CalculatorPanelProps {
  expression: string;
  result: string | null;
  error: string | null;
  onExpressionChange: (value: string) => void;
  onEvaluate: () => void;
  onClear: () => void;
  onAppend: (token: string) => void;
}

function CalculatorPanel({
  expression,
  result,
  error,
  onExpressionChange,
  onEvaluate,
  onClear,
  onAppend,
}: CalculatorPanelProps) {
  const { copied, copyToClipboard } = useCopyToClipboard(2000, 'Result copied');

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onEvaluate();
      }
    },
    [onEvaluate],
  );

  const formattedResult = useMemo(() => (result ? formatNaira(result) : ''), [result]);

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <Input
          value={expression}
          onChange={(e) => onExpressionChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. 1875000 - 500000"
          aria-label="Calculator expression"
          className="h-8 flex-1 text-xs"
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onClear}
          aria-label="Clear"
          className="h-8 w-8 p-0"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Keypad — 4×4 grid for common operations */}
      <div className="grid grid-cols-4 gap-1">
        {['7', '8', '9', '÷'].map((t) => (
          <KeyButton key={t} token={t} onPress={onAppend} />
        ))}
        {['4', '5', '6', '×'].map((t) => (
          <KeyButton key={t} token={t} onPress={onAppend} />
        ))}
        {['1', '2', '3', '-'].map((t) => (
          <KeyButton key={t} token={t} onPress={onAppend} />
        ))}
        {['0', '.', '(', '+'].map((t) => (
          <KeyButton key={t} token={t} onPress={onAppend} />
        ))}
        <KeyButton token=")" onPress={onAppend} />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onExpressionChange(expression.slice(0, -1))}
          aria-label="Backspace"
          className="col-span-1 h-7 text-xs"
        >
          ⌫
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onEvaluate}
          className="col-span-2 h-7 bg-teal text-white hover:bg-teal/90 text-xs"
          aria-label="Evaluate expression"
        >
          =
        </Button>
      </div>

      {/* Result or error */}
      {error && (
        <p className="text-xs text-amber-700" role="alert">
          {error}
        </p>
      )}
      {result && !error && (
        <div className="flex items-center justify-between gap-2 rounded-md bg-sidebar-primary/10 px-2 py-1.5">
          <span
            className="truncate font-mono text-sm font-semibold text-sidebar-foreground"
            data-testid="calculator-result"
          >
            {formattedResult}
          </span>
          <button
            type="button"
            onClick={() => copyToClipboard(formattedResult)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            aria-label="Copy result"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
}

interface KeyButtonProps {
  token: string;
  onPress: (token: string) => void;
}

function KeyButton({ token, onPress }: KeyButtonProps) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={() => onPress(token)}
      className="h-7 text-xs font-mono"
      aria-label={`Insert ${token}`}
    >
      {token}
    </Button>
  );
}
