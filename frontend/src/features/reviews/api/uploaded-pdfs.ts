import type { UploadedPDF } from '@/features/references/types/uploaded-pdfs';
import api from '../../../api/axios';

export async function fetchUploadedPDFs(
  reviewId: number
): Promise<UploadedPDF[]> {
  const response = await api.get<UploadedPDF[]>('/uploaded-pdfs/', {
    params: { review: reviewId },
  });
  return response.data;
}

export async function uploadPDF(payload: {
  file: File;
  review: number;
}): Promise<UploadedPDF> {
  const formData = new FormData();
  formData.append('file', payload.file);
  formData.append('review', payload.review.toString());

  const response = await api.post<UploadedPDF>('/uploaded-pdfs/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}

export async function deleteUploadedPDF(id: number): Promise<void> {
  await api.delete(`/uploaded-pdfs/${id}/`);
}
