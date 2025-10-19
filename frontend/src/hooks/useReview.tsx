import { createReview, editReview, fetchReviews } from "@/api/review";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

export const useCreateReview = () => {
	return useMutation({
		mutationFn: createReview,
		onSuccess: () => {
			toast.success("Review has been created.");
		},
	});
};

export const useFetchReviews = (params: { is_active: boolean }) => {
	return useQuery({
		queryKey: ["reviews", params],
		queryFn: () => fetchReviews(params),
	});
};

export const useEditReview = () => {
	return useMutation({
		mutationFn: editReview,
	});
};
