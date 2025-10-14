import { createReview } from "@/api/review";
import { useMutation } from "@tanstack/react-query";

export const useCreateReview = () => {
	return useMutation({
		mutationFn: createReview,
		onSuccess: () => {
            console.log("Review created successfully");
		},
	});
};