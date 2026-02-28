import { useEffect, useState } from 'react';
import type { MainTheme } from '@/features/coding/types/main-themes';
import type { SubTheme } from '@/features/coding/types/sub-themes';
import type { Code } from '@/features/coding/types/codes';
import {
  useCreateCode,
  useDeleteCode,
  useFetchCodes,
  useUpdateCode,
} from '@/features/coding/hooks/use-codes';
import {
  useCreateSubTheme,
  useDeleteSubTheme,
  useFetchSubThemes,
  useUpdateSubTheme,
} from '@/features/coding/hooks/use-sub-themes';
import {
  useCreateMainTheme,
  useDeleteMainTheme,
  useFetchMainThemes,
  useUpdateMainTheme,
} from '@/features/coding/hooks/use-main-themes';

export function useCodingTheming(reviewId: number) {
  const fetchCodes = useFetchCodes(reviewId);
  const createCode = useCreateCode();
  const updateCode = useUpdateCode();
  const deleteCode = useDeleteCode();

  const fetchSubThemes = useFetchSubThemes(reviewId);
  const createSubTheme = useCreateSubTheme();
  const updateSubTheme = useUpdateSubTheme();
  const deleteSubTheme = useDeleteSubTheme();

  const fetchMainThemes = useFetchMainThemes(reviewId);
  const createMainTheme = useCreateMainTheme();
  const updateMainTheme = useUpdateMainTheme();
  const deleteMainTheme = useDeleteMainTheme();

  const [codes, setCodes] = useState<Code[]>([]);
  const [subThemes, setSubThemes] = useState<SubTheme[]>([]);
  const [mainThemes, setMainThemes] = useState<MainTheme[]>([]);

  useEffect(() => {
    if (fetchCodes.data) setCodes(fetchCodes.data);
    if (fetchSubThemes.data) setSubThemes(fetchSubThemes.data);
    if (fetchMainThemes.data) setMainThemes(fetchMainThemes.data);
  }, [fetchCodes.data, fetchSubThemes.data, fetchMainThemes.data]);

  // ── Create ────────────────────────────────────────────────────────────────

  const handleCreateCode = async (name: string, comment: string) => {
    return new Promise<boolean>((resolve) => {
      createCode.mutate(
        { name, comment, review: reviewId },
        {
          onSuccess: () => resolve(true),
          onError: () => resolve(false),
        }
      );
    });
  };

  const handleCreateSubTheme = (name: string, description: string) => {
    return new Promise<boolean>((resolve) => {
      createSubTheme.mutate(
        { name, description, review: reviewId },
        {
          onSuccess: () => resolve(true),
          onError: () => resolve(false),
        }
      );
    });
  };

  const handleCreateMainTheme = (name: string, description: string) => {
    return new Promise<boolean>((resolve) => {
      createMainTheme.mutate(
        { name, description, review: reviewId },
        {
          onSuccess: () => resolve(true),
          onError: () => resolve(false),
        }
      );
    });
  };

  // ── Edit ─────────────────────────────────────────────────────────────────

  const handleEditCode = (id: string, name: string, comment: string) => {
    updateCode.mutate({ id, payload: { name, comment } });
  };

  const handleEditSubTheme = (
    id: number,
    name: string,
    description: string
  ) => {
    updateSubTheme.mutate({ id, payload: { name, description } });
  };

  const handleEditMainTheme = (
    id: number,
    name: string,
    description: string
  ) => {
    updateMainTheme.mutate({ id, payload: { name, description } });
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDeleteCode = (id: string) => {
    deleteCode.mutate({ id, reviewId });
  };

  const handleDeleteSubTheme = (
    id: number,
    _options?: { deleteCodes?: boolean }
  ) => {
    deleteSubTheme.mutate({ id, reviewId });
  };

  const handleDeleteMainTheme = (
    id: number,
    _options?: { deleteSubThemes?: boolean; deleteCodes?: boolean }
  ) => {
    deleteMainTheme.mutate({ id, reviewId });
  };

  // ── Drag & Drop (called from DndContext onDragEnd in the route) ───────────

  /**
   * Move a code to a sub-theme (or null to remove from any sub-theme).
   */
  const handleMoveCode = (codeId: string, subThemeId: number | null) => {
    updateCode.mutate({ id: codeId, payload: { subTheme: subThemeId } });
  };

  /**
   * Move a sub-theme to a main-theme (or null to remove from any main-theme).
   */
  const handleMoveSubTheme = (
    subThemeId: number,
    mainThemeId: number | null
  ) => {
    updateSubTheme.mutate({
      id: subThemeId,
      payload: { mainTheme: mainThemeId },
    });
  };

  return {
    codes,
    subThemes,
    mainThemes,
    isCodesLoading: fetchCodes.isLoading,
    isSubThemesLoading: fetchSubThemes.isLoading,
    isMainThemesLoading: fetchMainThemes.isLoading,
    handleCreateCode,
    handleCreateSubTheme,
    handleCreateMainTheme,
    handleEditCode,
    handleEditSubTheme,
    handleEditMainTheme,
    handleDeleteCode,
    handleDeleteSubTheme,
    handleDeleteMainTheme,
    handleMoveCode,
    handleMoveSubTheme,
  };
}
