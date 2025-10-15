import { useMutation, useQuery } from "@tanstack/react-query";
import { getCurrentUser, loginUser, refreshAccessToken, registerUser } from "../api/auth";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";

export const useLogin = () => {
	const router = useRouter();
	return useMutation({
		mutationFn: loginUser,
		onSuccess: () => {
			router.navigate({ to: "/" });
			toast.success("Login successful.")
		},
	});
};

export const useRegister = () => {
	const router = useRouter();
	return useMutation({
		mutationFn: registerUser,
		onSuccess: () => {
			router.navigate({ to: "/login" });
			toast.success("Registered successfully.")
		},
	});
};

export function useCurrentUser() {
	return useQuery({
		queryKey: ["currentUser"],
		queryFn: async () => {
			try {
				return await getCurrentUser();
			} catch (error: any) {
				if (error.response?.status === 401) {
					await refreshAccessToken();
					return await getCurrentUser();
				}
				throw error;
			}
		},
		retry: false,
	});
}