// src/routes/login.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useLogin } from "../hooks/useAuth";
import { useState } from "react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
}
