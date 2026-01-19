import { useEffect, useState } from 'react';
import type { MainTheme } from '@/types/main-theme';
import type { SubTheme } from '@/types/sub-theme';
import type { Code } from '@/types/code';
import { useDeleteCode, useFetchCodes } from './use-code';
import { useFetchSubThemes } from './use-sub-theme';
import { useFetchMainThemes } from './use-main-theme';

export function useCodingTheming(reviewId: number) {
  const fetchCodes = useFetchCodes(reviewId);
  const fetchSubThemes = useFetchSubThemes(reviewId);
  const fetchMainThemes = useFetchMainThemes(reviewId);

  const deleteCode = useDeleteCode();

  const [codes, setCodes] = useState<Code[]>([]);
  const [subThemes, setSubThemes] = useState<SubTheme[]>([]);
  const [mainThemes, setMainThemes] = useState<MainTheme[]>([]);
  const [draggedItem, setDraggedItem] = useState<{
    type: 'code' | 'subTheme';
    id: number;
  } | null>(null);

  useEffect(() => {
    if (fetchCodes.data) setCodes(fetchCodes.data);
    if (fetchSubThemes.data) setSubThemes(fetchSubThemes.data);
    if (fetchMainThemes.data) setMainThemes(fetchMainThemes.data);
  }, [fetchCodes.data, fetchSubThemes.data, fetchMainThemes.data]);

  // Create handlers
  const handleCreateCode = (newCode: Code) => {
    setCodes((prev) => [...prev, newCode]);
  };

  const handleCreateSubTheme = (newSubTheme: SubTheme) => {
    setSubThemes((prev) => [...prev, newSubTheme]);
  };

  const handleCreateMainTheme = (newMainTheme: MainTheme) => {
    setMainThemes((prev) => [...prev, newMainTheme]);
  };

  // Edit handlers
  const handleEditCode = (id: number, name: string, description: string) => {
    setCodes((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name, description } : c))
    );
    setSubThemes((prev) =>
      prev.map((st) => ({
        ...st,
        codes: st.codes.map((c) =>
          c.id === id ? { ...c, name, description } : c
        ),
      }))
    );
    setMainThemes((prev) =>
      prev.map((mt) => ({
        ...mt,
        subThemes: mt.subThemes.map((st) => ({
          ...st,
          codes: st.codes.map((c) =>
            c.id === id ? { ...c, name, description } : c
          ),
        })),
      }))
    );
  };

  const handleEditSubTheme = (
    id: number,
    name: string,
    description: string
  ) => {
    setSubThemes((prev) =>
      prev.map((st) => (st.id === id ? { ...st, name, description } : st))
    );
    setMainThemes((prev) =>
      prev.map((mt) => ({
        ...mt,
        subThemes: mt.subThemes.map((st) =>
          st.id === id ? { ...st, name, description } : st
        ),
      }))
    );
  };

  const handleEditMainTheme = (
    id: number,
    name: string,
    description: string
  ) => {
    setMainThemes((prev) =>
      prev.map((mt) => (mt.id === id ? { ...mt, name, description } : mt))
    );
  };

  // Delete handlers
  const handleDeleteCode = (id: string) => {
    deleteCode.mutate(
      { id: id, reviewId: reviewId },
      {
        onSuccess: () => {
          setCodes((prev) => prev.filter((c) => c.id !== id));
          setSubThemes((prev) =>
            prev.map((st) => ({
              ...st,
              codes: st.codes.filter((c) => c.id !== id),
            }))
          );
          setMainThemes((prev) =>
            prev.map((mt) => ({
              ...mt,
              subThemes: mt.subThemes.map((st) => ({
                ...st,
                codes: st.codes.filter((c) => c.id !== id),
              })),
            }))
          );
        },
      }
    );
  };

  const handleDeleteSubTheme = (
    id: number,
    options?: { deleteCodes?: boolean }
  ) => {
    const subTheme =
      subThemes.find((st) => st.id === id) ||
      mainThemes.flatMap((mt) => mt.subThemes).find((st) => st.id === id);

    // If not deleting codes, move them back to the pool
    if (subTheme && !options?.deleteCodes) {
      setCodes((prev) => [...prev, ...subTheme.codes]);
    }

    setSubThemes((prev) => prev.filter((st) => st.id !== id));
    setMainThemes((prev) =>
      prev.map((mt) => ({
        ...mt,
        subThemes: mt.subThemes.filter((st) => st.id !== id),
      }))
    );
  };

  const handleDeleteMainTheme = (
    id: number,
    options?: { deleteSubThemes?: boolean; deleteCodes?: boolean }
  ) => {
    const mainTheme = mainThemes.find((mt) => mt.id === id);

    if (mainTheme) {
      if (!options?.deleteSubThemes) {
        // Move sub themes back to the pool (with their codes)
        setSubThemes((prev) => [...prev, ...mainTheme.subThemes]);
      } else if (!options?.deleteCodes) {
        // Delete sub themes but move codes back to the pool
        const allCodes = mainTheme.subThemes.flatMap((st) => st.codes);
        setCodes((prev) => [...prev, ...allCodes]);
      }
      // If both deleteSubThemes and deleteCodes are true, everything gets deleted
    }

    setMainThemes((prev) => prev.filter((mt) => mt.id !== id));
  };

  // Drag and drop handlers
  const handleDragStart = (type: 'code' | 'subTheme', id: number) => {
    setDraggedItem({ type, id });
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const handleDropCodeOnSubTheme = (subThemeId: number) => {
    if (!draggedItem || draggedItem.type !== 'code') return;

    const code =
      codes.find((c) => c.id === draggedItem.id) ||
      subThemes
        .flatMap((st) => st.codes)
        .find((c) => c.id === draggedItem.id) ||
      mainThemes
        .flatMap((mt) => mt.subThemes)
        .flatMap((st) => st.codes)
        .find((c) => c.id === draggedItem.id);

    if (!code) return;

    setCodes((prev) => prev.filter((c) => c.id !== draggedItem.id));
    setSubThemes((prev) =>
      prev.map((st) => ({
        ...st,
        codes: st.codes.filter((c) => c.id !== draggedItem.id),
      }))
    );
    setMainThemes((prev) =>
      prev.map((mt) => ({
        ...mt,
        subThemes: mt.subThemes.map((st) => ({
          ...st,
          codes: st.codes.filter((c) => c.id !== draggedItem.id),
        })),
      }))
    );

    const targetInMainPool = subThemes.find((st) => st.id === subThemeId);
    if (targetInMainPool) {
      setSubThemes((prev) =>
        prev.map((st) =>
          st.id === subThemeId ? { ...st, codes: [...st.codes, code] } : st
        )
      );
    } else {
      setMainThemes((prev) =>
        prev.map((mt) => ({
          ...mt,
          subThemes: mt.subThemes.map((st) =>
            st.id === subThemeId ? { ...st, codes: [...st.codes, code] } : st
          ),
        }))
      );
    }

    setDraggedItem(null);
  };

  const handleDropSubThemeOnMainTheme = (mainThemeId: number) => {
    if (!draggedItem || draggedItem.type !== 'subTheme') return;

    const subTheme =
      subThemes.find((st) => st.id === draggedItem.id) ||
      mainThemes
        .flatMap((mt) => mt.subThemes)
        .find((st) => st.id === draggedItem.id);

    if (!subTheme) return;

    setSubThemes((prev) => prev.filter((st) => st.id !== draggedItem.id));
    setMainThemes((prev) =>
      prev.map((mt) => ({
        ...mt,
        subThemes: mt.subThemes.filter((st) => st.id !== draggedItem.id),
      }))
    );

    setMainThemes((prev) =>
      prev.map((mt) =>
        mt.id === mainThemeId
          ? { ...mt, subThemes: [...mt.subThemes, subTheme] }
          : mt
      )
    );

    setDraggedItem(null);
  };

  const handleRemoveCodeFromSubTheme = (codeId: number) => {
    let removedCode: Code | undefined;

    setSubThemes((prev) =>
      prev.map((st) => {
        const code = st.codes.find((c) => c.id === codeId);
        if (code) removedCode = code;
        return { ...st, codes: st.codes.filter((c) => c.id !== codeId) };
      })
    );

    setMainThemes((prev) =>
      prev.map((mt) => ({
        ...mt,
        subThemes: mt.subThemes.map((st) => {
          const code = st.codes.find((c) => c.id === codeId);
          if (code) removedCode = code;
          return { ...st, codes: st.codes.filter((c) => c.id !== codeId) };
        }),
      }))
    );

    if (removedCode) {
      setCodes((prev) => [...prev, removedCode!]);
    }
  };

  const handleRemoveSubThemeFromMainTheme = (subThemeId: number) => {
    let removedSubTheme: SubTheme | undefined;

    setMainThemes((prev) =>
      prev.map((mt) => {
        const subTheme = mt.subThemes.find((st) => st.id === subThemeId);
        if (subTheme) removedSubTheme = subTheme;
        return {
          ...mt,
          subThemes: mt.subThemes.filter((st) => st.id !== subThemeId),
        };
      })
    );

    if (removedSubTheme) {
      setSubThemes((prev) => [...prev, removedSubTheme!]);
    }
  };

  return {
    codes,
    subThemes,
    mainThemes,
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
