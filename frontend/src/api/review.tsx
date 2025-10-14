import api from "./axios";

export const createReview = async (data: {
	title: string;
	description: string;
}) => {
	const res = await api.post("/reviews/", data);
	return res.data;
};
