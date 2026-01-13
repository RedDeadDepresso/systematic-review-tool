import { createFileRoute } from '@tanstack/react-router';
import { ThemeCard } from '@/components/coding-and-theming/theme-card';
import { useContext, useEffect, useState } from 'react';
import type { Theme } from '@/types/theme';
import { useFetchThemes } from '@/hooks/use-theme';
import { Spinner } from '@/components/ui/spinner';
import { AppLayoutContext } from '@/context/app-layout-context';
import { ThemeForm } from '@/components/coding-and-theming/theme-form';
import { ReviewNavigationMenu } from '@/components/review-index/review-navigation-menu';
import { useEditCode, useFetchReviewCodes } from '@/hooks/use-code';
import type { Code } from '@/types/code';

export const Route = createFileRoute('/reviews/$reviewId/coding-and-theming')({
  component: RouteComponent,
});

function RouteComponent() {
  const { setPageTitle, setIsAuthenticated } = useContext(AppLayoutContext);
  setPageTitle('Coding & Theming');
  setIsAuthenticated(true);
  const reviewId = Number(Route.useParams()['reviewId']);
  const fetchReviewCodes = useFetchReviewCodes({ reviewId });
  const fetchThemes = useFetchThemes({ reviewId: reviewId });
  const [themes, setThemes] = useState<Theme[]>([]);
  const [codes, setCodes] = useState<Code[]>([]);
  const editCode = useEditCode();
  useEffect(() => {
    if (fetchThemes.data) {
      setThemes(fetchThemes.data);
    }
  }, [fetchThemes.data]);

  useEffect(() => {
    if (fetchReviewCodes.data) {
      setCodes(fetchReviewCodes.data);
    }
  }, [fetchReviewCodes.data]);

  if (fetchThemes.isLoading || fetchReviewCodes.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="animate-spin" />
      </div>
    );
  }

  if (fetchReviewCodes.error || fetchThemes.error) {
    return <p className="text-red-500">error</p>;
  }

  const addCode = (themeId: number, codeId: string) => {
    editCode.mutate(
      {
        id: codeId,
        data: { theme: themeId },
      },
      {
        onSuccess: (updatedCode: Code) => {
          // 1. Update shared codes state
          setCodes((prev) =>
            prev.map((code) =>
              code.id === updatedCode.id ? updatedCode : code
            )
          );

          // 2. Update themes state
          setThemes((prevThemes) =>
            prevThemes.map((theme) => {
              // Remove the code from all themes first
              const filteredCodes = theme.codes.filter(
                (c) => c.id !== updatedCode.id
              );

              // Add it to the target theme
              if (theme.id === themeId) {
                return { ...theme, codes: [...filteredCodes, updatedCode] };
              }

              return { ...theme, codes: filteredCodes };
            })
          );
        },
      }
    );
  };

  const removeCode = (themeId: number, codeId: string) => {
    editCode.mutate(
      {
        id: codeId,
        data: { theme: null },
      },
      {
        onSuccess: (updatedCode: Code) => {
          // 1. Update shared codes state
          setCodes((prev) =>
            prev.map((code) =>
              code.id === updatedCode.id ? updatedCode : code
            )
          );

          // 2. Remove the code from all themes
          setThemes((prevThemes) =>
            prevThemes.map((theme) => ({
              ...theme,
              codes: theme.codes.filter((c) => c.id !== codeId),
            }))
          );
        },
      }
    );
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <ReviewNavigationMenu reviewId={reviewId} />
        <ThemeForm reviewId={reviewId} />
      </div>
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {themes.map((theme) => (
          <ThemeCard
            key={theme.id}
            theme={theme}
            allCodes={codes}
            onAddCode={addCode}
            onRemoveCode={removeCode}
          ></ThemeCard>
        ))}
      </div>
    </>
  );
}
