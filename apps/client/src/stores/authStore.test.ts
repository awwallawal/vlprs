import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';
import type { User } from '@vlprs/shared';

const testUser: User = {
  id: 'test-user-1',
  email: 'admin@vlprs.gov.ng',
  firstName: 'Test',
  lastName: 'Admin',
  role: 'super_admin',
  mdaId: null,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it('has null initial state', () => {
    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.user).toBeNull();
  });

  it('setAuth stores accessToken and user', () => {
    useAuthStore.getState().setAuth('jwt-token-123', testUser);
    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('jwt-token-123');
    expect(state.user).toEqual(testUser);
  });

  it('clearAuth resets to null', () => {
    useAuthStore.getState().setAuth('jwt-token-123', testUser);
    useAuthStore.getState().clearAuth();
    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.user).toBeNull();
  });

  it('getState().accessToken returns current token outside React', () => {
    useAuthStore.getState().setAuth('outside-react-token', testUser);
    expect(useAuthStore.getState().accessToken).toBe('outside-react-token');
  });

  it('does not persist state (no persist middleware)', () => {
    // Verify the store does not have persist middleware by checking
    // that there is no 'persist' property on the store API
    expect((useAuthStore as unknown as Record<string, unknown>).persist).toBeUndefined();
  });
});
