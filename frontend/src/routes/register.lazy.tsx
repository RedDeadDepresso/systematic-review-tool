// src/routes/register.tsx
import { RegisterForm } from "@/components/register-form";
import { createLazyFileRoute } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/register")({
  component: RegisterPage,
});

function RegisterPage() {
  return (
    <RegisterForm />
  );
}
