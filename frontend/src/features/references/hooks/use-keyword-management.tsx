import { useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCreateKeyword,
  useDeleteKeyword,
} from '@/features/references/hooks/use-keywords';
import type { Keyword } from '@/features/references/types/keywords';

export function useKeywordManagement(
  reviewId: number,
  apiKeywords: Keyword[] = [],
  includeHighlightEnabled: boolean,
  excludeHighlightEnabled: boolean,
  selectedIncludeKeywords: string[],
  selectedExcludeKeywords: string[],
  setSelectedIncludeKeywords: (keywords: string[]) => void,
  setSelectedExcludeKeywords: (keywords: string[]) => void
) {
  const [localKeywords, setLocalKeywords] = useState<Keyword[]>([]);
  const createKeyword = useCreateKeyword();
  const deleteKeyword = useDeleteKeyword();
  const queryClient = useQueryClient();

  // Combine API keywords with local keywords
  const allKeywords = useMemo(() => {
    const combined = [...apiKeywords];
    for (const localKw of localKeywords) {
      if (
        !combined.some(
          (k) => k.name.toLowerCase() === localKw.name.toLowerCase()
        )
      ) {
        combined.push(localKw);
      }
    }
    return combined;
  }, [apiKeywords, localKeywords]);

  // Highlight keywords based on enabled state
  const highlightIncludeKeywords = includeHighlightEnabled
    ? allKeywords.filter((k) => k.isInclusive).map((k) => k.name)
    : [];

  const highlightExcludeKeywords = excludeHighlightEnabled
    ? allKeywords.filter((k) => !k.isInclusive).map((k) => k.name)
    : [];

  const handleCreateKeyword = useCallback(
    async (name: string, isInclusive: boolean) => {
      try {
        const newKeyword = await createKeyword.mutateAsync({
          review: reviewId,
          name,
          isInclusive,
        });

        setLocalKeywords((prev) => {
          if (prev.some((k) => k.name.toLowerCase() === name.toLowerCase())) {
            return prev;
          }
          return [...prev, newKeyword];
        });

        return true;
      } catch (error) {
        console.error(error);
        return false;
      }
    },
    [createKeyword, reviewId]
  );

  const handleDeleteKeyword = useCallback(
    async (keyword: Keyword) => {
      try {
        await deleteKeyword.mutateAsync(keyword.id);

        setLocalKeywords((prev) => prev.filter((k) => k.id !== keyword.id));

        if (keyword.isInclusive) {
          setSelectedIncludeKeywords(
            selectedIncludeKeywords.filter((k) => k !== keyword.name)
          );
        } else {
          setSelectedExcludeKeywords(
            selectedExcludeKeywords.filter((k) => k !== keyword.name)
          );
        }

        queryClient.invalidateQueries({
          queryKey: ['reviews', reviewId, 'review-data'],
        });

        return true;
      } catch (error) {
        console.error(error);
        return false;
      }
    },
    [
      deleteKeyword,
      reviewId,
      queryClient,
      selectedIncludeKeywords,
      selectedExcludeKeywords,
    ]
  );

  return {
    allKeywords,
    highlightIncludeKeywords,
    highlightExcludeKeywords,
    handleCreateKeyword,
    handleDeleteKeyword,
    setLocalKeywords,
    selectedIncludeKeywords,
    selectedExcludeKeywords,
  };
}
