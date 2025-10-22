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
import { useUploadReviewReferences } from "@/hooks/useReview";
import { useState, type ChangeEvent } from "react";

export function UploadReferencesForm({ reviewId }: { reviewId: number | string }) {
	const UploadReviewReferences = useUploadReviewReferences();
	const [file, setFile] = useState<File | null>(null);

	const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
		if (e.target.files) setFile(e.target.files[0]);
	};

	const handleUpload = () => {
		if (!file) return;

		const formData = new FormData();
		formData.append("file", file);

		UploadReviewReferences.mutate({ reviewId: reviewId, formData: formData });
	};

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button className="w-full bg-indigo-100 text-indigo-700 hover:bg-indigo-200">
					Add References
				</Button>
			</DialogTrigger>
			<DialogContent className="w-full sm:max-w-2xl">
				<DialogHeader className="mb-4">
					<DialogTitle>Upload References</DialogTitle>
					<DialogDescription>
						Upload references. Click confirm when you&apos;re done.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4">
					<div className="grid gap-3">
						<Label htmlFor="file">Bib file</Label>
						<Input
							id="file"
							name="file"
							type="file"
							onChange={handleFileChange}
							disabled={UploadReviewReferences.isPending}
							accept=".bib"
						/>
					</div>
				</div>
				<DialogFooter className="mt-4">
					<DialogClose asChild>
						<Button variant="outline">Cancel</Button>
					</DialogClose>
					<Button
						type="submit"
						disabled={UploadReviewReferences.isPending}
						onClick={handleUpload}
					>
						Confirm
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
