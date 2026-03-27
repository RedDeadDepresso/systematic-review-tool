import { describe, it, expect } from 'vitest';
import { capitalize } from './capitalize';

describe('capitalize', () => {
  it('capitalizes the first letter of a string', () => {
    expect(capitalize('hello')).toBe('Hello');
    expect(capitalize('WORLD')).toBe('WORLD');
    expect(capitalize('hELLO')).toBe('HELLO');
    expect(capitalize('')).toBe('');
    expect(capitalize('a')).toBe('A');
  });
});
