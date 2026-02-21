import { describe, it, expect, vi, beforeAll } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Mock matchMedia for Sonner toast
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

// Mock router to avoid createBrowserRouter AbortSignal issues in jsdom
vi.mock('@/router', () => ({
  router: {},
}));

// Mock RouterProvider since we mocked the router
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    RouterProvider: () => null,
  };
});

describe('App', () => {
  it('exports a default function component', async () => {
    const mod = await import('./App');
    expect(typeof mod.default).toBe('function');
  });

  it('renders without throwing', async () => {
    const { render } = await import('@testing-library/react');
    const App = (await import('./App')).default;
    const { container } = render(<App />);
    expect(container).toBeTruthy();
  });
});
