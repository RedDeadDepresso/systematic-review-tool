import { useMutation, useQuery } from "@tanstack/react-query";
import { getCurrentUser, loginUser, registerUser } from "../api/auth";
import { useRouter } from "@tanstack/react-router";

export const useLogin = () => {
	const router = useRouter();
	return useMutation({
		mutationFn: loginUser,
		onSuccess: () => {
			router.navigate({ to: "/" });
		},
	});
};

export const useRegister = () => {
	const router = useRouter();
	return useMutation({
		mutationFn: registerUser,
		onSuccess: () => {
			router.navigate({ to: "/login" });
		},
	});
};

export function useAuth() {
  return useQuery({
    queryKey: ["currentUser"],
    queryFn: getCurrentUser,
    retry: false,
  });
}