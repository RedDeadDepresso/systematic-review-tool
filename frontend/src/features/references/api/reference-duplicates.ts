import api from '@/api/client';

/* ------------------ DETECT DUPLICATES ------------------ */
export const detectDuplicateReferences = async (reviewId: number) => {
  const res = await api.post('/reference-duplicates/detect/', null, {
    params: { review: reviewId },
  });
  return res.data;
};

/* ------------------ FETCH CURRENT DUPLICATE ------------------ */
export const fetchDuplicateReferences = async (reviewId: number) => {
  const res = await api.get('/reference-duplicates/', {
    params: { review: reviewId },
  });
  return res.data;
};

/* ------------------ RESOLVE DUPLICATE ------------------ */
export const resolveDuplicateReferences = async (
  referenceDuplicateId: number,
  reviewId: number,
  selection: 1 | 2 | 3
) => {
  const res = await api.post(
    `/reference-duplicates/${referenceDuplicateId}/resolve/`,
    { selection },
    {
      params: { review: reviewId },
    }
  );
  return res.data;
};

export interface AutoResolvePreview {
  totalUnresolved: number;
  wouldAutoResolve: number;
  confidenceThreshold: number;
  remainingAfter: number;
}

export interface AutoResolveRequest {
  confidenceThreshold?: number;
  createPairsFirst?: boolean;
  textNormalization?: boolean;
  preferredSearchMethodId?: number | null;
  criteria?: {
    authors: boolean;
    title: boolean;
    journal: boolean;
    year: boolean;
    pages: boolean;
    doi: boolean;
  };
}

export interface AutoResolveResponse {
  message: string;
  taskId: string;
  confidenceThreshold: number;
  status: string;
}

// Preview how many pairs would be auto-resolved
export const getAutoResolvePreview = async (
  reviewId: number,
  confidenceThreshold: number = 0.9
) => {
  const res = await api.get<AutoResolvePreview>(
    `/reviews/${reviewId}/auto_resolve_preview/`,
    {
      params: { confidence_threshold: confidenceThreshold },
    }
  );

  return {
    totalUnresolved: res.data.totalUnresolved,
    wouldAutoResolve: res.data.wouldAutoResolve,
    confidenceThreshold: res.data.confidenceThreshold,
    remainingAfter: res.data.remainingAfter,
  };
};

// Start auto-resolution
export const autoResolveDuplicates = async (
  reviewId: number,
  settings: AutoResolveRequest
) => {
  const res = await api.post<AutoResolveResponse>(
    `/reviews/${reviewId}/auto_resolve_duplicates/`,
    {
      confidence_threshold: settings.confidenceThreshold,
      create_pairs_first: settings.createPairsFirst,
    }
  );

  return {
    message: res.data.message,
    taskId: res.data.taskId,
    confidenceThreshold: res.data.confidenceThreshold,
    status: res.data.status,
  };
};
