import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock env before importing email module
vi.mock('../config/env', () => ({
  env: {
    RESEND_API_KEY: '',
    EMAIL_FROM: 'noreply@vlprs.oyo.gov.ng',
    APP_URL: 'http://localhost:5173',
  },
}));

// Mock logger to capture log calls
vi.mock('./logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { sendWelcomeEmail, sendPasswordResetEmail } from './email';
import { logger } from './logger';

describe('email service (dev mode — no RESEND_API_KEY)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sendWelcomeEmail logs to console in dev mode', async () => {
    await sendWelcomeEmail({
      to: 'newuser@test.com',
      firstName: 'Jane',
      temporaryPassword: 'TempPass123',
      role: 'dept_admin',
      loginUrl: 'http://localhost:5173/login',
    });

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'newuser@test.com' }),
      expect.stringContaining('[DEV EMAIL]'),
      'TempPass123',
    );
  });

  it('sendPasswordResetEmail logs to console in dev mode', async () => {
    await sendPasswordResetEmail({
      to: 'user@test.com',
      firstName: 'John',
      temporaryPassword: 'ResetPass456',
      loginUrl: 'http://localhost:5173/login',
    });

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user@test.com' }),
      expect.stringContaining('[DEV EMAIL]'),
      'ResetPass456',
    );
  });

  it('sendWelcomeEmail does not throw', async () => {
    await expect(
      sendWelcomeEmail({
        to: 'test@test.com',
        firstName: 'Test',
        temporaryPassword: 'Abc123xyz',
        role: 'mda_officer',
        mdaName: 'Test MDA',
        loginUrl: 'http://localhost:5173/login',
      }),
    ).resolves.toBeUndefined();
  });

  it('sendPasswordResetEmail does not throw', async () => {
    await expect(
      sendPasswordResetEmail({
        to: 'test@test.com',
        firstName: 'Test',
        temporaryPassword: 'Abc123xyz',
        loginUrl: 'http://localhost:5173/login',
      }),
    ).resolves.toBeUndefined();
  });
});
