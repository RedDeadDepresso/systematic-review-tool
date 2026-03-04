import type {
  OpinionStatus,
  Reference,
  ReferencePDFMapping,
} from '@/features/references/types/references';
import api from '@/api/client';
import type { Keyword } from '@/features/references/types/keywords';

/* ------------------ FETCH REFERENCES (LIST) ------------------ */
export type OrderingField =
  | 'title'
  | '-title'
  | 'authors'
  | '-authors'
  | 'publication_date'
  | '-publication_date';

// ─── Request params ────────────────────────────────────────────────────────────

export interface FetchReviewDataParams {
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
  // Pagination
  limit?: number;
  offset?: number;
  // Sort — matches Django OrderingFilter field names
  ordering?: OrderingField;
  endpoint?: string;
}

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

export type FetchScreeningParams = {
  opinionStatuses?: OpinionStatus[];
} & FetchReviewDataParams;

export type FetchExtractionParams = {
  isExtractionCompleted?: boolean;
} & FetchReviewDataParams;

export interface FetchReferencesResponse<T extends Reference = Reference> {
  references: T[];
  totalCount: number;
  filteredCount: number;
  count: number;
  next: string | null;
  previous: string | null;
  offset: number;
  limit: number;
}

/**
 * Sidebar filter aggregations — fetched once, not re-fetched on sort/page.
 */
export interface FetchFilterCountsResponse {
  searchMethods: SearchMethod[];
  keywords: Keyword[];
  duplicateStatusCounts: DuplicateStatusCounts;
  labels: LabelCount[];
  publicationTypes: PublicationType[];
  publicationYears: PublicationYear[];
  fileCounts: FileCounts;
  assignees: Assignee[];
  completedCount?: number;
  inProgressCount?: number;
}

const paramsToSnakeCase = (
  params: FetchReviewDataParams | FetchScreeningParams | FetchExtractionParams
) => ({
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
  opinion_statuses:
    'opinionStatuses' in params ? params.opinionStatuses : undefined,
  // Pagination & ordering — passed through as-is (already snake_case)
  is_extraction_completed:
    'isExtractionCompleted' in params
      ? params.isExtractionCompleted
      : undefined,
  // Pagination & ordering — passed through as-is (already snake_case)
  limit: params.limit,
  offset: params.offset,
  ordering: params.ordering,
});

// ─── API functions ─────────────────────────────────────────────────────────────

// ─── Endpoint constants ────────────────────────────────────────────────────────

export const ENDPOINTS = {
  reviewData: '/review-data/',
  screening: '/screening/',
  screeningFullText: '/screening-full-text/',
  extraction: '/extraction/',
} as const;

export type ReferencesEndpoint = (typeof ENDPOINTS)[keyof typeof ENDPOINTS];

// ─── Single generic fetch ──────────────────────────────────────────────────────
export const fetchReferences = async (
  params: FetchReviewDataParams | FetchScreeningParams,
  endpoint: ReferencesEndpoint | string = ENDPOINTS.reviewData
): Promise<FetchReferencesResponse> => {
  const res = await api.get(endpoint, { params: paramsToSnakeCase(params) });
  return res.data;
};

/**
 * Filter counts are endpoint-specific: /screening/filter-counts/ applies
 * the stage filter server-side so counts differ from /review-data/.
 */
export const fetchFilterCounts = async (
  reviewId: number,
  endpoint: ReferencesEndpoint | string = ENDPOINTS.reviewData
): Promise<FetchFilterCountsResponse> => {
  const res = await api.get(`${endpoint}filter-counts/`, {
    params: { review: reviewId },
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

export const exportReferences = (
  filename: string,
  endpoint: string,
  params?: FetchReviewDataParams
) => downloadBib(`${endpoint}export/`, filename, params);

// Export aliases — keep so call sites don't need to change yet
export const exportReviewData = (f: string, p?: FetchReviewDataParams) =>
  exportReferences(f, ENDPOINTS.reviewData, p);
export const exportScreening = (f: string, p?: FetchScreeningParams) =>
  exportReferences(f, ENDPOINTS.screening, p);
export const exportScreeningFullText = (f: string, p?: FetchScreeningParams) =>
  exportReferences(f, ENDPOINTS.screeningFullText, p);
export const exportExtraction = (f: string, p?: FetchScreeningParams) =>
  exportReferences(f, ENDPOINTS.extraction, p);

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

export const autoMatch = async (payload: {
  reviewId: number;
  referenceIds: number[];
}) => {
  const res = await api.post<{ matched: number; unmatched: number }>(
    '/references/auto-match/',
    payload
  );
  return res.data;
};
