import type { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { errorMessageString } from '@/lib/error';

// ─── Cache updaters ────────────────────────────────────────────────────────────

/** Append a single item to a cached array. */
export function cacheAppend<T>(item: T) {
  return (oldData: T[] = []): T[] => [...oldData, item];
}

/** Replace the item whose `.id` matches in a cached array. */
export function cacheReplace<T extends { id: number | string }>(item: T) {
  return (oldData: T[] = []): T[] =>
    oldData.map((existing) => (existing.id === item.id ? item : existing));
}

/** Remove the item whose `.id` matches from a cached array. */
export function cacheRemove<T extends { id: number | string }>(id: T['id']) {
  return (oldData: T[] | undefined): T[] =>
    oldData ? oldData.filter((item) => item.id !== id) : [];
}

// ─── Standard mutation handlers ───────────────────────────────────────────────

/** Standard `onError` handler: toasts the error message. */
export function onMutationError(label: string) {
  return (error: any) => {
    toast.error(`Failed to ${label}: ${errorMessageString(error)}`);
  };
}

/**
 * Append a created item to its list cache, then optionally show a toast.
 *
 * @example
 * onSuccess: onCreated(queryClient, (data, vars) => codeKeys.list(vars.review), data, 'Code has been created.')
 */
export function applyCreate<T extends { id: number | string }>(
  queryClient: QueryClient,
  queryKey: readonly any[],
  data: T,
  successMessage?: string
) {
  if (successMessage) toast.success(successMessage);
  queryClient.setQueryData<T[]>(queryKey, cacheAppend(data));
}

/**
 * Replace an updated item in its list cache, then optionally show a toast.
 */
export function applyUpdate<T extends { id: number | string }>(
  queryClient: QueryClient,
  queryKey: readonly any[],
  data: T,
  successMessage?: string
) {
  if (successMessage) toast.success(successMessage);
  queryClient.setQueryData<T[]>(queryKey, cacheReplace(data));
}

/**
 * Remove a deleted item from its list cache, then optionally show a toast.
 */
export function applyDelete<T extends { id: number | string }>(
  queryClient: QueryClient,
  queryKey: readonly any[],
  id: T['id'],
  successMessage?: string
) {
  if (successMessage) toast.success(successMessage);
  queryClient.setQueryData<T[]>(queryKey, cacheRemove(id));
}
