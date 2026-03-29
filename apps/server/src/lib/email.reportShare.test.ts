import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock env to disable Resend (dev mode)
vi.mock('../config/env', () => ({
  env: {
    RESEND_API_KEY: '',
    EMAIL_FROM: 'test@vlprs.gov.ng',
  },
}));

// Mock logger to verify logging
vi.mock('./logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { sendReportEmail } from './email';
import { logger } from './logger';

describe('sendReportEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs to console in dev mode (no RESEND_API_KEY)', async () => {
    await sendReportEmail({
      to: 'recipient@example.com',
      reportTitle: 'Executive Summary Report',
      coverMessage: 'Please review this report',
      pdfBuffer: Buffer.from('fake-pdf-content'),
      pdfFilename: 'vlprs-executive-summary-2026-03-28.pdf',
    });

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'recipient@example.com',
        reportTitle: 'Executive Summary Report',
        pdfSize: expect.any(Number),
      }),
      expect.any(String),
      expect.any(String),
      expect.any(Number),
    );
  });

  it('does not throw on email failure', async () => {
    await expect(
      sendReportEmail({
        to: 'recipient@example.com',
        reportTitle: 'Variance Report',
        pdfBuffer: Buffer.from('fake-pdf'),
        pdfFilename: 'vlprs-variance-2026-03-28.pdf',
      }),
    ).resolves.toBeUndefined();
  });
});
