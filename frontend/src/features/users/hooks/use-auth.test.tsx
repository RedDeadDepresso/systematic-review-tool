import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mocks
import { toast } from 'sonner';
import { useRouter } from '@tanstack/react-router';
import * as authApi from '@/features/users/api/auth';

import {
  useLogin,
  useRegister,
  useFetchUser,
  useChangePassword,
  useRequestPasswordReset,
  useConfirmPasswordReset,
  useUpdateUser,
  useDeleteUser,
  userKeys,
} from './use-auth';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@tanstack/react-router', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/features/users/api/auth', () => ({
  changePassword: vi.fn(),
  confirmPasswordReset: vi.fn(),
  deleteUser: vi.fn(),
  fetchUser: vi.fn(),
  loginUser: vi.fn(),
  refreshAccessToken: vi.fn(),
  registerUser: vi.fn(),
  requestPasswordReset: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock('@/lib/query-helpers', () => ({
  onMutationError: vi.fn(() => vi.fn()),
}));

describe('use-auth hooks', () => {
  let queryClient: QueryClient;
  let wrapper: React.FC<{ children: React.ReactNode }>;
  let navigateMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    navigateMock = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ navigate: navigateMock } as any);
  });

  describe('useLogin', () => {
    it('calls loginUser and navigates to home on success', async () => {
      vi.mocked(authApi.loginUser).mockResolvedValueOnce({ id: 1 } as any);

      const { result } = renderHook(() => useLogin(), { wrapper });

      await result.current.mutateAsync({
        email: 'test@test.com',
        password: 'password',
      });

      expect(authApi.loginUser).toHaveBeenCalledWith(
        { email: 'test@test.com', password: 'password' },
        expect.anything()
      );
      expect(navigateMock).toHaveBeenCalledWith({ to: '/' });
      expect(toast.success).toHaveBeenCalledWith('Login successful.');
    });
  });

  describe('useRegister', () => {
    it('calls registerUser and navigates to login on success', async () => {
      vi.mocked(authApi.registerUser).mockResolvedValueOnce({ id: 1 } as any);

      const { result } = renderHook(() => useRegister(), { wrapper });

      await result.current.mutateAsync({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@test.com',
        password1: 'pass',
        password2: 'pass',
      });

      expect(authApi.registerUser).toHaveBeenCalledWith(
        {
          firstName: 'Test',
          lastName: 'User',
          email: 'test@test.com',
          password1: 'pass',
          password2: 'pass',
        },
        expect.anything()
      );
      expect(navigateMock).toHaveBeenCalledWith({ to: '/login' });
      expect(toast.success).toHaveBeenCalledWith('Registered successfully.');
    });
  });

  describe('useFetchUser', () => {
    it('fetches user normally', async () => {
      const mockUser = { id: 1, email: 'test@test.com' };
      vi.mocked(authApi.fetchUser).mockResolvedValueOnce(mockUser as any);

      const { result } = renderHook(() => useFetchUser(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockUser);
      expect(authApi.fetchUser).toHaveBeenCalledTimes(1);
    });

    it('refreshes token and retries fetch if 401 error occurs', async () => {
      const error401 = { response: { status: 401 } };
      const mockUser = { id: 1, email: 'test@test.com' };

      vi.mocked(authApi.fetchUser)
        .mockRejectedValueOnce(error401) // First call fails with 401
        .mockResolvedValueOnce(mockUser as any); // Second call succeeds

      vi.mocked(authApi.refreshAccessToken).mockResolvedValueOnce({} as any);

      const { result } = renderHook(() => useFetchUser(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(authApi.refreshAccessToken).toHaveBeenCalledTimes(1);
      expect(authApi.fetchUser).toHaveBeenCalledTimes(2);
      expect(result.current.data).toEqual(mockUser);
    });

    it('throws error if a non-401 error occurs', async () => {
      const error500 = { response: { status: 500 } };
      vi.mocked(authApi.fetchUser).mockRejectedValueOnce(error500);

      const { result } = renderHook(() => useFetchUser(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(authApi.refreshAccessToken).not.toHaveBeenCalled();
      expect(result.current.error).toEqual(error500);
    });
  });

  describe('useChangePassword', () => {
    it('calls changePassword and toasts success message', async () => {
      vi.mocked(authApi.changePassword).mockResolvedValueOnce({
        detail: 'Changed!',
      });

      const { result } = renderHook(() => useChangePassword(), { wrapper });

      await result.current.mutateAsync({
        newPassword1: 'new',
        newPassword2: 'new',
      });

      expect(authApi.changePassword).toHaveBeenCalledWith(
        { newPassword1: 'new', newPassword2: 'new' },
        expect.anything()
      );
      expect(toast.success).toHaveBeenCalledWith('Changed!');
    });
  });

  describe('useRequestPasswordReset', () => {
    it('calls requestPasswordReset and toasts success message', async () => {
      vi.mocked(authApi.requestPasswordReset).mockResolvedValueOnce({
        detail: 'Check email',
      });

      const { result } = renderHook(() => useRequestPasswordReset(), {
        wrapper,
      });

      await result.current.mutateAsync({ email: 'test@test.com' });

      expect(authApi.requestPasswordReset).toHaveBeenCalledWith(
        { email: 'test@test.com' },
        expect.anything()
      );
      expect(toast.success).toHaveBeenCalledWith('Check email');
    });
  });

  describe('useConfirmPasswordReset', () => {
    it('calls confirmPasswordReset and navigates to login on success', async () => {
      vi.mocked(authApi.confirmPasswordReset).mockResolvedValueOnce({
        detail: 'Confirmed!',
      });

      const { result } = renderHook(() => useConfirmPasswordReset(), {
        wrapper,
      });

      await result.current.mutateAsync({
        uid: '1',
        token: 'token',
        newPassword1: 'new',
        newPassword2: 'new',
      });

      expect(authApi.confirmPasswordReset).toHaveBeenCalledWith(
        { uid: '1', token: 'token', newPassword1: 'new', newPassword2: 'new' },
        expect.anything()
      );
      expect(toast.success).toHaveBeenCalledWith('Confirmed!');
      expect(navigateMock).toHaveBeenCalledWith({ to: '/login' });
    });
  });

  describe('useUpdateUser', () => {
    it('updates user in API and updates cache data', async () => {
      const updatedUser = { id: 1, email: 'updated@test.com' };
      vi.mocked(authApi.updateUser).mockResolvedValueOnce(updatedUser as any);

      const { result } = renderHook(() => useUpdateUser(), { wrapper });

      await result.current.mutateAsync({ email: 'updated@test.com' });

      expect(authApi.updateUser).toHaveBeenCalledWith(
        { email: 'updated@test.com' },
        expect.anything()
      );
      expect(toast.success).toHaveBeenCalledWith(
        'Profile updated successfully.'
      );

      const cachedData = queryClient.getQueryData(userKeys.me);
      expect(cachedData).toEqual(updatedUser);
    });
  });

  describe('useDeleteUser', () => {
    it('deletes user from API and clears cache data', async () => {
      // Setup initial cache
      queryClient.setQueryData(userKeys.me, { id: 1, email: 'test@test.com' });
      vi.mocked(authApi.deleteUser).mockResolvedValueOnce({} as any);

      const { result } = renderHook(() => useDeleteUser(), { wrapper });

      await result.current.mutateAsync();

      expect(authApi.deleteUser).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith(
        'Profile deleted successfully.'
      );

      const cachedData = queryClient.getQueryData(userKeys.me);
      expect(cachedData).toBeNull();
    });
  });
});
