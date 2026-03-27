// Hook for managing include/exclude keyword lists.
import { useCallback } from 'react';
import {
  useCreateKeyword,
  useDeleteKeyword,
  useFetchKeywords,
} from '@/features/references/hooks/use-keywords';
import type {
  Keyword,
  KeywordType,
} from '@/features/references/types/keywords';

export function useKeywordManagement(
  reviewId: number,
  includeHighlightEnabled: boolean,
  excludeHighlightEnabled: boolean,
  selectedIncludeKeywords: string[],
  selectedExcludeKeywords: string[],
  setSelectedIncludeKeywords: (keywords: string[]) => void,
  setSelectedExcludeKeywords: (keywords: string[]) => void
) {
  const { data: includeKeywords = [] } = useFetchKeywords({
    reviewId,
    type: 'inclusion',
  });
  const { data: excludeKeywords = [] } = useFetchKeywords({
    reviewId,
    type: 'exclusion',
  });
  const createKeyword = useCreateKeyword();
  const deleteKeyword = useDeleteKeyword();

  // Resolve the actual keyword strings to highlight; empty when highlighting is toggled off
  const highlightIncludeKeywords = includeHighlightEnabled
    ? includeKeywords.map((k) => k.name)
    : [];

  const highlightExcludeKeywords = excludeHighlightEnabled
    ? excludeKeywords.map((k) => k.name)
    : [];

  const handleCreateKeyword = useCallback(
    (name: string, type: KeywordType) => {
      createKeyword.mutate({
        review: reviewId,
        name,
        type,
      });
    },
    [createKeyword, reviewId]
  );

  const handleDeleteKeyword = (keyword: Keyword) => {
    // On success, deselect the deleted keyword from any active filter
    deleteKeyword.mutate(
      {
        reviewId,
        keywordId: keyword.id,
        type: keyword.type,
      },
      {
        onSuccess: () => {
          if (keyword.type === 'inclusion') {
            setSelectedIncludeKeywords(
              selectedIncludeKeywords.filter((k) => k !== keyword.name)
            );
          } else {
            setSelectedExcludeKeywords(
              selectedExcludeKeywords.filter((k) => k !== keyword.name)
            );
          }
        },
      }
    );
  };

  return {
    includeKeywords,
    excludeKeywords,
    highlightIncludeKeywords,
    highlightExcludeKeywords,
    handleCreateKeyword,
    handleDeleteKeyword,
    selectedIncludeKeywords,
    selectedExcludeKeywords,
  };
}
