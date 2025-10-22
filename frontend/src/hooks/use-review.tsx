import {
	createReview,
	editReview,
	fetchReview,
	fetchReviews,
	UploadReviewReferences,
} from "@/api/review";
import type { Review } from "@/types/review";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export const useFetchReview = (id: number | string) => {
	return useQuery({
		queryKey: ["reviews", id],
		queryFn: () => fetchReview(id),
	});
};

export const useEditReview = () => {
	return useMutation({
		mutationFn: editReview,
	});
};

export const useUploadReviewReferences = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: UploadReviewReferences,
		onSuccess: (
			{ uploaded_reference_count }: { uploaded_reference_count: number },
			{ reviewId }: { reviewId: number; formData: FormData }
		) => {
			toast.success(`${uploaded_reference_count} References have been uploaded.`);
			queryClient.setQueryData(["reviews", reviewId], (oldData: Review) => {
				if (!oldData) return oldData;
				return {
					...oldData,
					reference_count: oldData.reference_count + uploaded_reference_count,
				};
			});
		},
	});
};
