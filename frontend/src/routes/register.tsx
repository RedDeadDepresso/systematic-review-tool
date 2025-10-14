import { Navbar } from "@/components/navbar";
import { RegisterForm } from "@/components/register-form";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/register")({
	component: RegisterPage,
	beforeLoad: async () => {
		const token = localStorage.getItem("access_token");
		if (token) throw redirect({ to: "/" });
	},
});

function RegisterPage() {
	return (
		<>
			<Navbar />
			<RegisterForm />;
		</>
	);
}
