import { vi } from 'vitest';

export default {
  post: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  defaults: {
    headers: {
      common: {},
    },
  },
};
