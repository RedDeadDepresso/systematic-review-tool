import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateReview } from "@/hooks/use-review";
import { IconPlus } from "@tabler/icons-react";
import { useState } from "react";

export function ReviewForm() {
	const review = useCreateReview();
	const [form, setForm] = useState({ title: "", description: "" });

	const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
		setForm({ ...form, [e.target.name]: e.target.value });

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		review.mutate(form);
	};

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm">
					<IconPlus />
					<span className="hidden lg:inline">Create Review</span>
				</Button>
			</DialogTrigger>
			<DialogContent className="w-full sm:max-w-2xl">
				<form onSubmit={handleSubmit}>
					<DialogHeader className="mb-4">
						<DialogTitle>Create Review</DialogTitle>
						<DialogDescription>
							Create a review here. Click save when you&apos;re done.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4">
						<div className="grid gap-3">
							<Label htmlFor="title">Title</Label>
							<Input
								id="title"
								name="title"
								placeholder="Review title has to be unique"
								onChange={handleChange}
								disabled={review.isPending}
							/>
						</div>
						<div className="grid gap-3">
							<Label htmlFor="description">Description</Label>
							<Textarea
								id="description"
								name="description"
								placeholder="Describe your review!"
								rows={8}
								onChange={handleChange}
								disabled={review.isPending}
							/>
						</div>
					</div>
					<DialogFooter className="mt-4">
						<DialogClose asChild>
							<Button variant="outline">Cancel</Button>
						</DialogClose>
						<Button type="submit" disabled={review.isPending}>
							Save
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
