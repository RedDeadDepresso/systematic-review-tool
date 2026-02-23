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
  const [draggedItem, setDraggedItem] = useState<{
    type: 'code' | 'subTheme';
    id: number | string;
  } | null>(null);

  useEffect(() => {
    if (fetchCodes.data) setCodes(fetchCodes.data);
    if (fetchSubThemes.data) setSubThemes(fetchSubThemes.data);
    if (fetchMainThemes.data) setMainThemes(fetchMainThemes.data);
  }, [fetchCodes.data, fetchSubThemes.data, fetchMainThemes.data]);

  // Create handlers
  const handleCreateCode = async (name: string, comment: string) => {
    return new Promise<boolean>((resolve) => {
      createCode.mutate(
        { name, comment, review: reviewId },
        {
          onSuccess: () => {
            resolve(true);
          },
          onError: () => {
            resolve(false);
          },
        }
      );
    });
  };

  const handleCreateSubTheme = (name: string, description: string) => {
    return new Promise<boolean>((resolve) => {
      createSubTheme.mutate(
        {
          name: name,
          description: description,
          review: reviewId,
        },
        {
          onSuccess: () => {
            resolve(true);
          },
          onError: () => {
            resolve(false);
          },
        }
      );
    });
  };

  const handleCreateMainTheme = (name: string, description: string) => {
    return new Promise<boolean>((resolve) => {
      createMainTheme.mutate(
        {
          name: name,
          description: description,
          review: reviewId,
        },
        {
          onSuccess: () => {
            resolve(true);
          },
          onError: () => {
            resolve(false);
          },
        }
      );
    });
  };

  // Edit handlers
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

  // Delete handlers
  const handleDeleteCode = (id: string) => {
    deleteCode.mutate({ id, reviewId });
  };

  const handleDeleteSubTheme = (
    id: number,
    _options?: { deleteCodes?: boolean }
  ) => {
    deleteSubTheme.mutate(
      { id, reviewId }
      // {
      //   onSuccess: () => {
      //     if (subTheme && !options?.deleteCodes) {
      //       setCodes((prev) => [
      //         ...prev,
      //         ...subTheme.codeIds.map(
      //           (cid) => codes.find((c) => c.id === cid)!
      //         ),
      //       ]);
      //     }
      //   },
      // }
    );
  };

  const handleDeleteMainTheme = (
    id: number,
    _options?: { deleteSubThemes?: boolean; deleteCodes?: boolean }
  ) => {
    deleteMainTheme.mutate(
      { id, reviewId }
      // {
      //   onSuccess: () => {
      //     if (!options?.deleteSubThemes) {
      //       setSubThemes((prev) => [
      //         ...prev,
      //         ...mainTheme.subThemeIds.map(
      //           (sid) => subThemes.find((st) => st.id === sid)!
      //         ),
      //       ]);
      //     } else if (!options?.deleteCodes) {
      //       const allCodeIds = mainTheme.subThemeIds.flatMap(
      //         (sid) => subThemes.find((st) => st.id === sid)!.codeIds
      //       );
      //       setCodes((prev) => [
      //         ...prev,
      //         ...allCodeIds.map((cid) => codes.find((c) => c.id === cid)!),
      //       ]);
      //     }
      //   },
      // }
    );
  };

  // Drag and drop handlers
  const handleDragStart = (type: 'code' | 'subTheme', id: number | string) => {
    setDraggedItem({ type, id });
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const handleDropCodeOnSubTheme = (subThemeId: number) => {
    if (!draggedItem || draggedItem.type !== 'code') return;

    // Find the code in the flat codes array
    const code = codes.find((c) => c.id === draggedItem.id);
    if (!code) return;

    updateCode.mutate({ id: code.id, payload: { subTheme: subThemeId } });

    setDraggedItem(null);
  };

  const handleDropSubThemeOnMainTheme = (mainThemeId: number) => {
    if (!draggedItem || draggedItem.type !== 'subTheme') return;

    const subThemeId = draggedItem.id;

    updateSubTheme.mutate({
      id: Number(subThemeId),
      payload: { mainTheme: mainThemeId },
    });

    setDraggedItem(null);
  };

  const handleRemoveCodeFromSubTheme = (codeId: string) => {
    updateCode.mutate({ id: codeId, payload: { subTheme: null } });
  };

  const handleRemoveSubThemeFromMainTheme = (subThemeId: number) => {
    updateSubTheme.mutate({
      id: subThemeId,
      payload: { mainTheme: null },
    });
  };

  return {
    codes,
    subThemes,
    mainThemes,
    isCodesLoading: fetchCodes.isLoading,
    isSubThemesLoading: fetchSubThemes.isLoading,
    isMainThemesLoading: fetchMainThemes.isLoading,
    draggedItem,
    handleCreateCode,
    handleCreateSubTheme,
    handleCreateMainTheme,
    handleEditCode,
    handleEditSubTheme,
    handleEditMainTheme,
    handleDeleteCode,
    handleDeleteSubTheme,
    handleDeleteMainTheme,
    handleDragStart,
    handleDragEnd,
    handleDropCodeOnSubTheme,
    handleDropSubThemeOnMainTheme,
    handleRemoveCodeFromSubTheme,
    handleRemoveSubThemeFromMainTheme,
  };
}
