import type { ReferencePDFMapping } from '@/types/reference';
import api from './axios';

/* ------------------ FETCH REFERENCES (LIST) ------------------ */
export const fetchReferences = async (reviewId: number) => {
  const res = await api.get('/references/', {
    params: { review: reviewId },
  });
  return res.data;
};

/* ------------------ FETCH SINGLE REFERENCE ------------------ */
export const fetchReference = async (referenceId: number) => {
  const res = await api.get(`/references/${referenceId}/`);
  return res.data;
};

/* ------------------ UPDATE REFERENCE STATUS ------------------ */
export const updateReference = async ({
  referenceId,
  payload,
}: {
  reviewId: number;
  referenceId: number;
  payload: {
    status: 'Undecided' | 'Excluded' | 'Maybe' | 'Included';
  };
}) => {
  const res = await api.patch(`/references/${referenceId}/`, payload);
  return res.data;
};

/* ------------------ UPLOAD / UPDATE FILE ------------------ */
export const uploadReferenceFile = async (payload: {
  reviewId: number;
  referenceId: number;
  formData: FormData;
}) => {
  const res = await api.patch(
    `/references/${payload.referenceId}/`,
    payload.formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    }
  );
  return res.data;
};

/* ------------------ ATTACH PDFS TO REFERENCES ------------------ */
export async function attachPDFsToReferences(payload: {
  reviewId: number;
  mappings: ReferencePDFMapping[];
}) {
  const res = await api.post('/references/attach-pdfs/', {
    mappings: payload.mappings,
  });
  return res.data;
}
