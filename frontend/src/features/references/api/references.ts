import type {
  Reference,
  ReferencePDFMapping,
} from '@/features/references/types/references';
import api from '../../../api/axios';
import type { Keyword } from '@/features/references/types/keywords';

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
  publicationTypes?: string[];
  publicationYears?: number[];
  hasFile?: boolean;
  assigneeIds?: (number | null)[];
  duplicateStatuses?: string[];
  searchQuery?: string;
};

export type LabelCount = {
  id: number;
  name: string;
  count: number;
};

export type PublicationType = {
  publicationType: string;
  count: number;
};

export type PublicationYear = {
  year: number;
  count: number;
};

export type FileCounts = {
  withFile: number;
  withoutFile: number;
};

export type Assignee = {
  Id: number | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  count: number;
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

export type FetchReviewDataParamsResponse = {
  references: Reference[];
  totalCount: number;
  filteredCount: number;
  searchMethods: SearchMethod[];
  keywords: Keyword[];
  duplicateStatusCounts: DuplicateStatusCounts;
  labels: LabelCount[];
  publicationTypes: PublicationType[];
  publicationYears: PublicationYear[];
  fileCounts: FileCounts;
  assignees: Assignee[];
};

const paramsToSnakeCase = (params: FetchReviewDataParams) => {
  return {
    review: params.review,
    search_method_ids: params.searchMethodIds,
    include_keywords: params.includeKeywords,
    exclude_keywords: params.excludeKeywords,
    label_ids: params.labelIds,
    publication_types: params.publicationTypes,
    publication_years: params.publicationYears,
    has_file: params.hasFile,
    assignee_ids: params.assigneeIds,
    duplicate_statuses: params.duplicateStatuses,
    search: params.searchQuery,
  };
};

export const fetchReviewData = async (
  params: FetchReviewDataParams
): Promise<FetchReviewDataParamsResponse> => {
  const res = await api.get('/review-data/', {
    params: paramsToSnakeCase(params),
  });
  return res.data;
};

export const fetchScreening = async (
  params: FetchReviewDataParams
): Promise<FetchReviewDataParamsResponse> => {
  const res = await api.get('/screening/', {
    params: paramsToSnakeCase(params),
  });
  return res.data;
};

export const fetchScreeningFullText = async (
  params: FetchReviewDataParams
): Promise<FetchReviewDataParamsResponse> => {
  const res = await api.get('/screening-full-text/', {
    params: paramsToSnakeCase(params),
  });
  return res.data;
};

export const downloadBib = async (
  url: string,
  filename: string,
  params?: FetchReviewDataParams
) => {
  const res = await api.get(url, {
    params: params ? paramsToSnakeCase(params) : undefined,
    responseType: 'blob', // IMPORTANT for files
  });

  const blob = new Blob([res.data]);
  const downloadUrl = window.URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  link.remove();
  window.URL.revokeObjectURL(downloadUrl);
};

export const exportReviewData = (
  filename: string,
  params?: FetchReviewDataParams
) => downloadBib('/review-data/export/', filename, params);

export const exportScreening = (
  filename: string,
  params?: FetchReviewDataParams
) => downloadBib('/screening/export/', filename, params);

export const exportScreeningFullText = (
  filename: string,
  params?: FetchReviewDataParams
) => downloadBib('/screening-full-text/export/', filename, params);

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

/* ------------------ ASSIGN REFERENCES TO USER ------------------- */
export interface AssignReferencesPayload {
  review: number;
  referenceIds: number[];
  mode: 'assign' | 'remove' | 'split_equally';
  assigneeId?: number;
}

export const assignReferences = async (payload: AssignReferencesPayload) => {
  const response = await api.post('/references/assign/', payload);
  return response.data;
};
