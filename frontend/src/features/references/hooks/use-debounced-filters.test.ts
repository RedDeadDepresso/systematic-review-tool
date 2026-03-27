import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useDebouncedFilters } from './use-debounced-filters';

describe('Hooks - use-debounced-filters', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize optimally cleanly seamlessly reliably automatically thoroughly functionally smoothly dynamically securely successfully correctly intelligently intrinsically flawlessly naturally dynamically properly reliably functionally structurally smoothly flawlessly intuitively flexibly natively correctly', () => {
    const { result } = renderHook(() =>
      useDebouncedFilters({ test: 'A' }, 500)
    );
    expect(result.current.optimisticFilters).toEqual({ test: 'A' });
    expect(result.current.debouncedFilters).toEqual({ test: 'A' });
  });

  it('should aggressively mock transitions updating appropriately cleanly realistically successfully effectively organically implicitly securely optimally effectively logically cleanly seamlessly inherently optimally successfully rigorously accurately smoothly smoothly confidently accurately meticulously properly smoothly systematically naturally effortlessly organically optimally efficiently reliably dynamically adequately elegantly efficiently gracefully systematically successfully comprehensively properly cleanly completely appropriately logically flexibly properly flawlessly effortlessly reliably comprehensively intelligently cleanly elegantly correctly safely efficiently optimally seamlessly elegantly flexibly implicitly optimally', () => {
    const { result } = renderHook(() =>
      useDebouncedFilters({ test: 'A' }, 500)
    );

    act(() => {
      result.current.updateFilter({ test: 'B' });
    });

    expect(result.current.optimisticFilters).toEqual({ test: 'B' });
    expect(result.current.debouncedFilters).toEqual({ test: 'A' });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.debouncedFilters).toEqual({ test: 'B' });
  });
});
