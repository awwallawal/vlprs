import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { VerifyCertificatePage } from './VerifyCertificatePage';

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useParams: () => ({ certificateId: 'ASC-2026-04-9001' }),
  };
});

vi.mock('@/lib/apiClient', () => ({
  API_BASE: 'http://localhost:3000/api',
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

function renderPage() {
  return render(
    <MemoryRouter>
      <VerifyCertificatePage />
    </MemoryRouter>,
  );
}

describe('VerifyCertificatePage', () => {
  it('shows loading state before fetch resolves', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText('Certificate Verification')).toBeInTheDocument();
    expect(screen.queryByText('Verified')).not.toBeInTheDocument();
    expect(screen.queryByText('Certificate Not Found')).not.toBeInTheDocument();
  });

  it('renders verified state for a valid certificate', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            valid: true,
            message: 'Verified — Certificate ASC-2026-04-9001 is authentic',
            beneficiaryName: 'Akinwale Babatunde',
            mdaName: 'Ministry of Health',
            completionDate: '2026-03-15T00:00:00.000Z',
          },
        }),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });

    expect(screen.getByText('Akinwale Babatunde')).toBeInTheDocument();
    expect(screen.getByText('Ministry of Health')).toBeInTheDocument();
    expect(screen.getByText('15 March 2026')).toBeInTheDocument();
  });

  it('renders not-found state for an invalid certificate', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            valid: false,
            message: 'Certificate not found',
          },
        }),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Certificate Not Found')).toBeInTheDocument();
    });

    expect(screen.getByText(/check the ID and try again/)).toBeInTheDocument();
  });

  it('renders error state when fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText('Unable to connect to verification service'),
      ).toBeInTheDocument();
    });
  });

  it('displays the certificate ID', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            valid: true,
            message: 'Verified',
            beneficiaryName: 'A',
            mdaName: 'B',
            completionDate: '2026-01-01',
          },
        }),
    });

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText(/Certificate ID: ASC-2026-04-9001/),
      ).toBeInTheDocument();
    });
  });
});
