import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { highlightText } from './highlight-text';

describe('highlightText', () => {
  it('returns original text if no keywords provided', () => {
    const result = highlightText('This is a test', [], []);
    expect(result).toBe('This is a test');
  });

  it('highlights include keywords with green text', () => {
    const { container } = render(
      <>{highlightText('That is a test', ['is'], [])}</>
    );
    const includeNodes = container.querySelectorAll('.text-green-600');
    expect(includeNodes.length).toBe(1);
    expect(includeNodes[0].textContent).toBe('is');
  });

  it('highlights exclude keywords with red text', () => {
    const { container } = render(
      <>{highlightText('This is a test', [], ['test'])}</>
    );
    const excludeNodes = container.querySelectorAll('.text-red-600');
    expect(excludeNodes.length).toBe(1);
    expect(excludeNodes[0].textContent).toBe('test');
  });

  it('handles multiple occurrences and mixed case', () => {
    const { container } = render(
      <>{highlightText('This IS a Test for test', ['is'], ['test'])}</>
    );
    const includeNodes = container.querySelectorAll('.text-green-600');
    expect(includeNodes.length).toBe(2);
    expect(includeNodes[0].textContent).toBe('is');
    expect(includeNodes[1].textContent).toBe('IS');

    const excludeNodes = container.querySelectorAll('.text-red-600');
    expect(excludeNodes.length).toBe(2);
    expect(excludeNodes[0].textContent).toBe('Test');
    expect(excludeNodes[1].textContent).toBe('test');
  });
});
