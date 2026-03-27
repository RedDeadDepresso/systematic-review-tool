import { describe, it, expect } from 'vitest';
import { errorMessageString } from './error';

describe('errorMessageString', () => {
  it('returns empty string if no error', () => {
    expect(errorMessageString(null)).toBe('');
    expect(errorMessageString(undefined)).toBe('');
  });

  it('returns message or "Network error" if no response', () => {
    expect(errorMessageString(new Error('Test message'))).toBe('Test message');
    expect(errorMessageString({})).toBe('Network error');
  });

  it('handles HTML content type by returning generic server error', () => {
    const error = {
      response: {
        headers: {
          'content-type': 'text/html; charset=utf-8',
        },
        data: '<html>HTML error</html>',
      },
    };
    expect(errorMessageString(error)).toBe(
      'Server error occurred. Check the response in the console'
    );
  });

  it('extracts messages from data objects', () => {
    const error1 = {
      response: {
        headers: { 'content-type': 'application/json' },
        data: { detail: 'A detail error' },
      },
    };
    expect(errorMessageString(error1)).toBe('A detail error');

    const error2 = {
      response: {
        headers: { 'content-type': 'application/json' },
        data: { error: 'An error message' },
      },
    };
    expect(errorMessageString(error2)).toBe('An error message');

    const error3 = {
      response: {
        headers: { 'content-type': 'application/json' },
        data: { field1: ['Error 1', 'Error 2'], field2: 'Error 3' },
      },
    };
    expect(errorMessageString(error3)).toBe('Error 1 Error 2 Error 3');
  });

  it('returns generic error for unexpected format', () => {
    const error = {
      response: {
        headers: { 'content-type': 'application/json' },
        data: null,
      },
    };
    expect(errorMessageString(error)).toBe('An unexpected error occurred');
  });
});
