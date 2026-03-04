import { useCallback, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppLayoutContext } from '@/context/app-layout-context';
import { useFetchReview } from '@/features/reviews/hooks/use-reviews';
import { useDeleteSearchMethod } from '@/features/reviews/hooks/use-search-methods';
import { useDeleteLabel } from '@/features/references/hooks/use-labels';
import { useReferenceUI } from '@/features/references/hooks/use-reference-ui';
import { useKeywordManagement } from '@/features/references/hooks/use-keyword-management';
import { useFileUpload } from '@/features/references/hooks/use-reference-file-upload';
import { useBulkUpsertReferenceOpinions } from '@/features/references/hooks/use-reference-opinions';
import { useScreeningStats } from '@/features/reviews/hooks/use-screening-stats';
import type {
  ArticleViewLayout,
  OpinionStatus,
  Reference,
} from '@/features/references/types/references';
import type {
  LabelCount,
  SearchMethod,
  FetchReviewDataParams,
  ReferencesEndpoint,
} from '@/features/references/api/references';
import type { useReferenceFilters } from '@/features/references/hooks/use-reference-filters';
import type { ExportType } from '@/features/references/components/references/references-table-top-header';

export interface ScreeningPageConfig {
  pageTitle: string;
  defaultLayout: ArticleViewLayout;
  opinionStage: 'screening' | 'full-text';
  /** The endpoint this route fetches from — used to build matching query keys. */
  endpoint: ReferencesEndpoint;
  exportFilename: (reviewId: number, filtered: boolean) => string;
}

export function useScreeningPage(
  reviewId: number,
  config: ScreeningPageConfig,
  filters: ReturnType<typeof useReferenceFilters>,
  references: Reference[]
) {
  const { setPageTitle, setIsAuthenticated, setScroll } =
    useContext(AppLayoutContext);
  const queryClient = useQueryClient();

  useScreeningStats({ reviewId, autoTrack: true });

  useEffect(() => {
    setPageTitle(config.pageTitle);
    setIsAuthenticated(true);
    setScroll(false);
  }, []);

  const [articleViewLayout, setArticleViewLayout] = useState<ArticleViewLayout>(
    config.defaultLayout
  );
  const [includeHighlightEnabled, setIncludeHighlightEnabled] = useState(true);
  const [excludeHighlightEnabled, setExcludeHighlightEnabled] = useState(true);

  const fetchReview = useFetchReview(reviewId);
  const userRole = fetchReview.data?.userRole ?? 'Viewer';
  const userMemberId = fetchReview.data?.userMemberId ?? undefined;

  const invalidateQuery = useCallback(() => {
    // Match the key shape set by useFetchReferences:
    // ['reviews', reviewId, endpoint, 'references', ...params]
    // Partial match on the first three segments invalidates all pages/params.
    queryClient.invalidateQueries({
      queryKey: ['reviews', reviewId, config.endpoint],
    });
  }, [queryClient, reviewId, config.endpoint]);

  const deleteSearchMethod = useDeleteSearchMethod(reviewId);
  const deleteLabel = useDeleteLabel();

  const handleDeleteLabel = useCallback(
    (label: LabelCount) =>
      deleteLabel.mutate(label.id, { onSuccess: invalidateQuery }),
    [deleteLabel, invalidateQuery]
  );

  const handleDeleteSearchMethod = useCallback(
    (sm: SearchMethod) =>
      deleteSearchMethod.mutate(sm.id, { onSuccess: invalidateQuery }),
    [deleteSearchMethod, invalidateQuery]
  );

  const ui = useReferenceUI(references, userMemberId);

  const keywords = useKeywordManagement(
    reviewId,
    includeHighlightEnabled,
    excludeHighlightEnabled,
    filters.includeKeywords,
    filters.excludeKeywords,
    (kws) => filters.setIncludeKeywords(kws),
    (kws) => filters.setExcludeKeywords(kws)
  );

  const fileUpload = useFileUpload(
    reviewId,
    invalidateQuery,
    ui.selectedReferenceIds,
    ui.highlightedReferenceId,
    ui.references
  );

  const bulkUpsert = useBulkUpsertReferenceOpinions();

  const handleOpinionApplied = useCallback(
    async (
      referenceIds: number[],
      status: OpinionStatus,
      reasonId?: number | null
    ) => {
      const shouldNavigateNext =
        referenceIds.length === 1 &&
        referenceIds[0] === ui.highlightedReferenceId;
      try {
        await bulkUpsert.mutateAsync({
          payload: {
            referenceIds,
            status,
            stage: config.opinionStage,
            reason: reasonId,
          },
        });
        invalidateQuery();
        if (shouldNavigateNext) ui.handleNavigateDetail('next');
      } catch (err) {
        console.error('Failed to update reference:', err);
      }
    },
    [bulkUpsert, config.opinionStage, invalidateQuery, ui]
  );

  const handleExport = useCallback(
    (
      exportType: ExportType,
      exportFn: (filename: string, params?: FetchReviewDataParams) => void,
      queryParams: FetchReviewDataParams
    ) => {
      const filename = config.exportFilename(
        reviewId,
        exportType === 'filtered'
      );
      exportType === 'all'
        ? exportFn(filename, { review: reviewId })
        : exportFn(filename, queryParams);
    },
    [config, reviewId]
  );

  return {
    ui,
    keywords,
    fileUpload,
    userRole,
    invalidateQuery,
    handleDeleteLabel,
    handleDeleteSearchMethod,
    handleOpinionApplied,
    handleExport,
    articleViewLayout,
    setArticleViewLayout,
    includeHighlightEnabled,
    setIncludeHighlightEnabled,
    excludeHighlightEnabled,
    setExcludeHighlightEnabled,
  };
}
