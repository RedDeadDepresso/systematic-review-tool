import { createFileRoute, redirect } from "@tanstack/react-router";
import { ReviewTable } from "@/components/review-table";
import { AppLayout } from "@/components/app-layout";
import { useFetchReviews } from "@/hooks/useReview";

export const Route = createFileRoute("/")({
	component: IndexPage,
	beforeLoad: async () => {
		const token = localStorage.getItem("access_token");
		if (!token) throw redirect({ to: "/login" });
	},
});

function IndexPage() {
	const { data: activeReviews, isLoading: isLoadingActive } = useFetchReviews({
		is_active: true,
	});
	const { data: inactiveReviews, isLoading: isLoadingInactive } = useFetchReviews({
		is_active: false,
	});

	return (
		<AppLayout pageTitle="Home" isAuthenticated={true}>
			<h2 className="text-2xl font-semibold mb-4 text-foreground">Active Reviews</h2>
			{!isLoadingActive && <ReviewTable data={activeReviews} isActive={true} />}
			<h2 className="text-2xl font-semibold mb-4 text-foreground">Inactive Reviews</h2>
			{!isLoadingInactive && <ReviewTable data={inactiveReviews} isActive={false} />}
		</AppLayout>
	);
}
