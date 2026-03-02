import { useCallback } from 'react';
import {
  useCreateKeyword,
  useDeleteKeyword,
  useFetchKeywords,
} from '@/features/references/hooks/use-keywords';
import type { Keyword } from '@/features/references/types/keywords';

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
    isInclusive: true,
  });
  const { data: excludeKeywords = [] } = useFetchKeywords({
    reviewId,
    isInclusive: false,
  });
  const createKeyword = useCreateKeyword();
  const deleteKeyword = useDeleteKeyword();

  // Highlight keywords based on enabled state
  const highlightIncludeKeywords = includeHighlightEnabled
    ? includeKeywords.map((k) => k.name)
    : [];

  const highlightExcludeKeywords = excludeHighlightEnabled
    ? excludeKeywords.map((k) => k.name)
    : [];

  const handleCreateKeyword = useCallback(
    (name: string, isInclusive: boolean) => {
      createKeyword.mutate({
        review: reviewId,
        name,
        isInclusive,
      });
    },
    [createKeyword, reviewId]
  );

  const handleDeleteKeyword = (keyword: Keyword) => {
    deleteKeyword.mutate(
      {
        reviewId,
        keywordId: keyword.id,
        isInclusive: keyword.isInclusive,
      },
      {
        onSuccess: () => {
          if (keyword.isInclusive) {
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
