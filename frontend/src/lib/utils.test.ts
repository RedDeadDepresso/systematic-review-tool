import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('merges class names correctly', () => {
    expect(cn('class1', 'class2')).toBe('class1 class2');
    expect(cn('class1', false && 'class2')).toBe('class1');
    expect(cn('p-4 p-2')).toBe('p-2'); // tailwind-merge test
  });
});
