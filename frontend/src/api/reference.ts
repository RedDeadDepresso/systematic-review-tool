import type { Label, Reference, ReferencePDFMapping } from '@/types/reference';
import api from './axios';
import type { Keyword } from '@/types/keyword';

/* ------------------ FETCH REFERENCES (LIST) ------------------ */
export const fetchReferences = async (reviewId: number) => {
  const res = await api.get('/references/', {
    params: { review: reviewId },
  });
  return res.data;
};

export type FetchReviewDataParams = {
  review: number;
  searchMethodIds?: number[];
  includeKeywords?: string[];
  excludeKeywords?: string[];
  labelIds?: number[];
  duplicateStatuses?: string[];
  searchQuery?: string;
};

export type SearchMethod = {
  id: number;
  name: string;
  count: number;
};

export type DuplicateStatusCounts = {
  Unresolved: number;
  Deleted: number;
  'Not Duplicate': number;
  Resolved: number;
};

type FetchReviewDataParamsResponse = {
  references: Reference[];
  totalCount: number;
  filteredCount: number;
  searchMethods: SearchMethod[];
  keywords: Keyword[];
  duplicateStatusCounts: DuplicateStatusCounts;
  labels: Label[];
};

export const fetchReviewData = async (
  params: FetchReviewDataParams
): Promise<FetchReviewDataParamsResponse> => {
  const res = await api.get('/review-data/', {
    params: {
      review: params.review,
      search_method_ids: params.searchMethodIds,
      include_keywords: params.includeKeywords,
      exclude_keywords: params.excludeKeywords,
      label_ids: params.labelIds,
      duplicate_statuses: params.duplicateStatuses,
      search: params.searchQuery,
    },
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
