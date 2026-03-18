import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTocFromContent } from '../../src/hooks/use-toc';
import React from 'react';

describe('useTocFromContent', () => {
  let container: HTMLDivElement;
  let contentRef: React.RefObject<HTMLElement | null>;

  beforeEach(() => {
    container = document.createElement('div');
    contentRef = { current: container };
  });

  it('should return an empty array if contentRef is empty', () => {
    const emptyRef = { current: null };
    const { result } = renderHook(() => useTocFromContent(emptyRef));
    expect(result.current).toEqual([]);
  });

  it('should parse h2, h3, and h4 elements and generate TOC items', () => {
    // Setup DOM with headings
    container.innerHTML = `
      <h2>Main Section</h2>
      <p>Some content</p>
      <h3>Subsection</h3>
      <h4>Detail</h4>
      <h2>Another Section</h2>
    `;

    const { result } = renderHook(() => useTocFromContent(contentRef));

    // By default the hook adds IDs if they are missing
    expect(result.current).toEqual([
      { title: 'Main Section', url: '#main-section', depth: 2 },
      { title: 'Subsection', url: '#subsection', depth: 3 },
      { title: 'Detail', url: '#detail', depth: 4 },
      { title: 'Another Section', url: '#another-section', depth: 2 },
    ]);
  });

  it('should respect existing IDs on headings', () => {
    container.innerHTML = `
      <h2 id="custom-id">Main Section</h2>
      <h3 id="existing-sub">Subsection</h3>
    `;

    const { result } = renderHook(() => useTocFromContent(contentRef));

    expect(result.current).toEqual([
      { title: 'Main Section', url: '#custom-id', depth: 2 },
      { title: 'Subsection', url: '#existing-sub', depth: 3 },
    ]);
  });

  it('should handle unusual characters in generated IDs', () => {
    container.innerHTML = `
      <h2>Section with @#$% special chars!</h2>
      <h3>  Spaced   Section  </h3>
    `;

    const { result } = renderHook(() => useTocFromContent(contentRef));

    expect(result.current).toEqual([
      {
        title: 'Section with @#$% special chars!',
        url: '#section-with--special-chars',
        depth: 2,
      },
      { title: '  Spaced   Section  ', url: '#spaced-section', depth: 3 },
    ]);
  });
});
