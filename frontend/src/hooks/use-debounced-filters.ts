import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook to debounce filter state changes
 *
 * This prevents excessive API calls when user rapidly toggles multiple filters.
 *
 * @param initialFilters - Initial filter state
 * @param delay - Debounce delay in milliseconds (default: 500ms)
 * @returns [optimisticFilters, debouncedFilters, updateFilter]
 */
export function useDebouncedFilters<T extends Record<string, any>>(
  initialFilters: T,
  delay: number = 500
) {
  // Optimistic state - updates immediately for UI responsiveness
  const [optimisticFilters, setOptimisticFilters] = useState<T>(initialFilters);

  // Debounced state - used for actual API calls
  const [debouncedFilters, setDebouncedFilters] = useState<T>(initialFilters);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce the optimistic filters
  useEffect(() => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      setDebouncedFilters(optimisticFilters);
    }, delay);

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [optimisticFilters, delay]);

  // Update function that modifies optimistic state immediately
  const updateFilter = useCallback((updates: Partial<T>) => {
    setOptimisticFilters((prev) => ({ ...prev, ...updates }));
  }, []);

  return {
    // For UI components (checkboxes, etc.) - updates immediately
    optimisticFilters,
    // For API calls - debounced
    debouncedFilters,
    // Function to update filters
    updateFilter,
    // For manual control
    setOptimisticFilters,
  };
}
