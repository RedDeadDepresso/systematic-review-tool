import api from "./axios";

export const registerUser = async (data: {
	first_name: string;
	last_name: string;
	email: string;
	password: string;
	confirm_password: string;
}) => {
	const res = await api.post("/auth/register/", data);
	return res.data;
};

export async function loginUser(data: { email: string; password: string }) {
	const res = await api.post("/auth/login/", data);
	localStorage.setItem("access_token", res.data.access);
	localStorage.setItem("refresh_token", res.data.refresh);
	return res.data;
};

export async function getCurrentUser() {
	const token = localStorage.getItem("access_token");
	if (!token) throw new Error("Not authenticated");

	const res = await api.get("/auth/user/", {
		headers: { Authorization: `Bearer ${token}` },
	});
	return res.data;
}

export async function refreshAccessToken() {
	const refresh = localStorage.getItem("refresh_token");
	if (!refresh) {
		window.location.href = "/login";
		throw new Error("No refresh token");
	}

	try {
		const res = await api.post("/auth/refresh/", { refresh });
		localStorage.setItem("access_token", res.data.access);
		api.defaults.headers.common["Authorization"] = `Bearer ${res.data.access}`;
		return res.data;
	} catch (error) {
		localStorage.removeItem("access_token");
		localStorage.removeItem("refresh_token");
		window.location.href = "/login";
		throw new Error("Token refresh failed");
	}
};

export function logoutUser() {
	localStorage.removeItem("access_token");
	localStorage.removeItem("refresh_token");
	window.location.href = "/login";
}
