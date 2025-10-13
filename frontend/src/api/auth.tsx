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

export const loginUser = async (data: { username: string; password: string }) => {
	const res = await api.post("/auth/login/", data);
	localStorage.setItem("access_token", res.data.access);
	localStorage.setItem("refresh_token", res.data.refresh);
	return res.data;
};
