export type Review = {
	title: string;
	description: string;
	is_active: boolean;
	reference_count: number;
};

export type ReviewRow = {
	title: string;
	date_created: string;
	owner: string;
	reference_count: number;
	id: number;
};
