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
} from '../api/auth';
import { useRouter } from '@tanstack/react-router';
import { toast } from 'sonner';

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
    queryKey: ['user'],
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

/* ------------------ CHANGE PASSWORD ------------------ */
export const useChangePassword = () => {
  return useMutation({
    mutationFn: changePassword,
    onSuccess: (data) => {
      toast.success(data.detail || 'Password changed successfully.');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to change password.');
    },
  });
};

/* ------------------ REQUEST PASSWORD RESET ------------------ */
export const useRequestPasswordReset = () => {
  return useMutation({
    mutationFn: requestPasswordReset,
    onSuccess: (data) => {
      toast.success(
        data.detail || 'Password reset instructions sent to your email.'
      );
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.detail || 'Failed to send reset email.'
      );
    },
  });
};

/* ------------------ CONFIRM PASSWORD RESET ------------------ */
export const useConfirmPasswordReset = () => {
  const router = useRouter();

  return useMutation({
    mutationFn: confirmPasswordReset,
    onSuccess: (data) => {
      toast.success(data.detail || 'Password reset successful.');
      router.navigate({ to: '/login' });
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.detail ||
          'Failed to reset password. Link may be expired.'
      );
    },
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateUser,
    onSuccess: (data) => {
      toast.success('Profile updated successfully.');
      queryClient.setQueryData(['user'], data);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to Edit Profile.');
    },
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteUser,
    onSuccess: (_) => {
      toast.success('Profile deleted successfully.');
      queryClient.setQueryData(['user'], null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to Delete Profile.');
    },
  });
};
