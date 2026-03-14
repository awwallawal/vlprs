import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

import { useCopyToClipboard } from './useCopyToClipboard';
import { toast } from 'sonner';

describe('useCopyToClipboard', () => {
  let originalClipboard: Clipboard;

  beforeEach(() => {
    vi.useFakeTimers();
    originalClipboard = navigator.clipboard;
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.assign(navigator, { clipboard: originalClipboard });
    vi.restoreAllMocks();
  });

  it('copies text via navigator.clipboard.writeText', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      result.current.copyToClipboard('BIR-2026-02-0001');
    });

    expect(writeText).toHaveBeenCalledWith('BIR-2026-02-0001');
  });

  it('sets copied to true after copy, resets after timeout', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const { result } = renderHook(() => useCopyToClipboard());

    expect(result.current.copied).toBe(false);

    await act(async () => {
      result.current.copyToClipboard('test');
    });

    expect(result.current.copied).toBe(true);
    expect(toast.success).toHaveBeenCalledWith('Reference number copied to clipboard');

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.copied).toBe(false);
  });

  it('falls back to execCommand on clipboard API failure', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.assign(navigator, { clipboard: { writeText } });

    // JSDOM doesn't implement execCommand — stub it on document
    document.execCommand = vi.fn().mockReturnValue(true);
    const appendChild = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    const removeChild = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      result.current.copyToClipboard('fallback-text');
    });

    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(result.current.copied).toBe(true);

    appendChild.mockRestore();
    removeChild.mockRestore();
  });

  it('respects custom reset duration', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const { result } = renderHook(() => useCopyToClipboard(5000));

    await act(async () => {
      result.current.copyToClipboard('test');
    });

    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.copied).toBe(false);
  });
});
