import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import api from './client';

// Use vi.hoisted to ensure the mock object is available before vi.mock
const mockInterceptors = vi.hoisted(() => ({
  request: [] as any[],
  response: [] as any[],
}));

// Mock axios to prevent actual network requests
vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>();

  // The mock instance needs to be callable for `api(originalRequest)`
  const callableMock = vi.fn();

  const mockAxiosInstance = Object.assign(callableMock, {
    interceptors: {
      request: {
        use: vi.fn((fulfilled, rejected) => {
          mockInterceptors.request.push({ fulfilled, rejected });
          return mockInterceptors.request.length - 1;
        }),
        eject: vi.fn(),
      },
      response: {
        use: vi.fn((fulfilled, rejected) => {
          mockInterceptors.response.push({ fulfilled, rejected });
          return mockInterceptors.response.length - 1;
        }),
        eject: vi.fn(),
      },
    },
    defaults: { headers: {} },
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    __mockInterceptors: mockInterceptors,
  });

  return {
    ...actual,
    default: {
      ...actual.default,
      create: vi.fn(() => mockAxiosInstance),
      post: vi.fn(),
    },
  };
});

describe('API Client', () => {
  let originalLocation: Location;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Save original location
    originalLocation = window.location;
    // Mock window.location for redirect tests
    // Using Object.defineProperty as location is read-only
    delete (window as any).location;
    window.location = { ...originalLocation, href: '' } as any;
  });

  afterEach(() => {
    window.location = originalLocation as any;
  });

  it('should be defined', () => {
    expect(api).toBeDefined();
  });

  describe('Request Interceptor', () => {
    it('should attach access_token to headers if it exists in localStorage', async () => {
      localStorage.setItem('access_token', 'test-token');

      // We need to access the handler that was added to the real api instance
      const interceptors = (api as any).__mockInterceptors.request;
      const requestHandler = interceptors[0].fulfilled;

      // Simulate a request config
      const config = { headers: {} };

      const updatedConfig = await requestHandler(config);

      expect(updatedConfig.headers.Authorization).toBe('Bearer test-token');
    });

    it('should not attach access_token if it does not exist', async () => {
      const interceptors = (api as any).__mockInterceptors.request;
      const requestHandler = interceptors[0].fulfilled;

      const config = { headers: {} };

      const updatedConfig = await requestHandler(config);

      expect(updatedConfig.headers.Authorization).toBeUndefined();
    });
  });

  describe('Response Interceptor', () => {
    it('should return response correctly on success', async () => {
      const interceptors = (api as any).__mockInterceptors.response;
      const responseHandler = interceptors[interceptors.length - 1].fulfilled;

      const mockResponse = { data: 'test data', status: 200 };
      const result = await responseHandler(mockResponse);

      expect(result).toBe(mockResponse);
    });

    it('should reject error if status is not 401', async () => {
      const interceptors = (api as any).__mockInterceptors.response;
      const errorHandler = interceptors[interceptors.length - 1].rejected;

      const mockError = { response: { status: 500 }, config: {} };

      await expect(errorHandler(mockError)).rejects.toEqual(mockError);
    });

    it('should reject error if it is 401 but already retried', async () => {
      const interceptors = (api as any).__mockInterceptors.response;
      const errorHandler = interceptors[interceptors.length - 1].rejected;

      const mockError = { response: { status: 401 }, config: { _retry: true } };

      await expect(errorHandler(mockError)).rejects.toEqual(mockError);
    });

    it('should refresh token on 401 and retry original request', async () => {
      localStorage.setItem('refresh_token', 'valid-refresh-token');

      const interceptors = (api as any).__mockInterceptors.response;
      const errorHandler = interceptors[interceptors.length - 1].rejected;

      const mockOriginalRequest = { headers: {} };
      const mockError = {
        response: { status: 401 },
        config: mockOriginalRequest,
      };

      // Mock the token refresh API call
      (axios.post as any).mockResolvedValueOnce({
        data: { access: 'new-access-token' },
      });

      // The retry logic calls `api(originalRequest)` which invokes the default export directly
      // However, we are testing the interceptor which is calling `api` directly.
      // Since it's a module we imported and it's a mock Axios instance, we can spy on it by calling mockImplementation
      // @ts-ignore
      api.mockResolvedValueOnce('retried-response');

      try {
        const result = await errorHandler(mockError);

        expect(axios.post).toHaveBeenCalledWith(
          expect.stringContaining('/auth/token/refresh/'),
          { refresh: 'valid-refresh-token' }
        );

        expect(localStorage.getItem('access_token')).toBe('new-access-token');
        expect((mockOriginalRequest as any).headers.Authorization).toBe(
          'Bearer new-access-token'
        );
        expect(api).toHaveBeenCalledWith(mockOriginalRequest);
        expect(result).toBe('retried-response');
      } finally {
        // Reset mock
        // @ts-ignore
        api.mockReset();
      }
    });

    it('should clear tokens and redirect to /login if refresh fails', async () => {
      localStorage.setItem('refresh_token', 'invalid-refresh-token');
      localStorage.setItem('access_token', 'old-access-token');

      const interceptors = (api as any).__mockInterceptors.response;
      const errorHandler = interceptors[interceptors.length - 1].rejected;

      const mockOriginalRequest = { headers: {} };
      const mockError = {
        response: { status: 401 },
        config: mockOriginalRequest,
      };

      // Mock the token refresh API call to fail
      const refreshError = new Error('Refresh failed');
      (axios.post as any).mockRejectedValueOnce(refreshError);

      await expect(errorHandler(mockError)).rejects.toEqual(refreshError);

      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('refresh_token')).toBeNull();
      expect(window.location.href).toBe('/login');
    });
  });
});
