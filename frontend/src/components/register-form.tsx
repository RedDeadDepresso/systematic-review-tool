import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useRegister } from "@/hooks/useAuth";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { errorMessage } from "./error-message";


export function RegisterForm() {
	const register = useRegister();
	const [form, setForm] = useState({
		first_name: "",
		last_name: "",
		email: "",
		password: "",
		confirm_password: "",
	});

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
		setForm({ ...form, [e.target.name]: e.target.value });

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		register.mutate(form);
	};

	return (
		<Card className="w-full max-w-2xl mx-auto">
			<CardHeader>
				<CardTitle>Create an account</CardTitle>
				<CardDescription>
					Enter your information below to create your account
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit}>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="first_name">First Name</FieldLabel>
							<Input
								id="last_name"
								name="first_name"
								type="text"
								placeholder="John"
								required
								onChange={handleChange}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="last_name">Last Name</FieldLabel>
							<Input
								id="last_name"
								name="last_name"
								type="text"
								placeholder="Doe"
								required
								onChange={handleChange}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="email">Email</FieldLabel>
							<Input
								id="email"
								name="email"
								type="email"
								placeholder="m@example.com"
								required
								onChange={handleChange}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="password">Password</FieldLabel>
							<Input
								id="password"
								name="password"
								type="password"
								required
								onChange={handleChange}
							/>
							<FieldDescription>Must be at least 8 characters long.</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor="confirm_password">Confirm Password</FieldLabel>
							<Input
								id="confirm_password"
								name="confirm_password"
								type="password"
								required
								onChange={handleChange}
							/>
							<FieldDescription>Please confirm your password.</FieldDescription>
						</Field>
						<FieldGroup>
							<Field>
								<Button type="submit">Create Account</Button>
								<FieldDescription className="px-6 text-center">
									Already have an account? <Link to="/login">Sign in</Link>
								</FieldDescription>
							</Field>
						</FieldGroup>
						{register.error && errorMessage(register.error)}
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}
