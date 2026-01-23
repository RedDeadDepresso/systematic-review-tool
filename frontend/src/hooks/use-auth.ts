import { useMutation, useQuery } from '@tanstack/react-query';
import {
  fetchUser,
  loginUser,
  refreshAccessToken,
  registerUser,
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
