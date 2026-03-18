import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  changePassword,
  confirmPasswordReset,
  deleteUser,
  fetchUser,
  loginUser,
  refreshAccessToken,
  registerUser,
  requestPasswordReset,
  updateUser,
} from '@/features/users/api/auth';
import { useRouter } from '@tanstack/react-router';
import { toast } from 'sonner';
import { onMutationError } from '@/lib/query-helpers';

export const userKeys = {
  me: ['user'] as const,
};

export const useLogin = () => {
  const router = useRouter();
  return useMutation({
    mutationFn: loginUser,
    onSuccess: () => {
      router.navigate({ to: '/' });
      toast.success('Login successful.');
    },
  });
};

export const useRegister = () => {
  const router = useRouter();
  return useMutation({
    mutationFn: registerUser,
    onSuccess: () => {
      router.navigate({ to: '/login' });
      toast.success('Registered successfully.');
    },
  });
};

export function useFetchUser() {
  return useQuery({
    queryKey: userKeys.me,
    queryFn: async () => {
      try {
        return await fetchUser();
      } catch (error: any) {
        if (error.response?.status === 401) {
          await refreshAccessToken();
          return await fetchUser();
        }
        throw error;
      }
    },
    retry: false,
  });
}

export const useChangePassword = () =>
  useMutation({
    mutationFn: changePassword,
    onSuccess: (data) =>
      toast.success(data.detail || 'Password changed successfully.'),
    onError: onMutationError('change password'),
  });

export const useRequestPasswordReset = () =>
  useMutation({
    mutationFn: requestPasswordReset,
    onSuccess: (data) =>
      toast.success(
        data.detail || 'Password reset instructions sent to your email.'
      ),
    onError: onMutationError('request reset password'),
  });

export const useConfirmPasswordReset = () => {
  const router = useRouter();
  return useMutation({
    mutationFn: confirmPasswordReset,
    onSuccess: (data) => {
      toast.success(data.detail || 'Password reset successful.');
      router.navigate({ to: '/login' });
    },
    onError: onMutationError('reset password'),
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateUser,
    onSuccess: (data) => {
      toast.success('Profile updated successfully.');
      queryClient.setQueryData(userKeys.me, data);
    },
    onError: onMutationError('edit profile'),
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      toast.success('Profile deleted successfully.');
      queryClient.setQueryData(userKeys.me, null);
    },
    onError: onMutationError('delete profile'),
  });
};
