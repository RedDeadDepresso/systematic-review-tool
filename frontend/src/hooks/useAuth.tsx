// src/hooks/useAuth.ts
import { useMutation } from "@tanstack/react-query";
import { loginUser, registerUser } from "../api/auth";
import { useRouter } from "@tanstack/react-router";

export const useLogin = () => {
	const router = useRouter();
	return useMutation({
		mutationFn: loginUser,
		onSuccess: () => {},
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
