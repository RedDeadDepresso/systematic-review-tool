import { createFileRoute, redirect } from "@tanstack/react-router";
import { DataTable } from "@/components/data-table";
import { AppLayout } from "@/components/app-layout";

export const Route = createFileRoute("/")({
	component: IndexPage,
	beforeLoad: async () => {
		const token = localStorage.getItem("access_token");
		if (!token) throw redirect({ to: "/login" });
	},
});

function IndexPage() {
	return (
		<AppLayout pageTitle="Home" isAuthenticated={true}>
			<DataTable data={[]} />
		</AppLayout>
	);
}
